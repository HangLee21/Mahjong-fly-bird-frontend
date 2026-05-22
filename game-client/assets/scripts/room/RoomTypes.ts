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
}

export interface RoomRules {
  preset: 'qujing-fei-xiao-ji-v1.5';
  allowChow: boolean;
  fanCap: number;
  publicKongTiles: 2;
  xiaoJiTile: '1-tiao';
  drawMode: 'fixed-wall-reserve' | 'kong-count-threshold';
  allowMultiWin: boolean;
}

export interface RoomView {
  roomId: string;
  ownerId: string;
  status: RoomStatus;
  seats: RoomSeat[];
  rules: RoomRules;
  gameId?: string;
}
