import type { ClientAction, GameAction, PlayerGameView, TileId } from './GameTypes';

export function buildClientAction(view: PlayerGameView, action: GameAction): ClientAction {
  return {
    ...action,
    clientSeq: view.stepIndex,
  };
}

export function findDiscardAction(view: PlayerGameView, tile: TileId): GameAction | null {
  return view.legalActions.find((action) => action.type === 'DISCARD' && action.tile === tile) || null;
}
