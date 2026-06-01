import { GameEvents } from '../app/GameEvents';
import { AppConfig } from '../app/AppConfig';
import { eventBus } from '../core/EventBus';
import { Storage } from '../utils/Storage';
import { authApi } from './AuthApi';
import type { User } from '../room/RoomTypes';

export class AuthManager {
  token: string | null = Storage.getToken();
  user: User | null = Storage.getUser();

  async mockLogin(): Promise<void> {
    if (!AppConfig.USE_MOCK_HTTP) {
      await this.wechatLogin('dev_user', '测试玩家', '');
      return;
    }

    this.token = 'mock-token';
    this.user = { id: 'u_001', nickname: '游客' };
    Storage.setToken(this.token);
    Storage.setUser(this.user);
    eventBus.emit(GameEvents.AUTH_CHANGED, this.snapshot());
  }

  async restoreSession(): Promise<boolean> {
    if (!this.token) return false;
    const result = await authApi.session();
    if (!result.valid || !result.user) {
      this.logout();
      return false;
    }

    this.user = result.user;
    Storage.setUser(result.user);
    eventBus.emit(GameEvents.AUTH_CHANGED, this.snapshot());
    return true;
  }

  async wechatLogin(code: string, nickname?: string, avatarUrl?: string): Promise<void> {
    const result = await authApi.wechatLogin({ code, nickname, avatarUrl });
    this.token = result.token;
    this.user = result.user;
    Storage.setToken(result.token);
    Storage.setUser(result.user);
    eventBus.emit(GameEvents.AUTH_CHANGED, this.snapshot());
  }

  logout(): void {
    this.token = null;
    this.user = null;
    Storage.clearSession();
    eventBus.emit(GameEvents.AUTH_CHANGED, this.snapshot());
  }

  snapshot() {
    return { token: this.token, user: this.user };
  }
}

export const authManager = new AuthManager();
