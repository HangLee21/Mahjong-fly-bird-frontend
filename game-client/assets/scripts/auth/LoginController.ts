import { _decorator, Color, Vec3 } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { authManager } from './AuthManager';
import { AppConfig, assertExperienceConfig } from '../app/AppConfig';
import { createButton, createLabel, createLayout, createPanel, ensureCanvas } from '../ui/RuntimeUi';
import {
  getWechatAppId,
  getWechatEnvironmentVersion,
  isWechatMiniGame,
  showWechatBlockingError,
} from '../platform/WechatPlatform';

const { ccclass } = _decorator;

@ccclass('LoginController')
export class LoginController extends BaseScene {
  private loggingIn = false;

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
    // wx.getUserProfile must be invoked from a user gesture, so wait for a
    // tap on the login button before reading the avatar/nickname and logging in.
    this.buildLoginButton();
  }

  private buildLoginButton(): void {
    const canvas = ensureCanvas(this.node);
    const layout = createLayout();
    createPanel(canvas, 'LoginBg', layout.width, layout.height, new Color(4, 45, 33, 255));
    const button = createButton(canvas, 'LoginButton', '微信登录', () => this.handleLogin(), Vec3.ZERO);
    button.setScale(1.45, 1.45, 1);
    createLabel(canvas, 'LoginHint', '点击按钮，使用微信授权登录', new Vec3(0, layout.h(9), 0));
  }

  private async handleLogin(): Promise<void> {
    if (this.loggingIn) return;
    this.loggingIn = true;
    try {
      await authManager.login();
      loadScene('Lobby');
    } catch (error) {
      this.loggingIn = false;
      console.error('[LoginController] login failed', error);
      showWechatBlockingError('登录失败', error);
    }
  }

  async loginWithWechatCode(code: string): Promise<void> {
    await authManager.wechatLogin(code);
    loadScene('Lobby');
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
