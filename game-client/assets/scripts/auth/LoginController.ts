import { _decorator } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { authManager } from './AuthManager';
import { AppConfig, assertExperienceConfig } from '../app/AppConfig';
import {
  getWechatAppId,
  getWechatEnvironmentVersion,
  isWechatMiniGame,
  showWechatBlockingError,
} from '../platform/WechatPlatform';

const { ccclass } = _decorator;

@ccclass('LoginController')
export class LoginController extends BaseScene {
  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    try {
      assertExperienceConfig();
      this.assertWechatAppId();
      await authManager.login();
      loadScene('Lobby');
    } catch (error) {
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
