import { buildClientAction, findDiscardAction, getActionPreviewTiles } from '../assets/scripts/game/GameActionBuilder';
import { mockGameView } from '../assets/scripts/mock/MockData';

test('finds discard action from backend legal actions', () => {
  expect(findDiscardAction(mockGameView, 18)?.actionId).toBe(103);
  expect(findDiscardAction(mockGameView, 33)).toBeNull();
});

test('builds fallback discard action on self turn when backend omits discard actions', () => {
  const view = {
    ...mockGameView,
    currentPlayer: mockGameView.playerIndex,
    legalActions: [],
  };
  expect(findDiscardAction(view, 18)).toEqual({ type: 'DISCARD', tile: 18, actionId: 18 });
});

test('builds client action with current step index', () => {
  const action = buildClientAction(mockGameView, mockGameView.legalActions[0]);
  expect(action.clientSeq).toBe(mockGameView.stepIndex);
});

test('builds readable chow, pong, and kong previews', () => {
  expect(getActionPreviewTiles({ type: 'CHOW_LEFT', tile: 0, actionId: 103 })).toEqual([0, 1, 2]);
  expect(getActionPreviewTiles({ type: 'CHOW_MIDDLE', tile: 2, actionId: 104 })).toEqual([1, 2, 3]);
  expect(getActionPreviewTiles({ type: 'CHOW_RIGHT', tile: 3, actionId: 105 })).toEqual([1, 2, 3]);
  expect(getActionPreviewTiles({ type: 'PONG', tile: 8, actionId: 102 })).toEqual([8, 8, 8]);
  expect(getActionPreviewTiles({ type: 'KONG_EXPOSED', tile: 12, actionId: 106 })).toEqual([12, 12, 12, 12]);
});

test('does not build fallback discard while another backend action is pending', () => {
  const view = {
    ...mockGameView,
    currentPlayer: mockGameView.playerIndex,
    legalActions: [{ type: 'PONG' as const, tile: 18, actionId: 102 }],
  };
  expect(findDiscardAction(view, 18)).toBeNull();
});
