import { ENV } from '../config/env';
import { mockFinishedView } from './mock/data';
import type { WsMessage } from '../types/ws.types';

type Listener = (msg: WsMessage) => void;

export class WsClient {
  private socket: WechatMiniprogram.SocketTask | null = null;
  private connected = false;
  private token = '';
  private roomId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private pongTimer: number | null = null;
  private listeners = new Map<string, Set<Listener>>();

  connect(token: string): void {
    this.token = token;
    if (ENV.USE_MOCK_WS) {
      this.connected = true;
      this.emit({ type: 'CONNECTED', ts: Date.now() });
      this.startHeartbeat();
      return;
    }
    if (this.connected || this.socket) return;
    this.socket = wx.connectSocket({
      url: `${ENV.WS_BASE_URL}?token=${encodeURIComponent(token)}`,
      success: () => undefined,
    });
    this.socket.onOpen(() => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit({ type: 'CONNECTED', ts: Date.now() });
      if (this.roomId) this.subscribeRoom(this.roomId);
      this.startHeartbeat();
    });
    this.socket.onMessage((event) => this.handleMessage(event.data));
    this.socket.onError(() => this.handleDisconnect('ERROR'));
    this.socket.onClose(() => this.handleDisconnect('DISCONNECTED'));
  }

  disconnect(): void {
    this.clearTimers();
    this.connected = false;
    this.socket?.close({});
    this.socket = null;
    this.emit({ type: 'DISCONNECTED', ts: Date.now() });
  }

  pauseHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.heartbeatTimer = null;
    this.pongTimer = null;
  }

  send<T>(msg: WsMessage<T>): void {
    const payload = JSON.stringify({ ...msg, requestId: msg.requestId || createRequestId(), ts: Date.now() });
    if (ENV.USE_MOCK_WS) {
      this.mockSend(msg);
      return;
    }
    if (!this.connected || !this.socket) {
      this.emit({ type: 'ERROR', payload: { code: 'WS_DISCONNECTED', message: '连接已断开' }, ts: Date.now() });
      return;
    }
    this.socket.send({ data: payload });
  }

  on(type: string, handler: Listener): void {
    const set = this.listeners.get(type) || new Set<Listener>();
    set.add(handler);
    this.listeners.set(type, set);
  }

  off(type: string, handler: Listener): void {
    this.listeners.get(type)?.delete(handler);
  }

  subscribeRoom(roomId: string): void {
    this.roomId = roomId;
    this.send({ type: 'ROOM_SUBSCRIBE', roomId });
  }

  private handleMessage(raw: string | ArrayBuffer): void {
    const text = typeof raw === 'string' ? raw : '';
    try {
      const msg = JSON.parse(text) as WsMessage;
      if (msg.type === 'PONG') {
        if (this.pongTimer) clearTimeout(this.pongTimer);
      }
      this.emit(msg);
    } catch {
      this.emit({ type: 'ERROR', payload: { code: 'BAD_MESSAGE', message: 'WebSocket 消息解析失败' } });
    }
  }

  private handleDisconnect(type: 'ERROR' | 'DISCONNECTED'): void {
    this.connected = false;
    this.socket = null;
    this.emit({ type, ts: Date.now() });
    this.scheduleReconnect();
  }

  private startHeartbeat(): void {
    this.pauseHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'PING' });
      this.pongTimer = setTimeout(() => this.handleDisconnect('DISCONNECTED'), ENV.WS_PONG_TIMEOUT_MS);
    }, ENV.WS_HEARTBEAT_INTERVAL_MS) as unknown as number;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.token) return;
    const delay = Math.min(10000, this.reconnectAttempts === 0 ? 0 : 1000 * 2 ** this.reconnectAttempts);
    this.emit({ type: 'RECONNECTING', ts: Date.now() });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts += 1;
      this.connect(this.token);
    }, delay) as unknown as number;
  }

  private clearTimers(): void {
    this.pauseHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private emit(msg: WsMessage): void {
    this.listeners.get(msg.type)?.forEach((handler) => handler(msg));
    this.listeners.get('*')?.forEach((handler) => handler(msg));
  }

  private mockSend<T>(msg: WsMessage<T>): void {
    if (msg.type === 'PING') {
      setTimeout(() => this.emit({ type: 'PONG', ts: Date.now() }), 80);
      return;
    }
    if (msg.type === 'ROOM_SUBSCRIBE') {
      setTimeout(() => this.emit({ type: 'ACK', requestId: msg.requestId, roomId: msg.roomId }), 80);
      return;
    }
    if (msg.type === 'GAME_ACTION') {
      setTimeout(() => {
        this.emit({ type: 'ACK', requestId: msg.requestId, roomId: msg.roomId, gameId: msg.gameId });
        this.emit({ type: 'GAME_VIEW', roomId: msg.roomId, gameId: msg.gameId, payload: { view: mockFinishedView } });
      }, 250);
    }
  }
}

export function createRequestId(): string {
  return `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export const wsClient = new WsClient();
