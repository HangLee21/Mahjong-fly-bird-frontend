import { sys } from 'cc';
import type { User } from '../room/RoomTypes';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const Storage = {
  getToken(): string | null {
    return sys.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    sys.localStorage.setItem(TOKEN_KEY, token);
  },
  getUser(): User | null {
    const raw = sys.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
  setUser(user: User): void {
    sys.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearSession(): void {
    sys.localStorage.removeItem(TOKEN_KEY);
    sys.localStorage.removeItem(USER_KEY);
  },
};
