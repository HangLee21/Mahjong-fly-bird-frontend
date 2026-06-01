import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import type { GameAction, PlayerGameView, TileId } from '../game/GameTypes';
import type { WsMessage, WsStatus } from '../network/Protocol';
import { mockFinishedGameView, mockGameEvents, mockGameView, mockRoom } from './MockData';

type Handler = (message: WsMessage) => void;

export class MockWsClient {
  private listeners = new Map<string, Set<Handler>>();
  private status: WsStatus = 'IDLE';
  private roomId: string | null = null;
  private view: PlayerGameView = cloneView(mockGameView);
  private actionCount = 0;

  connect(): void {
    this.setStatus('CONNECTED');
  }

  disconnect(): void {
    this.setStatus('DISCONNECTED');
  }

  send<T>(message: WsMessage<T>): void {
    if (message.type === 'ROOM_SUBSCRIBE') {
      this.dispatch({ type: 'ROOM_UPDATE', roomId: this.roomId || mockRoom.roomId, payload: { room: mockRoom } });
      this.dispatch({ type: 'GAME_VIEW', roomId: this.roomId || mockRoom.roomId, gameId: this.view.gameId, payload: { view: cloneView(this.view) } });
      return;
    }

    if (message.type === 'PING') {
      this.dispatch({ type: 'PONG' });
      return;
    }

    if (message.type === 'GAME_ACTION') {
      const action = message.payload as GameAction | undefined;
      this.dispatch({
        type: 'GAME_EVENTS',
        roomId: message.roomId,
        gameId: message.gameId,
        payload: { events: mockGameEvents(action?.type || 'DISCARD') },
      });
      this.dispatch({
        type: 'GAME_VIEW',
        roomId: message.roomId,
        gameId: message.gameId,
        payload: { view: this.buildViewAfterAction(action, message.roomId, message.gameId) },
      });
    }
  }

  on(type: string, handler: Handler): void {
    const set = this.listeners.get(type) || new Set<Handler>();
    set.add(handler);
    this.listeners.set(type, set);
  }

  off(type: string, handler: Handler): void {
    this.listeners.get(type)?.delete(handler);
  }

  subscribeRoom(roomId: string): void {
    this.roomId = roomId;
    if (this.status !== 'CONNECTED') this.connect();
    this.send({ type: 'ROOM_SUBSCRIBE', roomId });
  }

  private dispatch(message: WsMessage): void {
    this.listeners.get(message.type)?.forEach((handler) => handler(message));
    this.listeners.get('*')?.forEach((handler) => handler(message));
  }

  private setStatus(status: WsStatus): void {
    this.status = status;
    eventBus.emit(GameEvents.WS_STATUS_CHANGED, status);
  }

  private buildViewAfterAction(action: GameAction | undefined, roomId?: string, gameId?: string): PlayerGameView {
    if (!action) return cloneView(this.view);
    this.actionCount += 1;
    if (action.type === 'WIN') {
      this.view = finishView(this.view, roomId, gameId);
      return cloneView(this.view);
    }

    if (action.type === 'DISCARD' && action.tile !== undefined) {
      const nextHand = removeFirst(this.view.self.hand, action.tile);
      const stepIndex = this.view.stepIndex + 1;
      const aiDiscard = nextAiDiscard(stepIndex);
      const drawnTile = nextDrawTile(stepIndex);
      this.view = {
        ...this.view,
        roomId: roomId || this.view.roomId,
        gameId: gameId || this.view.gameId,
        stepIndex,
        currentPlayer: 1,
        self: {
          ...this.view.self,
          hand: nextHand,
          handCount: nextHand.length,
          discards: [...this.view.self.discards, action.tile],
        },
        opponents: advanceAiDiscards(this.view.opponents, aiDiscard),
        lastDiscard: { tile: aiDiscard, fromPlayer: 1 },
        wallTilesRemaining: Math.max(0, this.view.wallTilesRemaining - 2),
        legalActions: this.nextSelfActions([...nextHand, drawnTile], stepIndex),
      };
      this.view.self.hand = [...nextHand, drawnTile].sort((a, b) => a - b);
      this.view.self.handCount = this.view.self.hand.length;
      this.view.currentPlayer = 0;
      return cloneView(this.view);
    }

    if (action.type.startsWith('KONG')) {
      this.view = {
        ...this.view,
        stepIndex: this.view.stepIndex + 1,
        restrictions: ['杠后必须从公开杠牌选择一张补入手牌'],
        legalActions: this.view.publicKongTiles.map((tile, index) => ({
          type: 'SELECT_KONG_TILE',
          tile,
          actionId: 500 + index,
        })),
      };
      return cloneView(this.view);
    }

    if (action.type === 'SELECT_KONG_TILE' && action.tile !== undefined) {
      const hand = [...this.view.self.hand, action.tile].sort((a, b) => a - b);
      this.view = {
        ...this.view,
        stepIndex: this.view.stepIndex + 2,
        restrictions: [],
        self: {
          ...this.view.self,
          hand,
          handCount: hand.length,
        },
        publicKongTiles: replaceFirst(this.view.publicKongTiles, action.tile, 5),
        legalActions: discardActions(hand, this.view.stepIndex + 2),
      };
      return cloneView(this.view);
    }

    this.view = {
      ...this.view,
      legalActions: discardActions(this.view.self.hand, this.view.stepIndex),
    };
    return cloneView(this.view);
  }

  private nextSelfActions(hand: TileId[], stepIndex: number): GameAction[] {
    if (this.actionCount >= 4) return [{ type: 'WIN', tile: hand[hand.length - 1], actionId: 101 }, { type: 'PASS', actionId: 100 }];
    const actions = discardActions(hand, stepIndex);
    if (this.actionCount === 2) actions.push({ type: 'PONG', tile: 21, actionId: 102 }, { type: 'PASS', actionId: 100 });
    return actions;
  }
}

function removeFirst(tiles: TileId[], tile: TileId): TileId[] {
  const next = [...tiles];
  const index = next.indexOf(tile);
  if (index >= 0) next.splice(index, 1);
  return next;
}

function replaceFirst(tiles: TileId[], from: TileId, to: TileId): TileId[] {
  const next = [...tiles];
  const index = next.indexOf(from);
  if (index >= 0) next[index] = to;
  return next;
}

function discardActions(hand: TileId[], stepIndex: number): GameAction[] {
  return [...new Set(hand)].map((tile, index) => ({ type: 'DISCARD', tile, actionId: tile, extra: { mockStep: stepIndex, order: index } }));
}

function nextDrawTile(stepIndex: number): TileId {
  return [5, 10, 18, 24, 31][stepIndex % 5];
}

function nextAiDiscard(stepIndex: number): TileId {
  return [11, 19, 27, 2, 15, 29][stepIndex % 6];
}

function advanceAiDiscards(players: PlayerGameView['opponents'], tile: TileId): PlayerGameView['opponents'] {
  return players.map((player) =>
    player.seatIndex === 1
      ? { ...player, discards: [...player.discards, tile], handCount: Math.max(0, player.handCount - 1) }
      : player,
  );
}

function finishView(view: PlayerGameView, roomId?: string, gameId?: string): PlayerGameView {
  return {
    ...cloneView(mockFinishedGameView),
    roomId: roomId || view.roomId,
    gameId: gameId || view.gameId,
    stepIndex: view.stepIndex + 1,
    self: { ...view.self, legalActions: [], status: 'WIN' },
    opponents: view.opponents,
    legalActions: [],
    result: {
      ...mockFinishedGameView.result!,
      winnerIndexes: [view.playerIndex],
      loserIndexes: [1, 2, 3],
    },
  };
}

function cloneView(view: PlayerGameView): PlayerGameView {
  return JSON.parse(JSON.stringify(view)) as PlayerGameView;
}
