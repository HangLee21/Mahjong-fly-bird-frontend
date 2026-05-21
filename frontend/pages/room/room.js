"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_store_1 = require("../../stores/auth-store");
const room_store_1 = require("../../stores/room-store");
const ws_store_1 = require("../../stores/ws-store");
const event_bus_1 = require("../../utils/event-bus");
const error_1 = require("../../utils/error");
Page({
    data: {
        room: null,
        wsStatus: 'DISCONNECTED',
    },
    async onLoad(query) {
        try {
            const roomHandler = (room) => this.setData({ room });
            const wsHandler = (status) => this.setData({ wsStatus: status });
            this.roomHandler = roomHandler;
            this.wsHandler = wsHandler;
            event_bus_1.eventBus.on('room:update', roomHandler);
            event_bus_1.eventBus.on('ws:update', wsHandler);
            if (auth_store_1.authStore.token)
                ws_store_1.wsStore.ensureConnected(auth_store_1.authStore.token);
            if (query.roomId) {
                const room = room_store_1.roomStore.room?.roomId === query.roomId ? room_store_1.roomStore.room : await room_store_1.roomStore.refresh(query.roomId);
                this.setData({ room });
                ws_store_1.wsStore.subscribeRoom(query.roomId);
            }
        }
        catch (error) {
            (0, error_1.showError)(error, '加载房间失败');
        }
    },
    onUnload() {
        const page = this;
        if (page.roomHandler)
            event_bus_1.eventBus.off('room:update', page.roomHandler);
        if (page.wsHandler)
            event_bus_1.eventBus.off('ws:update', page.wsHandler);
    },
    async onAddAi(event) {
        try {
            await room_store_1.roomStore.addAi(event.detail.seatIndex);
        }
        catch (error) {
            (0, error_1.showError)(error, '添加 AI 失败');
        }
    },
    async onStart() {
        try {
            const gameId = await room_store_1.roomStore.start();
            wx.navigateTo({ url: `/pages/game/game?gameId=${gameId}` });
        }
        catch (error) {
            (0, error_1.showError)(error, '开始游戏失败');
        }
    },
});
