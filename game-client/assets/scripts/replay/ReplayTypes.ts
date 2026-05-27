import type { GameEvent, PlayerGameView } from '../game/GameTypes';

export interface ReplayStep {
  stepIndex: number;
  view: PlayerGameView;
  events: GameEvent[];
}

export interface ReplayRecord {
  roomId: string;
  gameId: string;
  title: string;
  steps: ReplayStep[];
}

export interface ReplayListItem {
  gameId: string;
  roomId: string;
  title: string;
}
