import { sys } from 'cc';
import type { User } from '../room/RoomTypes';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const AUTH_VERSION_KEY = 'auth_session_version';

// Bump this value only when an installed client must force one fresh WeChat
// login. Tokens written by older builds have no matching version and are
// discarded once; a successful login records the new version.
export const AUTH_SESSION_VERSION = '2026-08-16-profile-v1';

function clearCredentials(): void {
  sys.localStorage.removeItem(TOKEN_KEY);
  sys.localStorage.removeItem(USER_KEY);
}

export const Storage = {
  getToken(): string | null {
    const token = sys.localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    if (sys.localStorage.getItem(AUTH_VERSION_KEY) !== AUTH_SESSION_VERSION) {
      clearCredentials();
      return null;
    }
    return token;
  },
  setToken(token: string): void {
    sys.localStorage.setItem(TOKEN_KEY, token);
    sys.localStorage.setItem(AUTH_VERSION_KEY, AUTH_SESSION_VERSION);
  },
  getUser(): User | null {
    const raw = sys.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
  setUser(user: User): void {
    sys.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearSession(): void {
    clearCredentials();
  },
};
