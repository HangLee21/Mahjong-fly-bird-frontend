import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import { roomApi } from './RoomApi';
import type { RoomView } from './RoomTypes';

export class RoomManager {
  currentRoom: RoomView | null = null;

  async createRoom(): Promise<RoomView> {
    const result = await roomApi.createRoom();
    this.setRoom(result.room);
    return result.room;
  }

  async addAi(seatIndex: number): Promise<RoomView> {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const room = await roomApi.addAi(this.currentRoom.roomId, seatIndex);
    this.setRoom(room);
    return room;
  }

  async startGame(): Promise<string> {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const result = await roomApi.startGame(this.currentRoom.roomId);
    this.setRoom({ ...this.currentRoom, status: 'PLAYING', gameId: result.gameId });
    return result.gameId;
  }

  setRoom(room: RoomView): void {
    this.currentRoom = room;
    eventBus.emit(GameEvents.ROOM_CHANGED, room);
  }
}

export const roomManager = new RoomManager();
