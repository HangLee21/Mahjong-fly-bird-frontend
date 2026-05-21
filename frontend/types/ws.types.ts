import type { PlayerGameView, GameEvent } from './game.types';
import type { RoomView } from './room.types';

export type WsStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface WsMessage<T = unknown> {
  type: string;
  requestId?: string;
  roomId?: string;
  gameId?: string;
  payload?: T;
  ts?: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
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
