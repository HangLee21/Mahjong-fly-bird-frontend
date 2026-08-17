import { _decorator, Color, Label, Node, UITransform, Vec3 } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { authManager } from './AuthManager';
import { AppConfig, assertExperienceConfig } from '../app/AppConfig';
import {
  createImage,
  createImageButton,
  createLabel,
  createLayout,
  createPanel,
  ensureCanvas,
  ensureChild,
  ensureComponent,
  TEXT_SCALE,
} from '../ui/RuntimeUi';
import {
  getWechatAppId,
  getWechatEnvironmentVersion,
  isWechatMiniGame,
  createWechatProfileButton,
  showWechatBlockingError,
  WechatUserInfoButton,
} from '../platform/WechatPlatform';

const { ccclass } = _decorator;

const LOGIN_BG_RATIO = 1672 / 940;
const LOGO_RATIO = 1536 / 1024;
const PRIMARY_BUTTON_RATIO = 2048 / 686;
const LOGIN_PANEL_RATIO = 2048 / 1080;

@ccclass('LoginController')
export class LoginController extends BaseScene {
  private loggingIn = false;
  private buttonFontSize = 28;
  private profileButton: WechatUserInfoButton | null = null;

  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    console.log('[LoginController] enter', { isWechatMiniGame: isWechatMiniGame() });
    try {
      assertExperienceConfig();
      this.assertWechatAppId();
    } catch (error) {
      console.error('[LoginController] config check failed', error);
      showWechatBlockingError('登录失败', error);
      return;
    }
    this.buildRuntimeUi();
    this.installWechatProfileButton();
  }

  onDestroy(): void {
    this.profileButton?.destroy();
    this.profileButton = null;
  }

  private buildRuntimeUi(): void {
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);
    const layout = createLayout();

    this.createCoverImage(canvas, 'Background', 'textures/ui/lobby_bg', layout.width, layout.height, LOGIN_BG_RATIO);
    createPanel(canvas, 'LoginShade', layout.width, layout.height, new Color(0, 12, 8, 138));

    const logoWidth = layout.w(20);
    createImage(canvas, 'LogoImage', 'textures/ui/lobby_logo', logoWidth, logoWidth / LOGO_RATIO, layout.pos(0, 28));

    const panelWidth = layout.w(42);
    const panelHeight = panelWidth / LOGIN_PANEL_RATIO;
    const panelPosition = layout.pos(0, -4);
    createImage(canvas, 'GuidePanel', 'textures/ui/panel_main', panelWidth, panelHeight, panelPosition);

    this.createText(canvas, 'TitleText', '欢迎回来', new Vec3(0, panelPosition.y + panelHeight * 0.27, 0), layout.s(3.0), new Color(255, 238, 170, 255));
    ensureChild(canvas, 'TitleText').getComponent(UITransform)?.setContentSize(panelWidth * 0.72, panelHeight * 0.2);
    this.createText(
      canvas,
      'PrivacyText',
      '授权头像和昵称，用于牌桌身份展示',
      new Vec3(0, panelPosition.y + panelHeight * 0.02, 0),
      layout.s(1.65),
      new Color(214, 234, 216, 255),
    );
    ensureChild(canvas, 'PrivacyText').getComponent(UITransform)?.setContentSize(panelWidth * 0.78, panelHeight * 0.16);

    const buttonWidth = layout.w(24);
    const buttonNode = createImageButton(
      canvas,
      'LoginButton',
      '微信一键登录',
      'textures/ui/button_primary',
      () => void this.handleLogin(),
      new Vec3(0, panelPosition.y - panelHeight * 0.24, 0),
      buttonWidth,
      buttonWidth / PRIMARY_BUTTON_RATIO,
    );
    this.updateButtonLabel(buttonNode, '微信登录', layout.s(1.9));
    this.buttonFontSize = layout.s(1.9);

    this.createText(
      canvas,
      'FallbackHint',
      isWechatMiniGame() ? '拒绝授权时将使用默认头像' : '请使用微信开发者工具或真机登录',
      layout.pos(0, -24),
      layout.s(1.25),
      new Color(178, 204, 189, 255),
    );
    ensureChild(canvas, 'FallbackHint').getComponent(UITransform)?.setContentSize(layout.w(48), layout.h(5));
  }

  private async handleLogin(): Promise<void> {
    if (this.loggingIn) return;
    console.warn('[LoginController] fallback login reached; native profile button may not have intercepted');
    this.loggingIn = true;
    const canvas = ensureCanvas(this.node);
    const button = canvas.children.find((child) => child.name === 'LoginButton');
    if (button) this.updateButtonLabel(button, '登录中…', this.buttonFontSize);
    try {
      await authManager.login();
      this.profileButton?.destroy();
      this.profileButton = null;
      loadScene('Lobby');
    } catch (error) {
      this.loggingIn = false;
      console.error('[LoginController] login failed', error);
      if (button) this.updateButtonLabel(button, '微信登录', this.buttonFontSize);
      showWechatBlockingError('登录失败', error);
    }
  }

  private installWechatProfileButton(): void {
    console.log('[LoginController] installWechatProfileButton', { isWechatMiniGame: isWechatMiniGame() });
    if (!isWechatMiniGame()) return;
    this.profileButton?.destroy();

    this.profileButton = createWechatProfileButton(
      null,
      (profile) => {
        this.profileButton?.destroy();
        this.profileButton = null;
        void this.handleLoginWithProfile(profile);
      },
      (error) => showWechatBlockingError('授权失败', error),
    );
  }

  private async handleLoginWithProfile(profile: { nickname: string; avatarUrl: string }): Promise<void> {
    if (this.loggingIn) return;
    this.loggingIn = true;
    const button = ensureCanvas(this.node).children.find((child) => child.name === 'LoginButton');
    if (button) this.updateButtonLabel(button, '登录中…', this.buttonFontSize);
    try {
      await authManager.login(profile);
      this.profileButton?.destroy();
      this.profileButton = null;
      loadScene('Lobby');
    } catch (error) {
      this.loggingIn = false;
      console.error('[LoginController] profile login failed', error);
      if (button) this.updateButtonLabel(button, '微信登录', this.buttonFontSize);
      showWechatBlockingError('登录失败', error);
      this.installWechatProfileButton();
    }
  }

  async loginWithWechatCode(code: string): Promise<void> {
    await authManager.wechatLogin(code);
    loadScene('Lobby');
  }

  private updateButtonLabel(node: Node, text: string, fontSize: number): void {
    const labelNode = ensureChild(node, 'Label');
    const label = ensureComponent(labelNode, Label);
    label.string = text;
    label.fontSize = fontSize * TEXT_SCALE;
    label.lineHeight = label.fontSize * 1.15;
    label.color = Color.WHITE;
    labelNode.getComponent(UITransform)?.setContentSize(260, 54);
  }

  private createText(parent: Node, name: string, text: string, position: Vec3, fontSize: number, color = Color.WHITE): Label {
    const label = createLabel(parent, name, text, position);
    label.fontSize = fontSize * TEXT_SCALE;
    label.lineHeight = label.fontSize * 1.15;
    label.color = color;
    return label;
  }

  private createCoverImage(parent: Node, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }

  private assertWechatAppId(): void {
    if (!isWechatMiniGame()) return;
    const actualAppId = getWechatAppId();
    if (actualAppId && actualAppId !== AppConfig.WECHAT_APP_ID) {
      throw new Error(`小游戏 AppID 不匹配：当前 ${actualAppId}，预期 ${AppConfig.WECHAT_APP_ID}`);
    }
    console.log(`[LoginController] WeChat env=${getWechatEnvironmentVersion() ?? 'unknown'} appId=${actualAppId ?? 'unknown'}`);
  }
}
