import { ApiRoutes } from '../network/ApiRoutes';
import { httpClient } from '../network/HttpClient';
import type { RoomPreview, RoomRules, RoomSeat, RoomView } from './RoomTypes';

export type RoomResponse = RoomView | { room: RoomView };
export type AddAiResponse = RoomResponse | RoomSeat | { seat: RoomSeat };

export class RoomApi {
  createRoom(rules: RoomRules, roomId: string): Promise<{ room: RoomView }> {
    return httpClient.post(ApiRoutes.rooms, { roomId, rules });
  }

  joinRoom(roomId: string, seatIndex?: number): Promise<RoomResponse> {
    return httpClient.post(ApiRoutes.joinRoom(roomId), { seatIndex });
  }

  previewRoom(roomId: string): Promise<RoomPreview> {
    return httpClient.get(ApiRoutes.roomPreview(roomId));
  }

  addAi(roomId: string, seatIndex: number, model?: string): Promise<AddAiResponse> {
    return httpClient.post(ApiRoutes.addAi(roomId), { seatIndex, model });
  }

  updateRules(roomId: string, rules: RoomRules): Promise<RoomResponse> {
    return httpClient.post(ApiRoutes.updateRoomRules(roomId), rules);
  }

  leaveRoom(roomId: string): Promise<RoomResponse> {
    return httpClient.post(ApiRoutes.leaveRoom(roomId), {});
  }

  startGame(roomId: string): Promise<{ roomId: string; gameId: string }> {
    return httpClient.post(ApiRoutes.startGame(roomId), {});
  }

  getRoom(roomId: string): Promise<RoomView> {
    return httpClient.get(ApiRoutes.room(roomId));
  }
}

export const roomApi = new RoomApi();
