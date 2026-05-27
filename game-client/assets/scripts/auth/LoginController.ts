import { _decorator } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { authManager } from './AuthManager';

const { ccclass } = _decorator;

@ccclass('LoginController')
export class LoginController extends BaseScene {
  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    await authManager.mockLogin();
    loadScene('Lobby');
  }

  async loginWithWechatCode(code: string): Promise<void> {
    await authManager.wechatLogin(code);
    loadScene('Lobby');
  }
}
