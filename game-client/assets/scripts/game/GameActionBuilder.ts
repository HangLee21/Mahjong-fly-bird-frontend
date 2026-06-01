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
  if (view.currentPlayer === view.playerIndex && view.self.hand.includes(tile)) {
    return { type: 'DISCARD', tile, actionId: tile };
  }
  return null;
}
