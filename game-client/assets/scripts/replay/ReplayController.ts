import { _decorator, Color, Label, Vec3 } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { GameBoardView } from '../game/views/GameBoardView';
import { mockReplay } from '../mock/MockData';
import {
  createImage,
  createImageButton,
  createLabel,
  createLayout,
  createPanel,
  ensureCanvas,
  RuntimeLayout,
} from '../ui/RuntimeUi';
import { replayManager } from './ReplayManager';
import { buildGameBoardView } from '../game/views/RuntimeGameBoardFactory';

const { ccclass, property } = _decorator;

const GAME_BG_RATIO = 1672 / 941;
const BUTTON_RATIO = 420 / 120;

@ccclass('ReplayController')
export class ReplayController extends BaseScene {
  @property(GameBoardView)
  boardView: GameBoardView | null = null;

  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    await replayManager.load(mockReplay.gameId);
    this.buildRuntimeUi();
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
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);
    const layout = createLayout();

    createPanel(canvas, 'BackgroundFallback', layout.width, layout.height, new Color(4, 45, 33, 255));
    this.createCoverImage(canvas, 'Background', 'textures/ui/game_bg', layout.width, layout.height, GAME_BG_RATIO);

    createPanel(canvas, 'TitlePanelFallback', layout.w(32), layout.h(8), new Color(8, 58, 43, 210), layout.pos(0, 41));
    createImage(canvas, 'TitlePanel', 'textures/ui/hud_panel_top', layout.w(32), layout.h(8), layout.pos(0, 41));
    this.createText(canvas, 'ReplayTitle', '牌局回放', layout.pos(0, 41), layout.s(2.6), new Color(255, 236, 171, 255));

    this.boardView = buildGameBoardView(canvas);
    this.boardView.node.setPosition(layout.pos(0, -1));

    const buttonWidth = layout.w(13);
    const buttonHeight = buttonWidth / BUTTON_RATIO;
    createImageButton(canvas, 'BackButton', '', 'textures/ui/button_back_room', () => loadScene('Room'), layout.pos(-29, -40), buttonWidth, buttonHeight);
    createImageButton(canvas, 'PreviousButton', '', 'textures/ui/button_back', () => this.previousStep(), layout.pos(28, -40), layout.s(6), layout.s(6));
    createImageButton(canvas, 'NextButton', '', 'textures/ui/button_continue', () => this.nextStep(), layout.pos(39, -40), buttonWidth, buttonHeight);
  }

  private createText(parent: import('cc').Node, name: string, text: string, position: Vec3, fontSize: number, color = Color.WHITE): Label {
    const label = createLabel(parent, name, text, position);
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.15;
    label.color = color;
    return label;
  }

  private createCoverImage(parent: import('cc').Node, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }
}
