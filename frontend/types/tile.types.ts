export type TileId = number;

export type TileSuit = 'wan' | 'tong' | 'tiao' | 'wind' | 'dragon';

export interface TileMeta {
  id: TileId;
  label: string;
  suit: TileSuit;
  rank?: number;
  isXiaoJi?: boolean;
}
