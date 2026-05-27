import { _decorator } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { createImage, createImageButton, createLayout, ensureCanvas } from '../ui/RuntimeUi';

const { ccclass } = _decorator;

const LOBBY_BG_RATIO = 1672 / 940;
const LOBBY_LOGO_RATIO = 1536 / 1024;
const BUTTON_PRIMARY_RATIO = 2167 / 726;
const PANEL_MAIN_RATIO = 1672 / 941;
const XIAOJI_ICON_RATIO = 70 / 100;

@ccclass('LobbyController')
export class LobbyController extends BaseScene {
  async start(): Promise<void> {
    console.log('[LobbyController] start');
    await this.enter();
    this.buildRuntimeUi();
  }

  async createRoom(): Promise<void> {
    console.log('[LobbyController] enter room entry');
    loadScene('RoomEntry');
  }

  private buildRuntimeUi(): void {
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);
    const layout = createLayout();

    this.createCoverImage(canvas, 'Background', 'textures/ui/lobby_bg', layout.width, layout.height, LOBBY_BG_RATIO);

    const panelWidth = layout.w(46);
    // createImage(
    //   canvas,
    //   'MainPanel',
    //   'textures/ui/panel_main',
    //   panelWidth,
    //   panelWidth / PANEL_MAIN_RATIO,
    //   layout.pos(23, -2),
    // );

    const logoWidth = layout.w(32);
    createImage(
      canvas,
      'LogoImage',
      'textures/ui/lobby_logo',
      logoWidth,
      logoWidth / LOBBY_LOGO_RATIO,
      layout.pos(-25, 0),
    );

    // const iconHeight = layout.h(16);
    // createImage(
    //   canvas,
    //   'XiaoJiIcon',
    //   'textures/ui/icon_xiaoji',
    //   iconHeight * XIAOJI_ICON_RATIO,
    //   iconHeight,
    //   layout.pos(-41, -13),
    // );

    const buttonWidth = layout.w(28);
    createImageButton(
      canvas,
      'CreateRoomButton',
      '',
      'textures/ui/button_primary',
      () => void this.createRoom(),
      layout.pos(23, 0),
      buttonWidth,
      buttonWidth / BUTTON_PRIMARY_RATIO,
    );
  }

  private createCoverImage(parent: ReturnType<typeof ensureCanvas>, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }
}
