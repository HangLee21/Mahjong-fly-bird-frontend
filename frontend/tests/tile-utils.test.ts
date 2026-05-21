import { getTileLabel, isXiaoJi, sortTiles } from '../utils/tile-utils';

test('maps tile labels', () => {
  expect(getTileLabel(0)).toBe('1万');
  expect(getTileLabel(18)).toBe('1条');
  expect(isXiaoJi(18)).toBe(true);
});

test('sorts tiles by id', () => {
  expect(sortTiles([18, 0, 9])).toEqual([0, 9, 18]);
});
