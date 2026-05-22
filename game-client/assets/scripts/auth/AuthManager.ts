import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import { Storage } from '../utils/Storage';
import { authApi } from './AuthApi';
import type { User } from '../room/RoomTypes';

export class AuthManager {
  token: string | null = Storage.getToken();
  user: User | null = Storage.getUser();

  async mockLogin(): Promise<void> {
    this.token = 'mock-token';
    this.user = { id: 'u_001', nickname: '玩家一' };
    Storage.setToken(this.token);
    Storage.setUser(this.user);
    eventBus.emit(GameEvents.AUTH_CHANGED, this.snapshot());
  }

  async wechatLogin(code: string): Promise<void> {
    const result = await authApi.wechatLogin({ code });
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
