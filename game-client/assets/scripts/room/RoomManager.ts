import { AppConfig } from '../app/AppConfig';
import { GameEvents } from '../app/GameEvents';
import { authManager } from '../auth/AuthManager';
import { eventBus } from '../core/EventBus';
import { wsClient } from '../network/WsClient';
import { roomApi } from './RoomApi';
import type { RoomPreview, RoomRules, RoomSeat, RoomView, User } from './RoomTypes';

export class RoomManager {
  currentRoom: RoomView | null = null;

  async createRoom(roomId: string): Promise<RoomView> {
    const result = await roomApi.createRoom(this.defaultRules(), roomId);
    const room = AppConfig.USE_MOCK_HTTP ? this.mockCreatedRoom(result.room, roomId) : result.room;
    this.setRoom(room);
    return room;
  }

  async joinRoom(roomId: string): Promise<RoomView> {
    const room = this.unwrapRoom(await roomApi.joinRoom(roomId));
    const nextRoom = AppConfig.USE_MOCK_HTTP ? this.mockJoinedRoom(room) : room;
    this.setRoom(nextRoom);
    return nextRoom;
  }

  previewRoom(roomId: string): Promise<RoomPreview> {
    return roomApi.previewRoom(roomId);
  }

  async addAi(seatIndex: number): Promise<RoomView> {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const room = AppConfig.USE_MOCK_HTTP
      ? this.addLocalAi(seatIndex)
      : this.applyAddAiResponse(await roomApi.addAi(this.currentRoom.roomId, seatIndex, 'v3-lite'));
    this.setRoom(room);
    return room;
  }

  addLocalAi(seatIndex: number): RoomView {
    if (!this.currentRoom) throw new Error('当前没有房间');
    if (this.currentRoom.seats.some((seat) => seat.seatIndex === seatIndex && seat.user)) return this.currentRoom;
    return this.normalizeOwner({
      ...this.currentRoom,
      seats: this.currentRoom.seats.map((seat) =>
        seat.seatIndex === seatIndex
          ? this.seat(seatIndex, { id: `ai_${seatIndex}_${Date.now()}`, nickname: `AI ${seatIndex}` }, false, true)
          : seat,
      ),
    });
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

  async leaveRoom(): Promise<RoomView | null> {
    if (!this.currentRoom) return null;
    const roomIds = [this.currentRoom.roomId, this.currentRoom.internalRoomId]
      .filter((roomId): roomId is string => Boolean(roomId));
    if (AppConfig.USE_MOCK_HTTP) {
      const room = this.leaveLocalRoom();
      this.currentRoom = null;
      roomIds.forEach((roomId) => wsClient.unsubscribeRoom(roomId));
      return room;
    }

    const room = this.unwrapRoom(await roomApi.leaveRoom(this.currentRoom.roomId));
    this.currentRoom = null;
    roomIds.forEach((roomId) => wsClient.unsubscribeRoom(roomId));
    return room;
  }

  leaveLocalRoom(): RoomView | null {
    if (!this.currentRoom) return null;
    const userId = this.currentUser().id;
    const localSeat = this.currentRoom.seats.find((seat) => seat.user?.id === userId);
    if (!localSeat) return null;

    return this.normalizeOwner({
      ...this.currentRoom,
      seats: this.currentRoom.seats.map((seat) =>
        seat.seatIndex === localSeat.seatIndex ? this.emptySeat(seat.seatIndex) : { ...seat, isOwner: false },
      ),
    });
  }

  async startGame(): Promise<string> {
    if (!this.currentRoom) throw new Error('当前没有房间');
    const result = await roomApi.startGame(this.currentRoom.roomId);
    this.setRoom({ ...this.currentRoom, status: 'PLAYING', gameId: result.gameId });
    return result.gameId;
  }

  setRoom(room: RoomView): void {
    this.currentRoom = room;
    wsClient.connect();
    [room.roomId, room.internalRoomId]
      .filter((roomId): roomId is string => Boolean(roomId))
      .forEach((roomId) => wsClient.subscribeRoom(roomId));
    eventBus.emit(GameEvents.ROOM_CHANGED, room);
  }

  private defaultRules(): RoomRules {
    return {
      preset: AppConfig.RULE_PRESET as RoomRules['preset'],
      roundCount: 16,
      allowChow: true,
      fanCap: 3,
      publicKongTiles: 2,
      xiaoJiTile: '1-tiao',
      drawMode: 'fixed-wall-reserve',
      allowMultiWin: true,
    };
  }

  private mockCreatedRoom(room: RoomView, roomId: string): RoomView {
    const user = this.currentUser();
    return this.withOwner({ ...room, roomId }, user.id, [
      this.seat(0, user, true, false),
      this.emptySeat(1),
      this.emptySeat(2),
      this.emptySeat(3),
    ]);
  }

  private mockJoinedRoom(room: RoomView): RoomView {
    const user = this.currentUser();
    const owner: User = { id: 'u_host', nickname: '房主' };
    return this.withOwner(room, owner.id, [
      this.seat(0, owner, true, false),
      this.seat(1, user, false, false),
      this.emptySeat(2),
      this.emptySeat(3),
    ]);
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

  private unwrapRoom(response: RoomView | { room: RoomView }): RoomView {
    return 'room' in response ? response.room : response;
  }

  private applyAddAiResponse(response: Awaited<ReturnType<typeof roomApi.addAi>>): RoomView {
    if ('room' in response || this.isRoomView(response)) return this.unwrapRoom(response);
    const seat = 'seat' in response ? response.seat : response;
    if (!this.isRoomSeat(seat)) throw new Error('添加人机响应格式不正确');
    if (!this.currentRoom) throw new Error('当前没有房间');

    return {
      ...this.currentRoom,
      seats: this.currentRoom.seats.map((currentSeat) =>
        currentSeat.seatIndex === seat.seatIndex
          ? {
              ...currentSeat,
              ...seat,
              isAI: seat.isAI ?? true,
              isReady: seat.isReady ?? true,
              isOwner: seat.isOwner ?? false,
              occupied: seat.occupied ?? Boolean(seat.user),
            }
          : currentSeat,
      ),
    };
  }

  private isRoomView(value: unknown): value is RoomView {
    return typeof value === 'object' && value !== null && 'roomId' in value && 'seats' in value;
  }

  private isRoomSeat(value: unknown): value is RoomSeat {
    return typeof value === 'object' && value !== null && 'seatIndex' in value;
  }
}

export const roomManager = new RoomManager();
