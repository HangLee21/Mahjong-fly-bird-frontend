import type { User } from '../types/auth.types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const ROOM_KEY = 'last_room_id';

export function getToken(): string | null {
  return wx.getStorageSync(TOKEN_KEY) || null;
}

export function setToken(token: string): void {
  wx.setStorageSync(TOKEN_KEY, token);
}

export function clearToken(): void {
  wx.removeStorageSync(TOKEN_KEY);
}

export function getUser(): User | null {
  return wx.getStorageSync(USER_KEY) || null;
}

export function setUser(user: User): void {
  wx.setStorageSync(USER_KEY, user);
}

export function clearUser(): void {
  wx.removeStorageSync(USER_KEY);
}

export function getLastRoomId(): string | null {
  return wx.getStorageSync(ROOM_KEY) || null;
}

export function setLastRoomId(roomId: string): void {
  wx.setStorageSync(ROOM_KEY, roomId);
}
