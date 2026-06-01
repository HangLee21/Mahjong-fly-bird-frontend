import { ApiRoutes } from '../network/ApiRoutes';
import type { PlayerGameView } from '../game/GameTypes';
import type { RoomView } from '../room/RoomTypes';
import { mockFinishedGameView, mockGameView, mockReplay, mockRoom } from './MockData';

function cloneRoom(room: RoomView): RoomView {
  return {
    ...room,
    rules: { ...room.rules },
    seats: room.seats.map((seat) => ({
      ...seat,
      user: seat.user ? { ...seat.user } : undefined,
    })),
  };
}

export class MockHttpClient {
  private room = cloneRoom(mockRoom);
  private rooms = new Map<string, RoomView>([
    [
      mockRoom.roomId,
      {
        ...cloneRoom(mockRoom),
        ownerId: 'u_host',
        seats: [
          { seatIndex: 0, user: { id: 'u_host', nickname: '房主' }, isReady: true, isOwner: true },
          { seatIndex: 1, isReady: false },
          { seatIndex: 2, isReady: false },
          { seatIndex: 3, isReady: false },
        ],
      },
    ],
  ]);

  async request<T>(path: string, method: 'GET' | 'POST' = 'GET', data?: unknown): Promise<T> {
    await Promise.resolve();

    if (path === ApiRoutes.wechatLogin) {
      return {
        token: 'mock-token',
        user: { id: 'u_001', nickname: '游客' },
      } as T;
    }

    if (path === ApiRoutes.rooms && method === 'POST') {
      const roomId =
        typeof data === 'object' && data !== null && 'roomId' in data
          ? String((data as { roomId?: unknown }).roomId)
          : mockRoom.roomId;
      this.room = { ...cloneRoom(mockRoom), roomId };
      this.rooms.set(roomId, cloneRoom(this.room));
      return { room: cloneRoom(this.room) } as T;
    }

    const previewMatch = path.match(/^\/rooms\/([^/]+)\/preview$/);
    if (previewMatch && method === 'GET') {
      const roomId = previewMatch[1] || '';
      const room = this.rooms.get(roomId);
      if (!room) {
        return {
          exists: false,
          roomId,
          canJoin: false,
          message: 'Room not found.',
        } as T;
      }

      const seatCount = room.seats.filter((seat) => seat.user).length;
      return {
        exists: true,
        roomId,
        status: room.status,
        seatCount,
        maxSeats: 4,
        canJoin: room.status === 'WAITING' && seatCount < 4,
        ownerNickname: room.seats.find((seat) => seat.isOwner)?.user?.nickname || '房主',
        rules: room.rules,
      } as T;
    }

    const joinMatch = path.match(/^\/rooms\/([^/]+)\/join$/);
    if (joinMatch && method === 'POST') {
      const roomId = joinMatch[1] || mockRoom.roomId;
      const existing = this.rooms.get(roomId) || { ...cloneRoom(mockRoom), roomId };
      this.room = cloneRoom(existing);
      this.room = {
        ...this.room,
        seats: this.room.seats.map((seat) =>
          seat.seatIndex === 1 && !seat.user
            ? { seatIndex: 1, user: { id: 'u_001', nickname: '游客' }, isReady: false, isOwner: false }
            : seat,
        ),
      };
      this.rooms.set(roomId, cloneRoom(this.room));
      return cloneRoom(this.room) as T;
    }

    if (path === ApiRoutes.addAi(this.room.roomId)) {
      const seatIndex =
        typeof data === 'object' && data !== null && 'seatIndex' in data
          ? Number((data as { seatIndex?: unknown }).seatIndex)
          : 1;
      this.room = {
        ...this.room,
        seats: this.room.seats.map((seat) =>
          seat.seatIndex === seatIndex
            ? {
                ...seat,
                user: { id: `ai_${seatIndex}`, nickname: `AI ${seatIndex}` },
                isAI: true,
                isReady: true,
              }
            : seat,
        ),
      };
      this.rooms.set(this.room.roomId, cloneRoom(this.room));
      return cloneRoom(this.room) as T;
    }

    if (path === ApiRoutes.startGame(this.room.roomId)) {
      return { roomId: this.room.roomId, gameId: mockGameView.gameId } as T;
    }

    if (path === ApiRoutes.room(this.room.roomId)) {
      return cloneRoom(this.room) as T;
    }

    if (path === ApiRoutes.gameView(mockGameView.gameId)) {
      return mockGameView as T;
    }

    if (path === ApiRoutes.gameView(mockFinishedGameView.gameId)) {
      return mockFinishedGameView as PlayerGameView as T;
    }

    if (path === ApiRoutes.replays) {
      return [{ gameId: mockReplay.gameId, roomId: mockReplay.roomId, title: '曲靖飞小鸡 Mock 牌谱' }] as T;
    }

    if (path === ApiRoutes.replay(mockReplay.gameId)) {
      return mockReplay as T;
    }

    throw new Error(`Mock HTTP 未配置: ${method} ${path}`);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, 'GET');
  }

  post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, 'POST', data);
  }
}
