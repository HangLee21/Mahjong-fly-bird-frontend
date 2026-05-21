import type { GameEvent, PlayerGameView, ScoreResult } from './game.types';

export interface ReplaySummary {
  gameId: string;
  roomId: string;
  finishedAt: number;
  title: string;
  result?: ScoreResult;
}

export interface ReplayStep {
  stepIndex: number;
  view: PlayerGameView;
  events: GameEvent[];
}

export interface ReplayDetail extends ReplaySummary {
  steps: ReplayStep[];
}
