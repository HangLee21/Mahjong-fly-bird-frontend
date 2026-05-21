"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsStore = void 0;
const game_api_1 = require("../services/game-api");
const ws_client_1 = require("../services/ws-client");
const game_store_1 = require("./game-store");
const room_store_1 = require("./room-store");
const event_bus_1 = require("../utils/event-bus");
class WsStore {
    constructor() {
        this.status = 'DISCONNECTED';
        this.bound = false;
    }
    ensureConnected(token) {
        this.bind();
        if (this.status === 'CONNECTED' || this.status === 'CONNECTING')
            return;
        this.setStatus('CONNECTING');
        ws_client_1.wsClient.connect(token);
    }
    subscribeRoom(roomId) {
        ws_client_1.wsClient.subscribeRoom(roomId);
    }
    pauseHeartbeat() {
        ws_client_1.wsClient.pauseHeartbeat();
    }
    bind() {
        if (this.bound)
            return;
        this.bound = true;
        ws_client_1.wsClient.on('CONNECTED', () => this.setStatus('CONNECTED'));
        ws_client_1.wsClient.on('DISCONNECTED', () => this.setStatus('DISCONNECTED'));
        ws_client_1.wsClient.on('RECONNECTING', () => this.setStatus('RECONNECTING'));
        ws_client_1.wsClient.on('ERROR', async (msg) => {
            this.setStatus('ERROR');
            const gameId = game_store_1.gameStore.view?.gameId;
            const message = msg.payload?.message;
            if (message)
                wx.showToast({ title: message, icon: 'none' });
            if (gameId)
                game_store_1.gameStore.setView(await (0, game_api_1.getGameView)(gameId));
        });
        ws_client_1.wsClient.on('ROOM_UPDATE', (msg) => {
            const payload = msg.payload;
            if (payload?.room)
                room_store_1.roomStore.setRoom(payload.room);
        });
        ws_client_1.wsClient.on('GAME_VIEW', (msg) => {
            const payload = msg.payload;
            if (!payload?.view)
                return;
            game_store_1.gameStore.setView(payload.view);
            if (payload.view.status === 'FINISHED') {
                wx.navigateTo({ url: `/pages/result/result?gameId=${payload.view.gameId}` });
            }
        });
        ws_client_1.wsClient.on('GAME_EVENTS', (msg) => {
            const payload = msg.payload;
            if (payload?.events)
                game_store_1.gameStore.setEvents(payload.events);
        });
    }
    setStatus(status) {
        this.status = status;
        event_bus_1.eventBus.emit('ws:update', status);
    }
}
exports.wsStore = new WsStore();
