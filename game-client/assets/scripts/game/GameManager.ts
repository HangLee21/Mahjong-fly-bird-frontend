import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import { ApiRoutes } from '../network/ApiRoutes';
import { httpClient } from '../network/HttpClient';
import { wsClient } from '../network/WsClient';
import type { GameEventsPayload, GameViewPayload, WsMessage, WsStatus } from '../network/Protocol';
import { buildClientAction, findDiscardAction } from './GameActionBuilder';
import type { GameAction, GameEvent, PlayerGameView, TileId } from './GameTypes';

/**
 * AI 每步动作（出牌/吃碰杠）在界面上展示前的延迟。
 * 调大可以放慢 AI 节奏，给报牌语音留出播放时间。
 */
export const AI_ACTION_PRESENTATION_DELAY_MS = 320;
export const OPENING_INTERACTION_LOCK_MS = 1350;

interface PendingView {
  signature: string;
  view: PlayerGameView;
}

export class GameManager {
  currentView: PlayerGameView | null = null;
  events: GameEvent[] = [];
  selectedTile: TileId | null = null;
  submitting = false;
  presentationAiSeat: number | null = null;
  private networkBound = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private presentationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pendingViews: PendingView[] = [];
  private viewSignature = '';
  private openingLocked = false;
  private openingGameId: string | null = null;
  private openingBaselinePublished = false;
  private awaitingOpeningGameId = false;
  private activeGameId: string | null = null;

  bindNetwork(): void {
    if (this.networkBound) return;
    this.networkBound = true;
    wsClient.on('GAME_VIEW', (message: WsMessage) => {
      const view = extractGameView(message);
      if (view) this.setView(view);
    });
    wsClient.on('GAME_EVENT', (message: WsMessage) => {
      const event = message.payload as GameEvent | undefined;
      if (event) {
        this.events = [...this.events, event];
        eventBus.emit(GameEvents.GAME_EVENTS, this.events);
      }
    });
    wsClient.on('GAME_EVENTS', (message: WsMessage) => {
      const payload = message.payload as GameEventsPayload | undefined;
      if (payload?.events) {
        this.events = payload.events;
        eventBus.emit(GameEvents.GAME_EVENTS, payload.events);
      }
    });
    wsClient.on('ERROR', (message: WsMessage) => {
      console.error('[GameManager] websocket error', message);
      this.scheduleRefresh(300);
    });
    eventBus.on(GameEvents.WS_STATUS_CHANGED, this.handleWsStatus);
  }

  async enterGame(roomId: string, gameId: string, subscribeRoomIds: string[] = [roomId]): Promise<void> {
    this.activeGameId = gameId;
    this.awaitingOpeningGameId = false;
    const preserveOpeningQueue = this.openingLocked
      && (!this.openingGameId || this.openingGameId === gameId);
    if (!preserveOpeningQueue) {
      this.clearPresentationQueue();
      this.viewSignature = '';
    } else if (!this.openingGameId) {
      this.openingGameId = gameId;
    }
    this.startPolling();
    wsClient.connect();
    [...new Set(subscribeRoomIds.filter(Boolean))].forEach((id) => wsClient.subscribeRoom(id));
    const view = await httpClient.get<PlayerGameView>(ApiRoutes.gameView(gameId));
    this.setView(view);
  }

  beginOpeningSequence(gameId?: string): void {
    if (this.openingLocked && (!gameId || !this.openingGameId || this.openingGameId === gameId)) {
      if (gameId) {
        this.openingGameId = gameId;
        this.activeGameId = gameId;
        this.awaitingOpeningGameId = false;
      }
      this.submitting = true;
      return;
    }
    this.clearPresentationQueue();
    this.openingLocked = true;
    this.openingGameId = gameId ?? null;
    this.activeGameId = gameId ?? null;
    this.awaitingOpeningGameId = !gameId;
    this.openingBaselinePublished = false;
    this.submitting = true;
  }

  finishOpeningSequence(gameId: string): void {
    if (!this.openingLocked || this.openingGameId !== gameId) return;
    this.openingLocked = false;
    this.openingGameId = null;
    this.openingBaselinePublished = false;
    this.awaitingOpeningGameId = false;
    this.submitting = false;
    eventBus.emit(GameEvents.GAME_VIEW_CHANGED, this.snapshot());
    this.drainPendingViews();
  }

  cancelOpeningSequence(): void {
    this.openingLocked = false;
    this.openingGameId = null;
    this.openingBaselinePublished = false;
    this.awaitingOpeningGameId = false;
    this.activeGameId = null;
    this.submitting = false;
    this.drainPendingViews();
  }

  /**
   * Safety net for missed websocket broadcasts (e.g. after a silent drop or a
   * reconnect): periodically pull the latest view so the board can never stay
   * stuck on a stale "AI thinking" frame while the backend is waiting on us.
   */
  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.submitting || this.pendingViews.length > 0 || !this.currentView) return;
      this.refreshView().catch((error) => console.warn('[GameManager] poll refresh failed', error));
    }, 1200);
    (this.pollTimer as unknown as { unref?: () => void }).unref?.();
  }

  stopPolling(): void {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  leaveGame(): void {
    this.stopPolling();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.clearPresentationQueue();
    this.currentView = null;
    this.events = [];
    this.selectedTile = null;
    this.submitting = false;
    this.viewSignature = '';
    this.openingLocked = false;
    this.openingGameId = null;
    this.openingBaselinePublished = false;
    this.awaitingOpeningGameId = false;
    this.activeGameId = null;
  }

  private readonly handleWsStatus = (status: WsStatus): void => {
    if (status === 'CONNECTED') {
      this.refreshView().catch((error) => console.warn('[GameManager] refresh after reconnect failed', error));
    }
  };

  setView(view: PlayerGameView): void {
    const normalized = normalizeGameView(view);
    if (this.awaitingOpeningGameId) return;
    if (this.activeGameId && normalized.gameId !== this.activeGameId) return;
    if (this.openingLocked && !this.openingGameId) this.openingGameId = normalized.gameId;
    if (this.openingLocked && this.openingGameId && normalized.gameId !== this.openingGameId) return;
    const signature = JSON.stringify(normalized);
    const lastPending = this.pendingViews[this.pendingViews.length - 1];
    if (signature === lastPending?.signature || signature === this.viewSignature) {
      if (!this.presentationTimer && this.pendingViews.length === 0) this.submitting = this.openingLocked;
      return;
    }
    const reference = lastPending?.view || this.currentView;
    if (isOlderView(reference, normalized)) return;

    if (this.openingLocked && !this.openingBaselinePublished) {
      this.openingBaselinePublished = true;
      this.applyView(normalized, signature);
      return;
    }

    this.pendingViews.push({ view: normalized, signature });
    this.drainPendingViews();
  }

  private applyView(view: PlayerGameView, signature: string): void {
    this.currentView = view;
    this.submitting = this.openingLocked;
    this.presentationAiSeat = null;
    if (signature === this.viewSignature) return;
    this.viewSignature = signature;
    eventBus.emit(GameEvents.GAME_VIEW_CHANGED, this.snapshot());
  }

  private drainPendingViews(): void {
    if (this.presentationTimer || this.openingLocked) return;

    while (this.pendingViews.length > 0) {
      const next = this.pendingViews[0];
      const aiSeat = getAiDiscardPresentationSeat(this.currentView, next.view);
      if (aiSeat !== null) {
        this.presentationAiSeat = aiSeat;
        this.submitting = true;
        eventBus.emit(GameEvents.GAME_VIEW_CHANGED, this.snapshot());
        this.presentationTimer = setTimeout(() => {
          this.presentationTimer = null;
          const delayed = this.pendingViews.shift();
          if (delayed) this.applyView(delayed.view, delayed.signature);
          this.drainPendingViews();
        }, AI_ACTION_PRESENTATION_DELAY_MS);
        return;
      }

      const aiMeldSeat = getAiMeldPresentationSeat(this.currentView, next.view);
      if (aiMeldSeat !== null) {
        this.presentationAiSeat = aiMeldSeat;
        this.submitting = true;
        eventBus.emit(GameEvents.GAME_VIEW_CHANGED, this.snapshot());
        this.presentationTimer = setTimeout(() => {
          this.presentationTimer = null;
          const delayed = this.pendingViews.shift();
          if (delayed) this.applyView(delayed.view, delayed.signature);
          this.drainPendingViews();
        }, AI_ACTION_PRESENTATION_DELAY_MS);
        return;
      }

      this.pendingViews.shift();
      this.applyView(next.view, next.signature);
    }
  }

  private clearPresentationQueue(): void {
    if (this.presentationTimer) clearTimeout(this.presentationTimer);
    this.presentationTimer = null;
    this.pendingViews.length = 0;
    this.presentationAiSeat = null;
  }

  selectTile(tile: TileId | null): void {
    this.selectedTile = tile;
  }

  async submitDiscard(tile: TileId): Promise<void> {
    if (!this.currentView) return;
    const action = findDiscardAction(this.currentView, tile);
    if (!action) throw new Error('Cannot discard this tile now.');
    await this.submitAction(action);
  }

  async submitAction(action: GameAction): Promise<void> {
    if (!this.currentView || this.submitting) return;
    this.submitting = true;
    const clientAction = buildClientAction(this.currentView, action);
    try {
      const result = await httpClient.post<{ accepted: boolean; view?: PlayerGameView }>(ApiRoutes.gameAction(this.currentView.gameId), clientAction);
      if (result.view) this.setView(result.view);
      else this.submitting = false;
      if (!result.accepted) throw new Error('Action was not accepted by backend.');
      this.scheduleRefresh(200);
    } catch (restError) {
      this.submitting = false;
      console.error('[GameManager] submit action failed', clientAction, restError);
      throw restError;
    }
  }

  async refreshView(): Promise<void> {
    if (!this.currentView) return;
    const gameId = this.currentView.gameId;
    const view = await httpClient.get<PlayerGameView>(ApiRoutes.gameView(gameId));
    if (this.currentView?.gameId === gameId) this.setView(view);
  }

  getLegalDiscardTiles(): TileId[] {
    if (!this.currentView) return [];
    const tiles = this.currentView.legalActions
      .filter((action) => action.type === 'DISCARD' && action.tile !== undefined)
      .map((action) => action.tile as TileId);
    if (tiles.length > 0) return tiles;
    if (this.currentView.legalActions.length > 0) return [];
    if (this.currentView.currentPlayer === this.currentView.playerIndex) return [...new Set(this.currentView.self.hand)];
    return [];
  }

  snapshot() {
    return {
      view: this.currentView,
      events: this.events,
      selectedTile: this.selectedTile,
      submitting: this.submitting,
      openingLocked: this.openingLocked,
      presentationAiSeat: this.presentationAiSeat,
      legalDiscardTiles: this.getLegalDiscardTiles(),
    };
  }

  private scheduleRefresh(delayMs: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshView().catch((error) => console.warn('[GameManager] refresh view failed', error));
    }, delayMs);
  }
}

export const gameManager = new GameManager();

export function extractGameView(message: WsMessage): PlayerGameView | null {
  const payload = message.payload;
  if (!payload || typeof payload !== 'object') return null;
  const wrapped = payload as GameViewPayload;
  if (wrapped.view) return wrapped.view;
  const candidate = payload as Partial<PlayerGameView>;
  return typeof candidate.gameId === 'string' && typeof candidate.roomId === 'string' ? (candidate as PlayerGameView) : null;
}

export function normalizeGameView(view: PlayerGameView): PlayerGameView {
  const playerIndex = view.playerIndex ?? view.self.seatIndex ?? 0;
  const legalActions = view.legalActions?.length ? view.legalActions : view.self.legalActions || [];
  const rawPlayers = view.players || view.opponents || [];
  const opponents = rawPlayers
    .filter((player) => player.seatIndex !== playerIndex)
    .map((player) => ({
      ...player,
      melds: player.melds || [],
      discards: player.discards || [],
      handCount: player.handCount ?? 0,
      status: player.status || 'ACTIVE',
    }));

  return {
    ...view,
    playerIndex,
    wallTilesRemaining: view.wallTilesRemaining ?? view.wallCount ?? 0,
    publicKongTiles: view.publicKongTiles || [],
    xiaoJiActiveAsWild: view.xiaoJiActiveAsWild !== false,
    scores: view.scores || [0, 0, 0, 0],
    self: {
      ...view.self,
      seatIndex: view.self.seatIndex ?? playerIndex,
      hand: view.self.hand || [],
      handCount: view.self.handCount ?? view.self.hand?.length ?? 0,
      melds: view.self.melds || [],
      discards: view.self.discards || [],
      legalActions: view.self.legalActions || legalActions,
    },
    opponents,
    legalActions,
  };
}

export function getAiDiscardPresentationSeat(
  previous: PlayerGameView | null,
  next: PlayerGameView,
): number | null {
  if (!previous || previous.gameId !== next.gameId) return null;
  const seatIndex = next.lastDiscard?.fromPlayer;
  if (seatIndex === undefined || seatIndex === next.playerIndex) return null;

  const player = [...next.opponents, ...(next.players || [])]
    .find((candidate) => candidate.seatIndex === seatIndex);
  if (!player?.isAI) return null;

  const previousCount = discardCountForSeat(previous, seatIndex);
  const nextCount = discardCountForSeat(next, seatIndex);
  return nextCount > previousCount ? seatIndex : null;
}

export function findNewDrawIndex(previousHand: TileId[], currentHand: TileId[]): number | null {
  if (currentHand.length !== previousHand.length + 1) return null;
  const previousCounts = new Map<TileId, number>();
  previousHand.forEach((tile) => previousCounts.set(tile, (previousCounts.get(tile) ?? 0) + 1));
  const currentCounts = new Map<TileId, number>();
  currentHand.forEach((tile) => currentCounts.set(tile, (currentCounts.get(tile) ?? 0) + 1));
  const addedTile = currentHand.find((tile) => (currentCounts.get(tile) ?? 0) > (previousCounts.get(tile) ?? 0));
  return addedTile === undefined ? null : currentHand.lastIndexOf(addedTile);
}

export function getAiMeldPresentationSeat(
  previous: PlayerGameView | null,
  next: PlayerGameView,
): number | null {
  if (!previous || previous.gameId !== next.gameId) return null;
  const meldCountFor = (view: PlayerGameView, seat: number): number => {
    if (seat === view.playerIndex) return view.self.melds.length;
    const player = [...view.opponents, ...(view.players || [])]
      .find((candidate) => candidate.seatIndex === seat);
    return player?.melds.length || 0;
  };
  for (const candidate of [...next.opponents, ...(next.players || [])]) {
    if (!candidate.isAI || candidate.seatIndex === next.playerIndex) continue;
    if (meldCountFor(next, candidate.seatIndex) > meldCountFor(previous, candidate.seatIndex)) {
      return candidate.seatIndex;
    }
  }
  return null;
}

export function getDisplayedScores(view: PlayerGameView): number[] {
  return Array.isArray(view.totalScores) && view.totalScores.length > 0
    ? view.totalScores
    : view.scores;
}

function discardCountForSeat(view: PlayerGameView, seatIndex: number): number {
  if (seatIndex === view.playerIndex) return view.self.discards.length;
  const player = [...view.opponents, ...(view.players || [])]
    .find((candidate) => candidate.seatIndex === seatIndex);
  return player?.discards.length || 0;
}

function isOlderView(previous: PlayerGameView | null, next: PlayerGameView): boolean {
  if (!previous || previous.gameId !== next.gameId) return false;
  const previousRound = previous.currentRound ?? previous.roundIndex ?? 0;
  const nextRound = next.currentRound ?? next.roundIndex ?? 0;
  return previousRound === nextRound && next.stepIndex < previous.stepIndex;
}
