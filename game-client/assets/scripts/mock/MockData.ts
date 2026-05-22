import type { PlayerGameView } from '../game/GameTypes';
import type { RoomView } from '../room/RoomTypes';

export const mockRoom: RoomView = {
  roomId: '886688',
  ownerId: 'u_001',
  status: 'WAITING',
  gameId: undefined,
  rules: {
    preset: 'qujing-fei-xiao-ji-v1.5',
    allowChow: true,
    fanCap: 3,
    publicKongTiles: 2,
    xiaoJiTile: '1-tiao',
    drawMode: 'fixed-wall-reserve',
    allowMultiWin: true,
  },
  seats: [
    { seatIndex: 0, user: { id: 'u_001', nickname: '玩家一' }, isReady: true, isOwner: true },
    { seatIndex: 1, user: { id: 'ai_1', nickname: 'AI 东山' }, isAI: true, isReady: true },
    { seatIndex: 2, user: { id: 'ai_2', nickname: 'AI 南盘' }, isAI: true, isReady: true },
    { seatIndex: 3, user: { id: 'ai_3', nickname: 'AI 西桥' }, isAI: true, isReady: true },
  ],
};

export const mockGameView: PlayerGameView = {
  roomId: mockRoom.roomId,
  gameId: 'game_mock_001',
  playerIndex: 0,
  status: 'PLAYING',
  stepIndex: 18,
  dealer: 0,
  currentPlayer: 0,
  scores: [0, 0, 0, 0],
  wallTilesRemaining: 72,
  publicKongTiles: [13, 31],
  xiaoJiActiveAsWild: true,
  self: {
    hand: [0, 1, 2, 4, 4, 7, 9, 12, 18, 18, 24, 27, 31, 31],
    melds: [],
    discards: [3, 8, 28],
  },
  opponents: [
    { seatIndex: 1, handCount: 13, melds: [], discards: [1, 11, 32], status: 'WAITING', isAI: true, nickname: 'AI 东山' },
    { seatIndex: 2, handCount: 13, melds: [], discards: [19, 20, 33], status: 'WAITING', isAI: true, nickname: 'AI 南盘' },
    { seatIndex: 3, handCount: 13, melds: [], discards: [6, 14, 21], status: 'WAITING', isAI: true, nickname: 'AI 西桥' },
  ],
  lastDiscard: { tile: 21, fromPlayer: 3 },
  legalActions: [
    { type: 'DISCARD', tile: 0, actionId: 101 },
    { type: 'DISCARD', tile: 1, actionId: 102 },
    { type: 'DISCARD', tile: 18, actionId: 103 },
    { type: 'KONG_CONCEALED', tile: 31, actionId: 201 },
    { type: 'PASS', actionId: 1 },
  ],
};
