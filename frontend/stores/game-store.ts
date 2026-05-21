import { submitAction as submitActionHttp } from '../services/game-api';
import { wsClient } from '../services/ws-client';
import type { GameAction, GameEvent, PlayerGameView } from '../types/game.types';
import type { TileId } from '../types/tile.types';
import { eventBus } from '../utils/event-bus';

class GameStore {
  view: PlayerGameView | null = null;
  events: GameEvent[] = [];
  selectedTile: TileId | null = null;
  submitting = false;

  setView(view: PlayerGameView): void {
    this.view = view;
    this.submitting = false;
    eventBus.emit('game:update', this.snapshot());
  }

  setEvents(events: GameEvent[]): void {
    this.events = [...events, ...this.events].slice(0, 20);
    eventBus.emit('game:update', this.snapshot());
  }

  selectTile(tile: TileId): void {
    this.selectedTile = this.selectedTile === tile ? null : tile;
    eventBus.emit('game:update', this.snapshot());
  }

  async submitDiscard(tile: TileId): Promise<void> {
    const action = this.view?.legalActions.find((item) => item.type === 'DISCARD' && item.tile === tile);
    if (!action) {
      wx.showToast({ title: '当前不能打出这张牌', icon: 'none' });
      return;
    }
    await this.submitAction(action);
  }

  async submitAction(action: GameAction): Promise<void> {
    if (!this.view || this.submitting) return;
    this.submitting = true;
    eventBus.emit('game:update', this.snapshot());
    const payload = { ...action, clientSeq: this.view.stepIndex };
    wsClient.send({
      type: 'GAME_ACTION',
      roomId: this.view.roomId,
      gameId: this.view.gameId,
      payload,
    });
    const result = await submitActionHttp(this.view.gameId, payload);
    if (result.view) this.setView(result.view);
  }

  canSubmitAction(action: GameAction): boolean {
    return Boolean(
      this.view?.legalActions.some((item) => item.type === action.type && item.tile === action.tile && item.actionId === action.actionId),
    );
  }

  getLegalDiscardTiles(): TileId[] {
    return (
      this.view?.legalActions
        .filter((action) => action.type === 'DISCARD' && action.tile !== undefined)
        .map((action) => action.tile as TileId) || []
    );
  }

  snapshot() {
    return {
      view: this.view,
      events: this.events,
      selectedTile: this.selectedTile,
      submitting: this.submitting,
      legalDiscardTiles: this.getLegalDiscardTiles(),
    };
  }
}

export const gameStore = new GameStore();
