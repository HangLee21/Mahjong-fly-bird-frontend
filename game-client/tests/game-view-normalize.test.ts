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
  AI_ACTION_PRESENTATION_DELAY_MS,
  extractGameView,
  findNewDrawIndex,
  GameManager,
  getAiDiscardPresentationSeat,
  getAiMeldPresentationSeat,
  getDisplayedScores,
  normalizeGameView,
  OPENING_INTERACTION_LOCK_MS,
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

describe('new draw identity', () => {
  it('highlights only one index when drawing a duplicate tile', () => {
    expect(findNewDrawIndex([0, 0, 2, 5], [0, 0, 0, 2, 5])).toBe(2);
  });

  it('does not invent a draw index for a meld-sized hand change', () => {
    expect(findNewDrawIndex([0, 1, 2, 3], [0, 3])).toBeNull();
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

  it('uses only a short visual buffer because backend AI actions are paced', () => {
    expect(AI_ACTION_PRESENTATION_DELAY_MS).toBeGreaterThanOrEqual(250);
    expect(AI_ACTION_PRESENTATION_DELAY_MS).toBeLessThanOrEqual(400);
  });

  it('keeps gameplay locked until the opening deal animation has settled', () => {
    expect(OPENING_INTERACTION_LOCK_MS).toBeGreaterThanOrEqual(1000);
  });

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

    jest.advanceTimersByTime(AI_ACTION_PRESENTATION_DELAY_MS);

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
    jest.advanceTimersByTime(AI_ACTION_PRESENTATION_DELAY_MS);

    expect(manager.currentView?.stepIndex).toBe(next.stepIndex);
    jest.useRealTimers();
  });

  it('queues the first AI discard until the opening sequence finishes', () => {
    jest.useFakeTimers();
    const [previous, next] = createAiDiscardViews();
    const manager = new GameManager();

    manager.beginOpeningSequence(previous.gameId);
    manager.setView(previous);
    manager.setView(next);
    manager.beginOpeningSequence(previous.gameId);

    expect(manager.currentView?.stepIndex).toBe(previous.stepIndex);
    expect(manager.snapshot().openingLocked).toBe(true);
    expect(manager.submitting).toBe(true);

    manager.finishOpeningSequence(previous.gameId);

    expect(manager.currentView?.stepIndex).toBe(previous.stepIndex);
    expect(manager.presentationAiSeat).toBe(1);
    expect(manager.snapshot().openingLocked).toBe(false);

    jest.advanceTimersByTime(AI_ACTION_PRESENTATION_DELAY_MS);

    expect(manager.currentView?.stepIndex).toBe(next.stepIndex);
    expect(manager.presentationAiSeat).toBeNull();
    jest.useRealTimers();
  });

  it('publishes consecutive AI discards one at a time after opening', () => {
    jest.useFakeTimers();
    const [initial, first] = createAiDiscardViews();
    const second = JSON.parse(JSON.stringify(first)) as PlayerGameView;
    second.currentPlayer = 3;
    second.stepIndex += 1;
    second.lastDiscard = { tile: 23, fromPlayer: 2 };
    second.opponents[1].discards = [...second.opponents[1].discards, 23];
    if (second.players) second.players[1].discards = [...second.players[1].discards, 23];
    const third = JSON.parse(JSON.stringify(second)) as PlayerGameView;
    third.currentPlayer = 0;
    third.stepIndex += 1;
    third.lastDiscard = { tile: 24, fromPlayer: 3 };
    third.opponents[2].discards = [...third.opponents[2].discards, 24];
    if (third.players) third.players[2].discards = [...third.players[2].discards, 24];
    const manager = new GameManager();

    manager.beginOpeningSequence(initial.gameId);
    [initial, first, second, third].forEach((view) => manager.setView(view));
    manager.finishOpeningSequence(initial.gameId);

    expect(manager.presentationAiSeat).toBe(1);
    jest.advanceTimersByTime(AI_ACTION_PRESENTATION_DELAY_MS);
    expect(manager.currentView?.stepIndex).toBe(first.stepIndex);
    expect(manager.presentationAiSeat).toBe(2);
    jest.advanceTimersByTime(AI_ACTION_PRESENTATION_DELAY_MS);
    expect(manager.currentView?.stepIndex).toBe(second.stepIndex);
    expect(manager.presentationAiSeat).toBe(3);
    jest.advanceTimersByTime(AI_ACTION_PRESENTATION_DELAY_MS);
    expect(manager.currentView?.stepIndex).toBe(third.stepIndex);
    expect(manager.presentationAiSeat).toBeNull();
    jest.useRealTimers();
  });

  it('cancels delayed AI presentation when leaving the game', () => {
    jest.useFakeTimers();
    const [previous, next] = createAiDiscardViews();
    const manager = new GameManager();

    manager.setView(previous);
    manager.setView(next);
    manager.leaveGame();
    jest.advanceTimersByTime(AI_ACTION_PRESENTATION_DELAY_MS);

    expect(manager.currentView).toBeNull();
    expect(manager.presentationAiSeat).toBeNull();
    expect(manager.submitting).toBe(false);
    jest.useRealTimers();
  });

  it('isolates a newly created game from stale snapshots of the previous room', () => {
    const [oldView] = createAiDiscardViews();
    const newView = JSON.parse(JSON.stringify(oldView)) as PlayerGameView;
    newView.gameId = 'game_002';
    newView.roomId = '223344';
    newView.stepIndex = 0;
    const manager = new GameManager();

    manager.setView(oldView);
    manager.leaveGame();
    manager.beginOpeningSequence();
    manager.setView(oldView);

    expect(manager.currentView).toBeNull();
    expect(manager.snapshot().openingLocked).toBe(true);

    manager.beginOpeningSequence(newView.gameId);
    manager.setView(oldView);
    expect(manager.currentView).toBeNull();

    manager.setView(newView);
    expect(manager.currentView?.gameId).toBe(newView.gameId);
    expect(manager.currentView?.roomId).toBe(newView.roomId);
  });
});

describe('AI meld presentation delay', () => {
  it('recognizes a new meld from an AI seat', () => {
    const previous = normalizeGameView(JSON.parse(JSON.stringify(backendView)) as PlayerGameView);
    const next = JSON.parse(JSON.stringify(previous)) as PlayerGameView;
    next.opponents[0].melds = [{ type: 'PONG', tiles: [21, 21, 21], stepIndex: 19 }];
    if (next.players) next.players[0].melds = next.opponents[0].melds;

    expect(getAiMeldPresentationSeat(previous, next)).toBe(1);
  });

  it('ignores melds made by the local player', () => {
    const previous = normalizeGameView(JSON.parse(JSON.stringify(backendView)) as PlayerGameView);
    const next = JSON.parse(JSON.stringify(previous)) as PlayerGameView;
    next.self.melds = [{ type: 'CHOW', tiles: [21, 22, 23], stepIndex: 19 }];

    expect(getAiMeldPresentationSeat(previous, next)).toBeNull();
  });
});
