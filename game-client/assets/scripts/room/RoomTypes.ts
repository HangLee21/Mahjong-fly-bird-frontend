export interface User {
  id: string;
  nickname: string;
  avatarUrl?: string;
}

export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export interface RoomSeat {
  seatIndex: number;
  user?: User;
  isAI?: boolean;
  isReady: boolean;
  isOwner?: boolean;
  status?: string;
  occupied?: boolean;
}

export interface RoomRules {
  preset: 'qujing-fei-xiaoji-v1.5';
  roundCount: 8 | 16 | 24 | 32;
  allowChow: boolean;
  allowPong: boolean;
  xiaoJiWildEnabled: boolean;
  fanCap: number;
  publicKongTiles: 2 | 4;
  xiaoJiTile: '1-tiao';
  drawMode: 'fixed-wall-reserve' | 'kong-count-threshold';
  allowMultiWin: boolean;
}

export interface RoomView {
  roomId: string;
  internalRoomId?: string;
  ownerId: string;
  status: RoomStatus;
  seats: RoomSeat[];
  rules: RoomRules;
  gameId?: string;
}

export interface RoomPreview {
  exists: boolean;
  roomId: string;
  status?: RoomStatus;
  seatCount?: number;
  maxSeats?: number;
  canJoin: boolean;
  ownerNickname?: string;
  rules?: Partial<RoomRules>;
  message?: string;
}
