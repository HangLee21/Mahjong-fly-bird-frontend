import { GameEvents } from '../app/GameEvents';
import { authManager } from '../auth/AuthManager';
import { eventBus } from '../core/EventBus';
import { roomApi } from './RoomApi';
import type { RoomSeat, RoomView, User } from './RoomTypes';

export class RoomManager {
  currentRoom: RoomView | null = null;

  async createRoom(): Promise<RoomView> {
    const result = await roomApi.createRoom();
    const user = this.currentUser();
    const room = this.withOwner(result.room, user.id, [
      this.seat(0, user, true, false),
      this.emptySeat(1),
      this.emptySeat(2),
      this.emptySeat(3),
    ]);
    this.setRoom(room);
    return room;
  }

  async joinRoom(roomId: string): Promise<RoomView> {
    const room = await roomApi.joinRoom(roomId);
    const user = this.currentUser();
    const owner: User = { id: 'u_host', nickname: '房主' };
    const joinedRoom = this.withOwner(room, owner.id, [
      this.seat(0, owner, true, false),
      this.seat(1, user, false, false),
      this.emptySeat(2),
      this.emptySeat(3),
    ]);
    this.setRoom(joinedRoom);
    return joinedRoom;
  }

  async addAi(seatIndex: number): Promise<RoomView> {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const room = await roomApi.addAi(this.currentRoom.roomId, seatIndex);
    this.setRoom(this.normalizeOwner(room));
    return this.currentRoom;
  }

  addLocalAi(seatIndex: number): RoomView {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const room = {
      ...this.currentRoom,
      seats: this.currentRoom.seats.map((seat) =>
        seat.seatIndex === seatIndex
          ? this.seat(seatIndex, { id: `ai_${seatIndex}_${Date.now()}`, nickname: `AI ${seatIndex}` }, false, true)
          : seat,
      ),
    };
    this.setRoom(this.normalizeOwner(room));
    return this.currentRoom;
  }

  removeSeat(seatIndex: number): RoomView {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const room = {
      ...this.currentRoom,
      seats: this.currentRoom.seats.map((seat) =>
        seat.seatIndex === seatIndex ? this.emptySeat(seatIndex) : { ...seat, isOwner: false },
      ),
    };
    this.setRoom(this.normalizeOwner(room));
    return this.currentRoom;
  }

  transferOwner(seatIndex: number): RoomView {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const target = this.currentRoom.seats.find((seat) => seat.seatIndex === seatIndex && seat.user);
    if (!target?.user) return this.currentRoom;
    const room = {
      ...this.currentRoom,
      ownerId: target.user.id,
      seats: this.currentRoom.seats.map((seat) => ({
        ...seat,
        isOwner: seat.seatIndex === seatIndex,
      })),
    };
    this.setRoom(room);
    return room;
  }

  leaveLocalRoom(): RoomView | null {
    if (!this.currentRoom) return null;
    const userId = this.currentUser().id;
    const localSeat = this.currentRoom.seats.find((seat) => seat.user?.id === userId);
    if (!localSeat) {
      this.currentRoom = null;
      return null;
    }

    const room = {
      ...this.currentRoom,
      seats: this.currentRoom.seats.map((seat) =>
        seat.seatIndex === localSeat.seatIndex ? this.emptySeat(seat.seatIndex) : { ...seat, isOwner: false },
      ),
    };
    const nextRoom = this.normalizeOwner(room);
    this.currentRoom = null;
    return nextRoom;
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

  private currentUser(): User {
    return authManager.user || { id: 'u_001', nickname: '游客' };
  }

  private emptySeat(seatIndex: number): RoomSeat {
    return { seatIndex, isReady: false };
  }

  private seat(seatIndex: number, user: User, isOwner: boolean, isAI: boolean): RoomSeat {
    return {
      seatIndex,
      user,
      isAI,
      isOwner,
      isReady: isOwner || isAI,
    };
  }

  private withOwner(room: RoomView, ownerId: string, seats: RoomSeat[]): RoomView {
    return {
      ...room,
      ownerId,
      status: 'WAITING',
      seats: seats.map((seat) => ({
        ...seat,
        isOwner: seat.user?.id === ownerId,
      })),
    };
  }

  private normalizeOwner(room: RoomView): RoomView {
    const occupiedSeats = room.seats.filter((seat) => seat.user);
    const existingOwner = occupiedSeats.find((seat) => seat.user?.id === room.ownerId);
    const ownerSeat = existingOwner || occupiedSeats[0];
    const ownerId = ownerSeat?.user?.id || room.ownerId;

    return {
      ...room,
      ownerId,
      seats: room.seats.map((seat) => ({
        ...seat,
        isOwner: Boolean(seat.user && seat.user.id === ownerId),
      })),
    };
  }
}

export const roomManager = new RoomManager();
