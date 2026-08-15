import { planGameAudioCues } from '../assets/scripts/game/GameAudioPlanner';
import type { Meld, PlayerGameView, PlayerPublicView } from '../assets/scripts/game/GameTypes';

function view(overrides: Partial<PlayerGameView> = {}): PlayerGameView {
  const self = overrides.self ?? { hand: [], melds: [], discards: [] };
  return {
    roomId: '123456',
    gameId: 'game-1',
    playerIndex: 0,
    status: 'PLAYING',
    stepIndex: 1,
    dealer: 0,
    currentPlayer: 0,
    scores: [0, 0, 0, 0],
    wallTilesRemaining: 80,
    publicKongTiles: [],
    xiaoJiActiveAsWild: false,
    self,
    opponents: overrides.opponents ?? [],
    legalActions: [],
    ...overrides,
  };
}

function opponent(seatIndex: number, discards: number[] = [], melds: Meld[] = []): PlayerPublicView {
  return { seatIndex, handCount: 13, melds, discards, status: 'PLAYING' };
}

describe('planGameAudioCues', () => {
  it('announces a normal discard', () => {
    const previous = view({ opponents: [opponent(1)] });
    const current = view({
      stepIndex: 2,
      opponents: [opponent(1, [5])],
      lastDiscard: { tile: 5, fromPlayer: 1 },
    });
    expect(planGameAudioCues(previous, current)).toEqual([
      { kind: 'DISCARD', tile: 5, seatIndex: 1, stepIndex: 2 },
    ]);
  });

  it('keeps both pong and the following discard when one snapshot contains both', () => {
    const pong: Meld = { type: 'PONG', tiles: [3, 3, 3], stepIndex: 2 };
    const previous = view({ opponents: [opponent(1)] });
    const current = view({
      stepIndex: 3,
      opponents: [opponent(1, [9], [pong])],
      lastDiscard: { tile: 9, fromPlayer: 1 },
    });
    expect(planGameAudioCues(previous, current)).toEqual([
      { kind: 'MELD', meldType: 'PONG', seatIndex: 1, stepIndex: 2 },
      { kind: 'DISCARD', tile: 9, seatIndex: 1, stepIndex: 3 },
    ]);
  });

  it('does not mistake the claimed discard for a new discard', () => {
    const pong: Meld = { type: 'PONG', tiles: [3, 3, 3], stepIndex: 2 };
    const previous = view({
      opponents: [opponent(1, [3])],
      lastDiscard: { tile: 3, fromPlayer: 1 },
    });
    const current = view({
      stepIndex: 2,
      opponents: [opponent(1, [3]), opponent(2, [], [pong])],
      lastDiscard: { tile: 3, fromPlayer: 1 },
    });
    expect(planGameAudioCues(previous, current)).toEqual([
      { kind: 'MELD', meldType: 'PONG', seatIndex: 2, stepIndex: 2 },
    ]);
  });

  it('does not replay an unchanged state', () => {
    const state = view({ stepIndex: 4, opponents: [opponent(1, [5])] });
    expect(planGameAudioCues(state, state)).toEqual([]);
  });
});
