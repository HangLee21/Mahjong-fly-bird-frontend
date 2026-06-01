jest.mock(
  'cc',
  () => ({
    EventTarget: class {
      on(): void {}
      off(): void {}
      emit(): void {}
    },
  }),
  { virtual: true },
);

import { extractGameView, normalizeGameView } from '../assets/scripts/game/GameManager';
import type { PlayerGameView } from '../assets/scripts/game/GameTypes';

const backendView = {
  roomId: '886688',
  gameId: 'game_001',
  ruleVersion: 'qujing-fei-xiaoji-v1.5',
  status: 'PLAYING',
  currentPlayer: 0,
  dealer: 0,
  roundIndex: 0,
  stepIndex: 18,
  scores: [0, 0, 0, 0],
  totalScores: [0, 0, 0, 0],
  currentRound: 1,
  maxRounds: 16,
  isFinalRound: false,
  wallCount: 72,
  wallTilesRemaining: 72,
  publicKongTiles: [13, 31],
  xiaoJiActiveAsWild: true,
  self: {
    seatIndex: 0,
    userId: 'u_001',
    isAI: false,
    handCount: 14,
    hand: [0, 1, 18],
    melds: [],
    discards: [],
    status: 'ACTIVE',
    legalActions: [{ type: 'DISCARD', tile: 18, actionId: 18 }],
  },
  players: [
    { seatIndex: 1, userId: null, isAI: true, handCount: 13, melds: [], discards: [21], status: 'ACTIVE' },
    { seatIndex: 2, userId: null, isAI: true, handCount: 13, melds: [], discards: [], status: 'ACTIVE' },
    { seatIndex: 3, userId: null, isAI: true, handCount: 13, melds: [], discards: [], status: 'ACTIVE' },
  ],
  legalActions: [],
  result: null,
} as unknown as PlayerGameView;

describe('normalizeGameView', () => {
  it('maps backend players and self legalActions into the client view shape', () => {
    const view = normalizeGameView(backendView);

    expect(view.playerIndex).toBe(0);
    expect(view.opponents).toHaveLength(3);
    expect(view.legalActions).toEqual([{ type: 'DISCARD', tile: 18, actionId: 18 }]);
    expect(view.self.handCount).toBe(14);
  });
});

describe('extractGameView', () => {
  it('accepts both wrapped and direct GAME_VIEW payloads', () => {
    expect(extractGameView({ type: 'GAME_VIEW', payload: { view: backendView } })?.gameId).toBe('game_001');
    expect(extractGameView({ type: 'GAME_VIEW', payload: backendView })?.gameId).toBe('game_001');
  });
});
