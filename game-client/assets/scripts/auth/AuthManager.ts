import { GameEvents } from '../app/GameEvents';
import { AppConfig } from '../app/AppConfig';
import { eventBus } from '../core/EventBus';
import { Storage } from '../utils/Storage';
import { authApi } from './AuthApi';
import type { User } from '../room/RoomTypes';
import { isWechatMiniGame, requestWechatLoginCode, requestWechatUserProfile } from '../platform/WechatPlatform';
import { HttpRequestError } from '../network/HttpClient';

export class AuthManager {
  token: string | null = Storage.getToken();
  user: User | null = Storage.getUser();

  async login(providedProfile?: { nickname: string; avatarUrl: string }): Promise<void> {
    if (AppConfig.USE_MOCK_HTTP) {
      this.token = 'mock-token';
      this.user = { id: 'u_001', nickname: '游客' };
      Storage.setToken(this.token);
      Storage.setUser(this.user);
      eventBus.emit(GameEvents.AUTH_CHANGED, this.snapshot());
      return;
    }

    if (isWechatMiniGame()) {
      await this.loginWithFreshWechatCode(providedProfile);
      return;
    }

    throw new Error('体验版登录必须在微信开发者工具或微信真机环境中运行');
  }

  async mockLogin(): Promise<void> {
    await this.login();
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
    this.user = {
      ...result.user,
      nickname: nickname || result.user.nickname,
      avatarUrl: avatarUrl || result.user.avatarUrl,
    };
    Storage.setToken(result.token);
    Storage.setUser(this.user);
    eventBus.emit(GameEvents.AUTH_CHANGED, this.snapshot());
  }

  private async loginWithFreshWechatCode(providedProfile?: { nickname: string; avatarUrl: string }): Promise<void> {
    let profile: { nickname: string; avatarUrl: string } | null = providedProfile ?? null;
    if (!profile) {
      try {
        profile = await requestWechatUserProfile();
      } catch (error) {
        console.warn('[AuthManager] failed to read WeChat profile, using defaults', error);
      }
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const code = await requestWechatLoginCode();
      try {
        await this.wechatLogin(code, profile?.nickname ?? '微信玩家', profile?.avatarUrl ?? '');
        return;
      } catch (error) {
        if (!(error instanceof HttpRequestError) || error.status !== 401 || attempt > 0) throw error;
        console.warn('[AuthManager] WeChat code was rejected; requesting a fresh code once');
      }
    }
    throw new Error('微信登录失败');
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
