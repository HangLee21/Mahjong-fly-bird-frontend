export type TileId = number;

export type GameStatus = 'INIT' | 'PLAYING' | 'WAITING_RESPONSE' | 'FINISHED' | 'DRAW';

export type ActionType =
  | 'DISCARD'
  | 'PASS'
  | 'WIN'
  | 'PONG'
  | 'CHOW_LEFT'
  | 'CHOW_MIDDLE'
  | 'CHOW_RIGHT'
  | 'KONG_EXPOSED'
  | 'KONG_CONCEALED'
  | 'KONG_ADDED'
  | 'SELECT_KONG_TILE';

export interface GameAction {
  type: ActionType;
  tile?: TileId;
  actionId: number;
  extra?: Record<string, unknown>;
}

export interface ClientAction extends GameAction {
  clientSeq: number;
}

export type MeldType = 'CHOW' | 'PONG' | 'KONG_EXPOSED' | 'KONG_CONCEALED' | 'KONG_ADDED';

export interface Meld {
  type: MeldType;
  tiles: TileId[];
  /** Index in `tiles` of the tile claimed from another player's discard. */
  claimedIndex?: number;
  fromPlayer?: number;
  stepIndex: number;
  containsXiaoJiAsWild?: boolean;
}

export interface PlayerPublicView {
  seatIndex: number;
  handCount: number;
  melds: Meld[];
  discards: TileId[];
  status: string;
  isAI?: boolean;
  nickname?: string;
  avatarUrl?: string;
}

export interface FanItem {
  code: string;
  name: string;
  fan?: number;
  points: number;
  description?: string;
}

export interface ScoreResult {
  winnerIndexes: number[];
  loserIndexes: number[];
  dealer: number;
  isSelfDraw: boolean;
  isDraw?: boolean;
  baseScore: number;
  cappedFan?: number;
  fanItems: FanItem[];
  scoreDelta: number[];
  title: string;
  description?: string;
}

export interface GameEvent {
  id?: string;
  type: string;
  playerIndex?: number;
  tile?: TileId;
  message?: string;
  stepIndex?: number;
  ts?: number;
}

export interface PlayerGameView {
  roomId: string;
  gameId: string;
  ruleVersion?: string;
  playerIndex: number;
  status: GameStatus;
  stepIndex: number;
  dealer: number;
  currentPlayer: number;
  roundIndex?: number;
  currentRound?: number;
  maxRounds?: number;
  isFinalRound?: boolean;
  scores: number[];
  totalScores?: number[];
  wallCount?: number;
  wallTilesRemaining: number;
  publicKongTiles: TileId[];
  xiaoJiActiveAsWild: boolean;
  restrictions?: string[];
  self: {
    seatIndex?: number;
    userId?: string;
    nickname?: string;
    avatarUrl?: string;
    isAI?: boolean;
    handCount?: number;
    hand: TileId[];
    melds: Meld[];
    discards: TileId[];
    status?: string;
    legalActions?: GameAction[];
  };
  players?: PlayerPublicView[];
  opponents: PlayerPublicView[];
  lastDiscard?: {
    tile: TileId;
    fromPlayer: number;
  };
  legalActions: GameAction[];
  result?: ScoreResult;
}

export type LocalSeatPosition = 'bottom' | 'right' | 'top' | 'left';
