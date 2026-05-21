import { ENV } from '../config/env';
import { request } from './http';
import { mockAddAi, mockCreateRoom, mockGetRoom, mockJoinRoom, mockLeaveRoom, mockStartGame } from './mock/mock-api';
import type { CreateRoomInput, CreateRoomResult, RoomView, StartGameResult } from '../types/room.types';

export async function createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
  if (ENV.USE_MOCK_API) return mockCreateRoom(input);
  return request<CreateRoomResult>({ url: '/rooms', method: 'POST', data: input, loading: true });
}

export async function joinRoom(roomId: string, seatIndex?: number): Promise<RoomView> {
  if (ENV.USE_MOCK_API) return mockJoinRoom();
  return request<RoomView>({ url: `/rooms/${roomId}/join`, method: 'POST', data: { seatIndex }, loading: true });
}

export async function leaveRoom(roomId: string): Promise<void> {
  if (ENV.USE_MOCK_API) return mockLeaveRoom();
  return request<void>({ url: `/rooms/${roomId}/leave`, method: 'POST' });
}

export async function addAi(roomId: string, seatIndex: number, model?: string): Promise<RoomView> {
  if (ENV.USE_MOCK_API) return mockAddAi(roomId, seatIndex);
  return request<RoomView>({ url: `/rooms/${roomId}/add-ai`, method: 'POST', data: { seatIndex, model }, loading: true });
}

export async function startGame(roomId: string): Promise<StartGameResult> {
  if (ENV.USE_MOCK_API) return mockStartGame();
  return request<StartGameResult>({ url: `/rooms/${roomId}/start`, method: 'POST', loading: true });
}

export async function getRoom(roomId: string): Promise<RoomView> {
  if (ENV.USE_MOCK_API) return mockGetRoom();
  return request<RoomView>({ url: `/rooms/${roomId}` });
}
