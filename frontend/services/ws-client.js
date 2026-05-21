"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsClient = exports.WsClient = void 0;
exports.createRequestId = createRequestId;
const env_1 = require("../config/env");
const data_1 = require("./mock/data");
class WsClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.token = '';
        this.roomId = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.pongTimer = null;
        this.listeners = new Map();
    }
    connect(token) {
        this.token = token;
        if (env_1.ENV.USE_MOCK_WS) {
            this.connected = true;
            this.emit({ type: 'CONNECTED', ts: Date.now() });
            this.startHeartbeat();
            return;
        }
        if (this.connected || this.socket)
            return;
        this.socket = wx.connectSocket({
            url: `${env_1.ENV.WS_BASE_URL}?token=${encodeURIComponent(token)}`,
            success: () => undefined,
        });
        this.socket.onOpen(() => {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit({ type: 'CONNECTED', ts: Date.now() });
            if (this.roomId)
                this.subscribeRoom(this.roomId);
            this.startHeartbeat();
        });
        this.socket.onMessage((event) => this.handleMessage(event.data));
        this.socket.onError(() => this.handleDisconnect('ERROR'));
        this.socket.onClose(() => this.handleDisconnect('DISCONNECTED'));
    }
    disconnect() {
        this.clearTimers();
        this.connected = false;
        this.socket?.close({});
        this.socket = null;
        this.emit({ type: 'DISCONNECTED', ts: Date.now() });
    }
    pauseHeartbeat() {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        if (this.pongTimer)
            clearTimeout(this.pongTimer);
        this.heartbeatTimer = null;
        this.pongTimer = null;
    }
    send(msg) {
        const payload = JSON.stringify({ ...msg, requestId: msg.requestId || createRequestId(), ts: Date.now() });
        if (env_1.ENV.USE_MOCK_WS) {
            this.mockSend(msg);
            return;
        }
        if (!this.connected || !this.socket) {
            this.emit({ type: 'ERROR', payload: { code: 'WS_DISCONNECTED', message: '连接已断开' }, ts: Date.now() });
            return;
        }
        this.socket.send({ data: payload });
    }
    on(type, handler) {
        const set = this.listeners.get(type) || new Set();
        set.add(handler);
        this.listeners.set(type, set);
    }
    off(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }
    subscribeRoom(roomId) {
        this.roomId = roomId;
        this.send({ type: 'ROOM_SUBSCRIBE', roomId });
    }
    handleMessage(raw) {
        const text = typeof raw === 'string' ? raw : '';
        try {
            const msg = JSON.parse(text);
            if (msg.type === 'PONG') {
                if (this.pongTimer)
                    clearTimeout(this.pongTimer);
            }
            this.emit(msg);
        }
        catch {
            this.emit({ type: 'ERROR', payload: { code: 'BAD_MESSAGE', message: 'WebSocket 消息解析失败' } });
        }
    }
    handleDisconnect(type) {
        this.connected = false;
        this.socket = null;
        this.emit({ type, ts: Date.now() });
        this.scheduleReconnect();
    }
    startHeartbeat() {
        this.pauseHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.send({ type: 'PING' });
            this.pongTimer = setTimeout(() => this.handleDisconnect('DISCONNECTED'), env_1.ENV.WS_PONG_TIMEOUT_MS);
        }, env_1.ENV.WS_HEARTBEAT_INTERVAL_MS);
    }
    scheduleReconnect() {
        if (this.reconnectTimer || !this.token)
            return;
        const delay = Math.min(10000, this.reconnectAttempts === 0 ? 0 : 1000 * 2 ** this.reconnectAttempts);
        this.emit({ type: 'RECONNECTING', ts: Date.now() });
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectAttempts += 1;
            this.connect(this.token);
        }, delay);
    }
    clearTimers() {
        this.pauseHeartbeat();
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }
    emit(msg) {
        this.listeners.get(msg.type)?.forEach((handler) => handler(msg));
        this.listeners.get('*')?.forEach((handler) => handler(msg));
    }
    mockSend(msg) {
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
                this.emit({ type: 'GAME_VIEW', roomId: msg.roomId, gameId: msg.gameId, payload: { view: data_1.mockFinishedView } });
            }, 250);
        }
    }
}
exports.WsClient = WsClient;
function createRequestId() {
    return `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
exports.wsClient = new WsClient();
