import { getTileLabel, isXiaoJi, mapSeatToLocalPosition, sortTiles } from '../assets/scripts/utils/TileUtils';

test('maps tiles for qujing mahjong', () => {
  expect(getTileLabel(0)).toBe('1万');
  expect(getTileLabel(18)).toBe('1条');
  expect(isXiaoJi(18)).toBe(true);
});

test('sorts tiles with the xiaoji chick first', () => {
  expect(sortTiles([18, 0, 9])).toEqual([18, 0, 9]);
  expect(sortTiles([19, 18, 0, 9, 27])).toEqual([18, 0, 9, 19, 27]);
});

test('maps seats to local positions', () => {
  expect(mapSeatToLocalPosition(0, 0)).toBe('bottom');
  expect(mapSeatToLocalPosition(0, 1)).toBe('right');
  expect(mapSeatToLocalPosition(0, 2)).toBe('top');
  expect(mapSeatToLocalPosition(0, 3)).toBe('left');
});
