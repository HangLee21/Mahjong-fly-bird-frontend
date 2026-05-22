import { ApiRoutes } from '../network/ApiRoutes';
import { httpClient } from '../network/HttpClient';
import type { RoomView } from './RoomTypes';

export class RoomApi {
  createRoom(): Promise<{ room: RoomView }> {
    return httpClient.post(ApiRoutes.rooms, {});
  }

  joinRoom(roomId: string, seatIndex?: number): Promise<RoomView> {
    return httpClient.post(ApiRoutes.joinRoom(roomId), { seatIndex });
  }

  addAi(roomId: string, seatIndex: number, model?: string): Promise<RoomView> {
    return httpClient.post(ApiRoutes.addAi(roomId), { seatIndex, model });
  }

  startGame(roomId: string): Promise<{ roomId: string; gameId: string }> {
    return httpClient.post(ApiRoutes.startGame(roomId));
  }

  getRoom(roomId: string): Promise<RoomView> {
    return httpClient.get(ApiRoutes.room(roomId));
  }
}

export const roomApi = new RoomApi();
