import { XIAO_JI_TILE_ID } from '../app/Constants';
import type { LocalSeatPosition, TileId } from '../game/GameTypes';

const HONORS = ['东', '南', '西', '北', '中', '发', '白'];

export function getTileLabel(tile: TileId): string {
  if (tile < 9) return `${tile + 1}万`;
  if (tile < 18) return `${tile - 8}筒`;
  if (tile < 27) return `${tile - 17}条`;
  return HONORS[tile - 27] || `牌${tile}`;
}

export function isXiaoJi(tile: TileId): boolean {
  return tile === XIAO_JI_TILE_ID;
}

export function sortTiles(tiles: TileId[]): TileId[] {
  return [...tiles].sort((a, b) => a - b);
}

export function mapSeatToLocalPosition(selfIndex: number, targetIndex: number): LocalSeatPosition {
  const diff = (targetIndex - selfIndex + 4) % 4;
  if (diff === 0) return 'bottom';
  if (diff === 1) return 'right';
  if (diff === 2) return 'top';
  return 'left';
}
