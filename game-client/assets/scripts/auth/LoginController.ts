import { _decorator, Color, Label, Node, Vec3 } from 'cc';
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
  showWechatBlockingError,
} from '../platform/WechatPlatform';

const { ccclass } = _decorator;

const LOGIN_BG_RATIO = 1672 / 940;
const LOGO_RATIO = 1536 / 1024;
const PRIMARY_BUTTON_RATIO = 2048 / 686;

@ccclass('LoginController')
export class LoginController extends BaseScene {
  private loggingIn = false;
  private buttonFontSize = 28;

  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    try {
      assertExperienceConfig();
      this.assertWechatAppId();
    } catch (error) {
      console.error('[LoginController] config check failed', error);
      showWechatBlockingError('登录失败', error);
      return;
    }
    this.buildRuntimeUi();
  }

  private buildRuntimeUi(): void {
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);
    const layout = createLayout();

    this.createCoverImage(canvas, 'Background', 'textures/ui/lobby_bg', layout.width, layout.height, LOGIN_BG_RATIO);
    createPanel(canvas, 'LoginShade', layout.width, layout.height, new Color(0, 0, 0, 110));

    const logoWidth = layout.w(20);
    createImage(canvas, 'LogoImage', 'textures/ui/lobby_logo', logoWidth, logoWidth / LOGO_RATIO, layout.pos(0, 21));

    this.createText(canvas, 'TitleText', '微信授权登录', layout.pos(0, 10), layout.s(2.9), new Color(255, 238, 170, 255));

    const panelWidth = layout.w(54);
    const panelHeight = layout.h(24);
    const panelPosition = layout.pos(0, -2);
    createPanel(canvas, 'GuidePanel', panelWidth, panelHeight, new Color(10, 52, 42, 190), panelPosition);
    const steps = [
      '① 点击下方“微信一键登录”',
      '② 在微信弹窗中选择“允许”',
      '③ 授权后自动进入游戏',
    ];
    steps.forEach((step, index) => {
      this.createText(
        canvas,
        `StepText${index}`,
        step,
        new Vec3(panelPosition.x, panelPosition.y + panelHeight * (0.26 - index * 0.26), 0),
        layout.s(1.9),
        new Color(235, 248, 217, 255),
      );
    });
    this.createText(
      canvas,
      'PrivacyText',
      '仅获取头像与昵称用于牌桌展示，不会收集其他信息',
      new Vec3(panelPosition.x, panelPosition.y - panelHeight * 0.4, 0),
      layout.s(1.45),
      new Color(190, 220, 202, 255),
    );

    const buttonWidth = layout.w(30);
    const buttonNode = createImageButton(
      canvas,
      'LoginButton',
      '微信一键登录',
      'textures/ui/button_primary',
      () => void this.handleLogin(),
      layout.pos(0, -17),
      buttonWidth,
      buttonWidth / PRIMARY_BUTTON_RATIO,
    );
    this.updateButtonLabel(buttonNode, '微信一键登录', layout.s(2.0));
    this.buttonFontSize = layout.s(2.0);

    this.createText(
      canvas,
      'FallbackHint',
      isWechatMiniGame() ? '拒绝授权也能以默认头像继续游戏' : '请在微信开发者工具或微信真机中体验登录',
      layout.pos(0, -21.3),
      layout.s(1.45),
      new Color(205, 226, 214, 255),
    );
  }

  private async handleLogin(): Promise<void> {
    if (this.loggingIn) return;
    this.loggingIn = true;
    const canvas = ensureCanvas(this.node);
    const button = canvas.children.find((child) => child.name === 'LoginButton');
    if (button) this.updateButtonLabel(button, '登录中…', this.buttonFontSize);
    try {
      await authManager.login();
      loadScene('Lobby');
    } catch (error) {
      this.loggingIn = false;
      console.error('[LoginController] login failed', error);
      if (button) this.updateButtonLabel(button, '微信一键登录', this.buttonFontSize);
      showWechatBlockingError('登录失败', error);
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
