import { _decorator, Color, Layers, Node } from 'cc';
import { AppConfig } from '../app/AppConfig';
import { loadScene } from '../app/SceneNavigator';
import { authManager } from '../auth/AuthManager';
import { BaseScene } from '../core/BaseScene';
import { httpClient } from '../network/HttpClient';
import { ApiRoutes } from '../network/ApiRoutes';
import { preloadGameResources, preloadLoadingAssets } from '../assets/ResourcePreloader';
import { applyLandscapeResolution, createImage, createLayout, createPanel, ensureCanvas, ensureComponent } from '../ui/RuntimeUi';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { Storage } from '../utils/Storage';
import { bgmManager } from '../audio/BgmManager';

const { ccclass } = _decorator;

interface WechatOrientationApi {
  setDeviceOrientation?(options: { value: 'landscape' }): void;
}

const BOOT_BG_RATIO = 1672 / 940;
const BOOT_LOGO_RATIO = 1536 / 1024;

@ccclass('BootController')
export class BootController extends BaseScene {
  async start(): Promise<void> {
    console.log('[BootController] start');
    this.applyLandscapeMode();
    bgmManager.initialize(this.node);
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    this.buildRuntimeUi();
    const overlay = this.createLoadingOverlay();
    await this.preloadLoadingStage(overlay);
    await this.preloadWithProgress(overlay);
    const nextScene = await this.resolveNextScene();
    console.log(`[BootController] next scene: ${nextScene}`);
    overlay.hide();
    setTimeout(() => loadScene(nextScene), 350);
  }

  private createLoadingOverlay(): LoadingOverlay {
    const canvas = ensureCanvas(this.node);
    const node = new Node('LoadingOverlay');
    node.layer = Layers.Enum.UI_2D;
    canvas.addChild(node);
    const overlay = ensureComponent(node, LoadingOverlay);
    overlay.build(createLayout());
    return overlay;
  }

  private async preloadWithProgress(overlay: LoadingOverlay): Promise<void> {
    for (;;) {
      try {
        await preloadGameResources((finished, total) => overlay.setProgress(finished, total));
        return;
      } catch (err) {
        console.warn('[BootController] resource preload failed; waiting for retry', err);
        overlay.showError('资源加载失败，请检查网络后重试');
        await overlay.waitForRetry();
      }
    }
  }

  private async preloadLoadingStage(overlay: LoadingOverlay): Promise<void> {
    try {
      await preloadLoadingAssets((finished, total) => overlay.setProgress(finished, total));
      overlay.useLoadedAssets();
    } catch (err) {
      console.warn('[BootController] loading-page assets unavailable, keep code-drawn fallback', err);
    }
    overlay.showLoadingPhase();
  }

  private async resolveNextScene(): Promise<'Lobby' | 'Login'> {
    if (AppConfig.USE_MOCK_HTTP) return 'Lobby';

    try {
      await httpClient.get(ApiRoutes.bootstrap);
    } catch (err) {
      console.warn('[BootController] bootstrap failed, continue with auth flow', err);
    }

    if (!Storage.getToken()) return 'Login';

    try {
      return (await authManager.restoreSession()) ? 'Lobby' : 'Login';
    } catch (err) {
      console.warn('[BootController] session restore failed', err);
      Storage.clearSession();
      return 'Login';
    }
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
    applyLandscapeResolution();
  }

  private createCoverImage(parent: Node, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }
}
