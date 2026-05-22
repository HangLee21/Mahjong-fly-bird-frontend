import type { PlayerGameView, GameEvent } from '../game/GameTypes';
import type { RoomView } from '../room/RoomTypes';

export interface WsMessage<T = unknown> {
  type: string;
  requestId?: string;
  roomId?: string;
  gameId?: string;
  payload?: T;
  ts?: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface GameViewPayload {
  view: PlayerGameView;
}

export interface GameEventsPayload {
  events: GameEvent[];
}

export interface RoomUpdatePayload {
  room: RoomView;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type WsStatus = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';
