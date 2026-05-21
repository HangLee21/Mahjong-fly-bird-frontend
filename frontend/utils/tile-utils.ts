import { XIAO_JI_TILE_ID } from '../config/constants';
import type { TileId, TileMeta, TileSuit } from '../types/tile.types';

const SUITS: Array<{ suit: TileSuit; suffix: string; offset: number }> = [
  { suit: 'wan', suffix: '万', offset: 0 },
  { suit: 'tong', suffix: '筒', offset: 9 },
  { suit: 'tiao', suffix: '条', offset: 18 },
];

const HONORS = ['东', '南', '西', '北', '中', '发', '白'];

export function getTileMeta(tile: TileId): TileMeta {
  if (tile >= 0 && tile < 27) {
    const group = SUITS[Math.floor(tile / 9)];
    const rank = tile - group.offset + 1;
    return {
      id: tile,
      label: `${rank}${group.suffix}`,
      suit: group.suit,
      rank,
      isXiaoJi: tile === XIAO_JI_TILE_ID,
    };
  }
  const honorIndex = tile - 27;
  const label = HONORS[honorIndex] || `牌${tile}`;
  return {
    id: tile,
    label,
    suit: honorIndex < 4 ? 'wind' : 'dragon',
  };
}

export function getTileLabel(tile: TileId): string {
  return getTileMeta(tile).label;
}

export function getTileImage(tile: TileId): string {
  return `/assets/tiles/tile_${tile}.png`;
}

export function isXiaoJi(tile: TileId): boolean {
  return tile === XIAO_JI_TILE_ID;
}

export function sortTiles(tiles: TileId[]): TileId[] {
  return [...tiles].sort((a, b) => a - b);
}

export function getTileClass(tile: TileId): string {
  const meta = getTileMeta(tile);
  return `tile-${meta.suit}${meta.isXiaoJi ? ' tile-xiaoji' : ''}`;
}
