import type { User } from '../room/RoomTypes';

export interface LoginResult {
  token: string;
  user: User;
}

export interface SessionResult {
  valid: boolean;
  user: User | null;
}
