import { wechatLogin } from '../services/auth-api';
import type { User } from '../types/auth.types';
import { clearToken, clearUser, getToken, getUser, setToken, setUser } from '../utils/storage';
import { eventBus } from '../utils/event-bus';

class AuthStore {
  token: string | null = null;
  user: User | null = null;

  async init(): Promise<void> {
    this.token = getToken();
    this.user = getUser();
    eventBus.emit('auth:update', this.snapshot());
  }

  async login(): Promise<void> {
    const code = await new Promise<string>((resolve, reject) => {
      wx.login({
        success: (res) => resolve(res.code),
        fail: reject,
      });
    });
    const result = await wechatLogin({ code });
    this.token = result.token;
    this.user = result.user;
    setToken(result.token);
    setUser(result.user);
    eventBus.emit('auth:update', this.snapshot());
  }

  logout(): void {
    this.token = null;
    this.user = null;
    clearToken();
    clearUser();
    eventBus.emit('auth:update', this.snapshot());
    wx.reLaunch({ url: '/pages/login/login' });
  }

  isLoggedIn(): boolean {
    return Boolean(this.token);
  }

  snapshot() {
    return { token: this.token, user: this.user };
  }
}

export const authStore = new AuthStore();
