import type { ClientAction, GameAction, PlayerGameView, TileId } from './GameTypes';

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
