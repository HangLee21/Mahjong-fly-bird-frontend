import type { ClientAction, GameAction, PlayerGameView, TileId } from './GameTypes';

const XIAO_JI_TILE_ID = 18;

export function buildClientAction(view: PlayerGameView, action: GameAction): ClientAction {
  return {
    ...action,
    clientSeq: view.stepIndex,
  };
}

export function findDiscardAction(view: PlayerGameView, tile: TileId): GameAction | null {
  const legalAction = view.legalActions.find((action) => action.type === 'DISCARD' && action.tile === tile);
  if (legalAction) return legalAction;
  if (view.legalActions.length === 0 && view.currentPlayer === view.playerIndex && view.self.hand.includes(tile)) {
    return { type: 'DISCARD', tile, actionId: tile };
  }
  return null;
}

export function getActionPreviewTiles(action: GameAction): TileId[] {
  if (action.tile === undefined) return [];
  if (action.type === 'CHOW_LEFT') return [action.tile, action.tile + 1, action.tile + 2];
  if (action.type === 'CHOW_MIDDLE') return [action.tile - 1, action.tile, action.tile + 1];
  if (action.type === 'CHOW_RIGHT') return [action.tile - 2, action.tile - 1, action.tile];
  if (action.type === 'PONG') return [action.tile, action.tile, action.tile];
  if (action.type === 'KONG_EXPOSED' || action.type === 'KONG_CONCEALED' || action.type === 'KONG_ADDED') {
    return [action.tile, action.tile, action.tile, action.tile];
  }
  return [];
}

/**
 * Returns the tiles that will actually form a kong meld for the given hand,
 * mirroring the backend composition rules:
 * - concealed kong: all four tiles come from hand, chicks substitute freely
 *   (rulebook 2.5 allows any number of chicks);
 * - exposed kong: two real tiles in hand + the discarded tile + one chick;
 * - added kong: the single tile (or chick) added to an existing pong meld.
 */
export function getKongPreviewTiles(action: GameAction, hand: TileId[], wildActive: boolean): TileId[] {
  const tile = action.tile;
  if (tile === undefined) return [];

  const counts = new Map<TileId, number>();
  hand.forEach((handTile) => counts.set(handTile, (counts.get(handTile) ?? 0) + 1));
  const realCount = counts.get(tile) ?? 0;
  const chickCount = counts.get(XIAO_JI_TILE_ID) ?? 0;

  if (action.type === 'KONG_CONCEALED') {
    if (realCount >= 4 || !wildActive) return [tile, tile, tile, tile];
    const wildUsed = Math.min(4 - realCount, chickCount);
    return [
      ...Array.from({ length: realCount }, () => tile),
      ...Array.from({ length: wildUsed }, () => XIAO_JI_TILE_ID),
    ];
  }

  if (action.type === 'KONG_EXPOSED') {
    if (realCount >= 3 || !wildActive) return [tile, tile, tile, tile];
    // 2 real + the discard + 1 chick (rulebook 2.5: hand must satisfy pong first).
    return realCount >= 2 && chickCount > 0
      ? [tile, tile, tile, XIAO_JI_TILE_ID]
      : [tile, tile, tile, tile];
  }

  if (action.type === 'KONG_ADDED') {
    const usesWild = realCount === 0 && wildActive && chickCount > 0;
    return [usesWild ? XIAO_JI_TILE_ID : tile];
  }

  return getActionPreviewTiles(action);
}
