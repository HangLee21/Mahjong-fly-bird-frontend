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

  connect(): void {
    this.setStatus('CONNECTED');
  }

  disconnect(): void {
    this.setStatus('DISCONNECTED');
  }

  send<T>(message: WsMessage<T>): void {
    if (message.type === 'ROOM_SUBSCRIBE') {
      this.dispatch({ type: 'ROOM_UPDATE', roomId: this.roomId || mockRoom.roomId, payload: { room: mockRoom } });
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
        payload: { view: this.buildViewAfterAction(action) },
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

  private buildViewAfterAction(action: GameAction | undefined): PlayerGameView {
    if (!action) return mockGameView;
    if (action.type === 'WIN') return mockFinishedGameView;

    if (action.type === 'DISCARD' && action.tile !== undefined) {
      const nextHand = removeFirst(mockGameView.self.hand, action.tile);
      return {
        ...mockGameView,
        stepIndex: mockGameView.stepIndex + 1,
        currentPlayer: 1,
        self: {
          ...mockGameView.self,
          hand: nextHand,
          discards: [...mockGameView.self.discards, action.tile],
        },
        lastDiscard: { tile: action.tile, fromPlayer: mockGameView.playerIndex },
        legalActions: [{ type: 'PASS', actionId: 401 }],
      };
    }

    if (action.type.startsWith('KONG')) {
      return {
        ...mockGameView,
        stepIndex: mockGameView.stepIndex + 1,
        restrictions: ['杠后必须从公开杠牌选择一张补入手牌'],
        legalActions: mockGameView.publicKongTiles.map((tile, index) => ({
          type: 'SELECT_KONG_TILE',
          tile,
          actionId: 500 + index,
        })),
      };
    }

    if (action.type === 'SELECT_KONG_TILE' && action.tile !== undefined) {
      return {
        ...mockGameView,
        stepIndex: mockGameView.stepIndex + 2,
        self: {
          ...mockGameView.self,
          hand: [...mockGameView.self.hand, action.tile],
        },
        publicKongTiles: replaceFirst(mockGameView.publicKongTiles, action.tile, 5),
      };
    }

    return mockGameView;
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
