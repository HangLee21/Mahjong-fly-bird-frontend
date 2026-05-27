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

  bindNetwork(): void {
    wsClient.on('GAME_VIEW', (message: WsMessage) => {
      const payload = message.payload as GameViewPayload | undefined;
      if (payload?.view) this.setView(payload.view);
    });
    wsClient.on('GAME_EVENTS', (message: WsMessage) => {
      const payload = message.payload as GameEventsPayload | undefined;
      if (payload?.events) {
        this.events = payload.events;
        eventBus.emit(GameEvents.GAME_EVENTS, payload.events);
      }
    });
  }

  async enterGame(roomId: string, gameId: string): Promise<void> {
    wsClient.connect();
    wsClient.subscribeRoom(roomId);
    const view = await httpClient.get<PlayerGameView>(ApiRoutes.gameView(gameId));
    this.setView(view);
  }

  setView(view: PlayerGameView): void {
    this.currentView = view;
    this.submitting = false;
    eventBus.emit(GameEvents.GAME_VIEW_CHANGED, this.snapshot());
  }

  selectTile(tile: TileId | null): void {
    this.selectedTile = tile;
  }

  async submitDiscard(tile: TileId): Promise<void> {
    if (!this.currentView) return;
    const action = findDiscardAction(this.currentView, tile);
    if (!action) throw new Error('当前不能打出这张牌');
    await this.submitAction(action);
  }

  async submitAction(action: GameAction): Promise<void> {
    if (!this.currentView || this.submitting) return;
    this.submitting = true;
    const clientAction = buildClientAction(this.currentView, action);
    wsClient.send({
      type: 'GAME_ACTION',
      roomId: this.currentView.roomId,
      gameId: this.currentView.gameId,
      payload: clientAction,
    });
  }

  getLegalDiscardTiles(): TileId[] {
    return (
      this.currentView?.legalActions
        .filter((action) => action.type === 'DISCARD' && action.tile !== undefined)
        .map((action) => action.tile as TileId) || []
    );
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
}

export const gameManager = new GameManager();
