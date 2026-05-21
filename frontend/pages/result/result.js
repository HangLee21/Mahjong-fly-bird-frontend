"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const game_api_1 = require("../../services/game-api");
const game_store_1 = require("../../stores/game-store");
const error_1 = require("../../utils/error");
Page({
    data: {
        view: null,
    },
    async onLoad(query) {
        try {
            const view = game_store_1.gameStore.view?.gameId === query.gameId ? game_store_1.gameStore.view : query.gameId ? await (0, game_api_1.getGameView)(query.gameId) : game_store_1.gameStore.view;
            this.setData({ view });
        }
        catch (error) {
            (0, error_1.showError)(error, '加载结算失败');
        }
    },
    onBackRoom() {
        const roomId = this.data.view?.roomId;
        if (roomId)
            wx.redirectTo({ url: `/pages/room/room?roomId=${roomId}` });
    },
    onReplay() {
        const gameId = this.data.view?.gameId;
        if (gameId)
            wx.navigateTo({ url: `/pages/replay/replay?gameId=${gameId}` });
    },
});
