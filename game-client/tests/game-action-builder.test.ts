import { buildClientAction, findDiscardAction } from '../assets/scripts/game/GameActionBuilder';
import { mockGameView } from '../assets/scripts/mock/MockData';

test('finds discard action from backend legal actions', () => {
  expect(findDiscardAction(mockGameView, 18)?.actionId).toBe(103);
  expect(findDiscardAction(mockGameView, 33)).toBeNull();
});

test('builds client action with current step index', () => {
  const action = buildClientAction(mockGameView, mockGameView.legalActions[0]);
  expect(action.clientSeq).toBe(mockGameView.stepIndex);
});
