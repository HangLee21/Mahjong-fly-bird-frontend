import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import { ApiRoutes } from '../network/ApiRoutes';
import { httpClient } from '../network/HttpClient';
import { wsClient } from '../network/WsClient';
import type { GameEventsPayload, GameViewPayload, WsMessage } from '../network/Protocol';
import { buildClientAction, findDiscardAction } from './GameActionBuilder';
import type { GameAction, GameEvent, PlayerGameView, TileId } from './GameTypes';

export class GameManager {
  currentView: PlayerGameView | null = null;
  events: GameEvent[] = [];
  selectedTile: TileId | null = null;
  submitting = false;
  private networkBound = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

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
  }

  async enterGame(roomId: string, gameId: string, subscribeRoomIds: string[] = [roomId]): Promise<void> {
    wsClient.connect();
    [...new Set(subscribeRoomIds.filter(Boolean))].forEach((id) => wsClient.subscribeRoom(id));
    const view = await httpClient.get<PlayerGameView>(ApiRoutes.gameView(gameId));
    this.setView(view);
  }

  setView(view: PlayerGameView): void {
    this.currentView = normalizeGameView(view);
    this.submitting = false;
    eventBus.emit(GameEvents.GAME_VIEW_CHANGED, this.snapshot());
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
      this.scheduleRefresh(600);
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
