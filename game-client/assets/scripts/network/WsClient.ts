import { AppConfig } from '../app/AppConfig';
import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import { Storage } from '../utils/Storage';
import { createRequestId } from '../utils/Id';
import { ReconnectPolicy } from './ReconnectPolicy';
import type { WsMessage, WsStatus } from './Protocol';

type Handler = (message: WsMessage) => void;

export class WsClient {
  private socket: WebSocket | null = null;
  private status: WsStatus = 'IDLE';
  private listeners = new Map<string, Set<Handler>>();
  private reconnectPolicy = new ReconnectPolicy();
  private roomId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  connect(): void {
    const token = Storage.getToken();
    if (!token || this.status === 'CONNECTED' || this.status === 'CONNECTING') return;
    this.setStatus(this.status === 'IDLE' ? 'CONNECTING' : 'RECONNECTING');
    this.socket = new WebSocket(`${AppConfig.WS_BASE_URL}?token=${encodeURIComponent(token)}`);
    this.socket.onopen = () => {
      this.reconnectPolicy.reset();
      this.setStatus('CONNECTED');
      if (this.roomId) this.subscribeRoom(this.roomId);
      this.startHeartbeat();
    };
    this.socket.onmessage = (event) => this.dispatch(JSON.parse(String(event.data)) as WsMessage);
    this.socket.onerror = () => this.handleClose('ERROR');
    this.socket.onclose = () => this.handleClose('DISCONNECTED');
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.setStatus('DISCONNECTED');
  }

  send<T>(message: WsMessage<T>): void {
    const payload = JSON.stringify({
      ...message,
      requestId: message.requestId || createRequestId(),
      ts: Date.now(),
    });
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('WebSocket 未连接');
    this.socket.send(payload);
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
    if (this.status === 'CONNECTED') this.send({ type: 'ROOM_SUBSCRIBE', roomId });
  }

  private dispatch(message: WsMessage): void {
    this.listeners.get(message.type)?.forEach((handler) => handler(message));
    this.listeners.get('*')?.forEach((handler) => handler(message));
  }

  private handleClose(status: WsStatus): void {
    this.stopHeartbeat();
    this.socket = null;
    this.setStatus(status);
    const delay = this.reconnectPolicy.nextDelay();
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) this.send({ type: 'PING' });
    }, AppConfig.WS_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private setStatus(status: WsStatus): void {
    this.status = status;
    eventBus.emit(GameEvents.WS_STATUS_CHANGED, status);
  }
}

export const wsClient = new WsClient();
