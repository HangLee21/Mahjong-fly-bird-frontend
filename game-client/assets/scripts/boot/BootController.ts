import { _decorator, Color, Node, view } from 'cc';
import { AppConfig } from '../app/AppConfig';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { createImage, createLayout, createPanel, ensureCanvas } from '../ui/RuntimeUi';
import { Storage } from '../utils/Storage';

const { ccclass } = _decorator;

interface WechatOrientationApi {
  setDeviceOrientation?(options: { value: 'landscape' }): void;
}

const LANDSCAPE_DESIGN_WIDTH = 1334;
const LANDSCAPE_DESIGN_HEIGHT = 750;
const LANDSCAPE_RESOLUTION_POLICY_FIXED_WIDTH = 4;
const BOOT_BG_RATIO = 1672 / 940;
const BOOT_LOGO_RATIO = 1536 / 1024;

@ccclass('BootController')
export class BootController extends BaseScene {
  async start(): Promise<void> {
    console.log('[BootController] start');
    this.applyLandscapeMode();
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    this.buildRuntimeUi();
    const nextScene = AppConfig.USE_MOCK_HTTP || Storage.getToken() ? 'Lobby' : 'Login';
    console.log(`[BootController] next scene: ${nextScene}`);
    setTimeout(() => loadScene(nextScene), 350);
  }

  private buildRuntimeUi(): void {
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);
    const layout = createLayout();

    this.createCoverImage(canvas, 'Background', 'textures/ui/lobby_bg', layout.width, layout.height, BOOT_BG_RATIO);
    createPanel(canvas, 'BootShade', layout.width, layout.height, new Color(0, 0, 0, 60));

    const logoWidth = layout.w(32);
    createImage(
      canvas,
      'LogoImage',
      'textures/ui/lobby_logo',
      logoWidth,
      logoWidth / BOOT_LOGO_RATIO,
      layout.pos(0, 2),
    );
  }

  private applyLandscapeMode(): void {
    const wxApi = (globalThis as { wx?: WechatOrientationApi }).wx;
    wxApi?.setDeviceOrientation?.({ value: 'landscape' });

    const runtimeView = view as unknown as {
      setDesignResolutionSize?: (width: number, height: number, policy: number) => void;
    };
    runtimeView.setDesignResolutionSize?.(
      LANDSCAPE_DESIGN_WIDTH,
      LANDSCAPE_DESIGN_HEIGHT,
      LANDSCAPE_RESOLUTION_POLICY_FIXED_WIDTH,
    );
  }

  private createCoverImage(parent: Node, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }
}
