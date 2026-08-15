import type { PlayerGameView } from '../game/GameTypes';
import type { RoomView } from '../room/RoomTypes';
import type { ReplayRecord } from '../replay/ReplayTypes';

export const mockRoom: RoomView = {
  roomId: '886688',
  ownerId: 'u_001',
  status: 'WAITING',
  gameId: undefined,
  rules: {
    preset: 'qujing-fei-xiaoji-v1.5',
    roundCount: 16,
    allowChow: true,
    allowPong: true,
    xiaoJiWildEnabled: true,
    fanCap: 3,
    publicKongTiles: 2,
    xiaoJiTile: '1-tiao',
    drawMode: 'fixed-wall-reserve',
    allowMultiWin: true,
  },
  seats: [
    { seatIndex: 0, user: { id: 'u_001', nickname: '玩家一' }, isReady: true, isOwner: true },
    { seatIndex: 1, isReady: false },
    { seatIndex: 2, isReady: false },
    { seatIndex: 3, isReady: false },
  ],
};

export const mockGameView: PlayerGameView = {
  roomId: mockRoom.roomId,
  gameId: 'game_mock_001',
  playerIndex: 0,
  ruleVersion: 'qujing-fei-xiaoji-v1.5',
  status: 'PLAYING',
  stepIndex: 18,
  dealer: 0,
  currentPlayer: 0,
  roundIndex: 0,
  currentRound: 1,
  maxRounds: 16,
  isFinalRound: false,
  scores: [0, 0, 0, 0],
  totalScores: [0, 0, 0, 0],
  wallCount: 72,
  wallTilesRemaining: 72,
  publicKongTiles: [13, 31],
  xiaoJiActiveAsWild: true,
  self: {
    seatIndex: 0,
    userId: 'u_001',
    isAI: false,
    handCount: 14,
    hand: [0, 1, 2, 4, 4, 7, 9, 12, 18, 18, 24, 27, 31, 31],
    melds: [],
    discards: [3, 8, 28],
    status: 'ACTIVE',
    legalActions: [],
  },
  players: [
    { seatIndex: 1, handCount: 13, melds: [], discards: [1, 11, 32], status: 'WAITING', isAI: true, nickname: 'AI 东山' },
    { seatIndex: 2, handCount: 13, melds: [], discards: [19, 20, 33], status: 'WAITING', isAI: true, nickname: 'AI 南盘' },
    { seatIndex: 3, handCount: 13, melds: [], discards: [6, 14, 21], status: 'WAITING', isAI: true, nickname: 'AI 西桥' },
  ],
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
    { type: 'WIN', tile: 31, actionId: 301 },
    { type: 'PASS', actionId: 1 },
  ],
};

export const mockFinishedGameView: PlayerGameView = {
  ...mockGameView,
  status: 'FINISHED',
  legalActions: [],
  result: {
    winnerIndexes: [0],
    loserIndexes: [1, 2, 3],
    dealer: 0,
    isSelfDraw: true,
    baseScore: 1,
    cappedFan: 3,
    fanItems: [
      { code: 'MEN_QING_ZI_MO', name: '门清自摸', fan: 1, points: 2 },
      { code: 'NO_XIAO_JI_WILD', name: '无鸡', fan: 1, points: 2 },
      { code: 'KONG_FLOWER', name: '杠上开花', fan: 1, points: 2 },
    ],
    scoreDelta: [24, -8, -8, -8],
    title: '自摸胡牌',
    description: 'Mock 结算用于验证 Result 场景和番型展示。',
  },
};

export function mockGameEvents(actionType: string) {
  return [
    {
      id: `mock_event_${mockGameView.stepIndex}`,
      type: actionType,
      playerIndex: 0,
      message: `玩家一执行 ${actionType}`,
      stepIndex: mockGameView.stepIndex,
      ts: Date.now(),
    },
  ];
}

export const mockReplay: ReplayRecord = {
  roomId: mockRoom.roomId,
  gameId: mockGameView.gameId,
  title: '曲靖飞小鸡 Mock 牌谱',
  steps: [
    { stepIndex: 18, view: mockGameView, events: mockGameEvents('DISCARD') },
    { stepIndex: 19, view: mockFinishedGameView, events: mockGameEvents('WIN') },
  ],
};
