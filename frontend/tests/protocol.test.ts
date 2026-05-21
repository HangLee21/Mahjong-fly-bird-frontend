import type { ActionType } from '../types/game.types';

test('keeps backend action names stable', () => {
  const actions: ActionType[] = ['DISCARD', 'PASS', 'WIN', 'PONG', 'KONG_CONCEALED', 'SELECT_KONG_TILE'];
  expect(actions).toContain('DISCARD');
  expect(actions).toContain('SELECT_KONG_TILE');
});
