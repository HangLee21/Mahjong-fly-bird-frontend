import { addAi, createRoom, getRoom, joinRoom, startGame } from '../services/room-api';
import type { RoomView } from '../types/room.types';
import { eventBus } from '../utils/event-bus';
import { setLastRoomId } from '../utils/storage';

class RoomStore {
  room: RoomView | null = null;

  async create(): Promise<RoomView> {
    const result = await createRoom({});
    this.setRoom(result.room);
    return result.room;
  }

  async join(roomId: string): Promise<RoomView> {
    const room = await joinRoom(roomId);
    this.setRoom(room);
    return room;
  }

  async refresh(roomId: string): Promise<RoomView> {
    const room = await getRoom(roomId);
    this.setRoom(room);
    return room;
  }

  async addAi(seatIndex: number): Promise<RoomView> {
    if (!this.room) throw new Error('请先进入房间');
    const room = await addAi(this.room.roomId, seatIndex);
    this.setRoom(room);
    return room;
  }

  async start(): Promise<string> {
    if (!this.room) throw new Error('请先进入房间');
    const result = await startGame(this.room.roomId);
    this.setRoom({ ...this.room, status: 'PLAYING', gameId: result.gameId });
    return result.gameId;
  }

  setRoom(room: RoomView): void {
    this.room = room;
    setLastRoomId(room.roomId);
    eventBus.emit('room:update', room);
  }
}

export const roomStore = new RoomStore();
