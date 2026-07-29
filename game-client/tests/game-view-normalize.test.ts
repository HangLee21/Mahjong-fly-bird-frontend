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

import {
  extractGameView,
  GameManager,
  getAiDiscardPresentationSeat,
  getDisplayedScores,
  normalizeGameView,
} from '../assets/scripts/game/GameManager';
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

describe('displayed scores', () => {
  it('uses cumulative totalScores when the backend provides them', () => {
    const view = normalizeGameView({
      ...backendView,
      scores: [6, -2, -2, -2],
      totalScores: [30, -10, -10, -10],
    });

    expect(getDisplayedScores(view)).toEqual([30, -10, -10, -10]);
  });

  it('falls back to scores for older backend responses', () => {
    const view = normalizeGameView({
      ...backendView,
      scores: [6, -2, -2, -2],
      totalScores: undefined,
    });

    expect(getDisplayedScores(view)).toEqual([6, -2, -2, -2]);
  });
});

describe('AI discard presentation delay', () => {
  const createAiDiscardViews = (): [PlayerGameView, PlayerGameView] => {
    const previous = normalizeGameView(JSON.parse(JSON.stringify(backendView)) as PlayerGameView);
    previous.currentPlayer = 1;
    const next = JSON.parse(JSON.stringify(previous)) as PlayerGameView;
    next.currentPlayer = 2;
    next.stepIndex += 1;
    next.lastDiscard = { tile: 22, fromPlayer: 1 };
    next.opponents[0].discards = [...next.opponents[0].discards, 22];
    if (next.players) next.players[0].discards = [...next.players[0].discards, 22];
    return [previous, next];
  };

  it('recognizes a newly discarded tile from an AI seat', () => {
    const [previous, next] = createAiDiscardViews();
    expect(getAiDiscardPresentationSeat(previous, next)).toBe(1);
  });

  it('holds the AI discard view briefly before publishing it', () => {
    jest.useFakeTimers();
    const [previous, next] = createAiDiscardViews();
    const manager = new GameManager();

    manager.setView(previous);
    manager.setView(next);

    expect(manager.currentView?.stepIndex).toBe(previous.stepIndex);
    expect(manager.presentationAiSeat).toBe(1);

    jest.advanceTimersByTime(520);

    expect(manager.currentView?.stepIndex).toBe(next.stepIndex);
    expect(manager.presentationAiSeat).toBeNull();
    jest.useRealTimers();
  });

  it('does not let a duplicate old snapshot overtake the delayed AI view', () => {
    jest.useFakeTimers();
    const [previous, next] = createAiDiscardViews();
    const manager = new GameManager();

    manager.setView(previous);
    manager.setView(next);
    manager.setView(previous);
    jest.advanceTimersByTime(520);

    expect(manager.currentView?.stepIndex).toBe(next.stepIndex);
    jest.useRealTimers();
  });
});
