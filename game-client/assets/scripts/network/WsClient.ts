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
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyDisconnected = false;

  connect(): void {
    const token = Storage.getToken();
    if (!token || this.status === 'CONNECTED' || this.status === 'CONNECTING') return;
    this.manuallyDisconnected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.setStatus(this.status === 'IDLE' ? 'CONNECTING' : 'RECONNECTING');
    const url = `${AppConfig.WS_BASE_URL}?token=${encodeURIComponent(token)}`;
    const wxApi = (globalThis as unknown as { wx?: WxSocketApi }).wx;
    if (typeof WebSocket === 'function') {
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.onopen = () => {
        if (this.socket === socket) this.handleOpen();
      };
      socket.onmessage = (event) => this.handleMessage(event.data);
      socket.onerror = () => this.handleClose('ERROR', socket);
      socket.onclose = () => this.handleClose('DISCONNECTED', socket);
      return;
    }

    if (!wxApi?.connectSocket) {
      this.handleClose('ERROR');
      return;
    }

    const socket = wxApi.connectSocket({ url });
    this.wxSocket = socket;
    socket.onOpen(() => {
      if (this.wxSocket === socket) this.handleOpen();
    });
    socket.onMessage((event) => this.handleMessage(event.data));
    socket.onError(() => this.handleClose('ERROR', socket));
    socket.onClose(() => this.handleClose('DISCONNECTED', socket));
  }

  private handleOpen(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectPolicy.reset();
    this.setStatus('CONNECTED');
    [...this.roomIds].forEach((roomId) => this.sendRoomSubscribe(roomId));
    this.startHeartbeat();
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    const wxSocket = this.wxSocket;
    this.socket = null;
    this.wxSocket = null;
    socket?.close();
    wxSocket?.close();
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
    if (this.roomIds.has(roomId)) return;
    this.roomIds.add(roomId);
    if (this.status === 'CONNECTED') this.sendRoomSubscribe(roomId);
  }

  unsubscribeRoom(roomId: string): void {
    this.roomIds.delete(roomId);
  }

  resetRoomSubscriptions(): void {
    this.roomIds.clear();
    this.disconnect();
  }

  private sendRoomSubscribe(roomId: string): void {
    this.send({ type: 'ROOM_SUBSCRIBE', roomId });
  }

  private dispatch(message: WsMessage): void {
    this.listeners.get(message.type)?.forEach((handler) => handler(message));
    this.listeners.get('*')?.forEach((handler) => handler(message));
  }

  private handleMessage(data: string | ArrayBuffer): void {
    try {
      this.dispatch(JSON.parse(String(data)) as WsMessage);
    } catch (error) {
      console.warn('[WsClient] ignored malformed websocket message', error);
    }
  }

  private handleClose(status: WsStatus, source?: WebSocket | SocketLike): void {
    if (source && source !== this.socket && source !== this.wxSocket) return;
    this.stopHeartbeat();
    this.socket = null;
    this.wxSocket = null;
    this.setStatus(status);
    if (this.manuallyDisconnected || this.reconnectTimer) return;
    const delay = this.reconnectPolicy.nextDelay();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === 1 || this.wxSocket) this.send({ type: 'PING' });
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
