import { AppConfig } from '../app/AppConfig';
import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import { MockWsClient } from '../mock/MockWsClient';
import { Storage } from '../utils/Storage';
import { createRequestId } from '../utils/Id';
import { ReconnectPolicy } from './ReconnectPolicy';
import type { WsMessage, WsStatus } from './Protocol';

type Handler = (message: WsMessage) => void;

interface SocketLike {
  close(): void;
  send(options: { data: string }): void;
  onOpen(callback: () => void): void;
  onMessage(callback: (event: { data: string | ArrayBuffer }) => void): void;
  onError(callback: () => void): void;
  onClose(callback: () => void): void;
}

interface WxSocketApi {
  connectSocket(options: { url: string }): SocketLike;
}

export class WsClient {
  private socket: WebSocket | null = null;
  private wxSocket: SocketLike | null = null;
  private status: WsStatus = 'IDLE';
  private listeners = new Map<string, Set<Handler>>();
  private reconnectPolicy = new ReconnectPolicy();
  private roomIds = new Set<string>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  connect(): void {
    const token = Storage.getToken();
    if (!token || this.status === 'CONNECTED' || this.status === 'CONNECTING') return;
    this.setStatus(this.status === 'IDLE' ? 'CONNECTING' : 'RECONNECTING');
    const url = `${AppConfig.WS_BASE_URL}?token=${encodeURIComponent(token)}`;
    const wxApi = (globalThis as unknown as { wx?: WxSocketApi }).wx;
    if (typeof WebSocket === 'function') {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => this.handleOpen();
      this.socket.onmessage = (event) => this.dispatch(JSON.parse(String(event.data)) as WsMessage);
      this.socket.onerror = () => this.handleClose('ERROR');
      this.socket.onclose = () => this.handleClose('DISCONNECTED');
      return;
    }

    if (!wxApi?.connectSocket) {
      this.handleClose('ERROR');
      return;
    }

    this.wxSocket = wxApi.connectSocket({ url });
    this.wxSocket.onOpen(() => this.handleOpen());
    this.wxSocket.onMessage((event) => this.dispatch(JSON.parse(String(event.data)) as WsMessage));
    this.wxSocket.onError(() => this.handleClose('ERROR'));
    this.wxSocket.onClose(() => this.handleClose('DISCONNECTED'));
  }

  private handleOpen(): void {
    this.reconnectPolicy.reset();
    this.setStatus('CONNECTED');
    [...this.roomIds].forEach((roomId) => this.sendRoomSubscribe(roomId));
    this.startHeartbeat();
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.socket?.close();
    this.wxSocket?.close();
    this.socket = null;
    this.wxSocket = null;
    this.setStatus('DISCONNECTED');
  }

  send<T>(message: WsMessage<T>): void {
    const payload = JSON.stringify({
      ...message,
      requestId: message.requestId || createRequestId(),
      ts: Date.now(),
    });
    if (this.socket) {
      if (this.socket.readyState !== WebSocket.OPEN) throw new Error('WebSocket 未连接');
      this.socket.send(payload);
      return;
    }

    if (!this.wxSocket || this.status !== 'CONNECTED') throw new Error('WebSocket 未连接');
    this.wxSocket.send({ data: payload });
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
    if (!roomId) return;
    this.roomIds.add(roomId);
    if (this.status === 'CONNECTED') this.sendRoomSubscribe(roomId);
  }

  private sendRoomSubscribe(roomId: string): void {
    this.send({ type: 'ROOM_SUBSCRIBE', roomId });
  }

  private dispatch(message: WsMessage): void {
    this.listeners.get(message.type)?.forEach((handler) => handler(message));
    this.listeners.get('*')?.forEach((handler) => handler(message));
  }

  private handleClose(status: WsStatus): void {
    this.stopHeartbeat();
    this.socket = null;
    this.wxSocket = null;
    this.setStatus(status);
    const delay = this.reconnectPolicy.nextDelay();
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN || this.wxSocket) this.send({ type: 'PING' });
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

export const wsClient = AppConfig.USE_MOCK_WS ? new MockWsClient() : new WsClient();
