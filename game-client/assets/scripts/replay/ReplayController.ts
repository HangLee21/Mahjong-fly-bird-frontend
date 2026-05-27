import { _decorator } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { GameBoardView } from '../game/views/GameBoardView';
import { mockReplay } from '../mock/MockData';
import { createButton } from '../ui/RuntimeUi';
import { replayManager } from './ReplayManager';
import { buildGameBoardView } from '../game/views/RuntimeGameBoardFactory';
import { ensureCanvas } from '../ui/RuntimeUi';

const { ccclass, property } = _decorator;

@ccclass('ReplayController')
export class ReplayController extends BaseScene {
  @property(GameBoardView)
  boardView: GameBoardView | null = null;

  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    this.buildRuntimeUi();
    await replayManager.load(mockReplay.gameId);
    this.render();
  }

  nextStep(): void {
    replayManager.next();
    this.render();
  }

  previousStep(): void {
    replayManager.previous();
    this.render();
  }

  private render(): void {
    const step = replayManager.current();
    if (!step) return;
    this.boardView?.renderGameView(step.view, null, [], false);
  }

  private buildRuntimeUi(): void {
    const canvas = ensureCanvas(this.node);
    if (!this.boardView) this.boardView = buildGameBoardView(canvas);
    createButton(canvas, 'PreviousButton', '上一步', () => this.previousStep());
    createButton(canvas, 'NextButton', '下一步', () => this.nextStep());
  }
}
