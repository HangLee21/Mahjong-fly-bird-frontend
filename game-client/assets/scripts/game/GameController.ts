import { _decorator } from 'cc';
import { GameEvents } from '../app/GameEvents';
import { BaseScene } from '../core/BaseScene';
import { eventBus } from '../core/EventBus';
import { gameManager } from './GameManager';
import type { GameAction, TileId } from './GameTypes';
import { GameBoardView } from './views/GameBoardView';

const { ccclass, property } = _decorator;

@ccclass('GameController')
export class GameController extends BaseScene {
  @property(GameBoardView)
  boardView: GameBoardView | null = null;

  async enterGame(roomId: string, gameId: string): Promise<void> {
    gameManager.bindNetwork();
    this.bindEvents();
    await gameManager.enterGame(roomId, gameId);
  }

  private bindEvents(): void {
    eventBus.on(GameEvents.GAME_VIEW_CHANGED, () => this.render());
    eventBus.on(GameEvents.DISCARD_REQUESTED, (tile: TileId) => this.handleDiscard(tile));
    eventBus.on(GameEvents.ACTION_SELECTED, (action: GameAction) => gameManager.submitAction(action));
  }

  private render(): void {
    const snapshot = gameManager.snapshot();
    if (!snapshot.view) return;
    this.boardView?.renderGameView(snapshot.view, snapshot.selectedTile, snapshot.legalDiscardTiles, snapshot.submitting);
  }

  private async handleDiscard(tile: TileId): Promise<void> {
    if (gameManager.selectedTile === tile) await gameManager.submitDiscard(tile);
    else gameManager.selectTile(tile);
  }
}
