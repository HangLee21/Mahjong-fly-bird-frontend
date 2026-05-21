"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const game_api_1 = require("../../services/game-api");
const auth_store_1 = require("../../stores/auth-store");
const game_store_1 = require("../../stores/game-store");
const ws_store_1 = require("../../stores/ws-store");
const event_bus_1 = require("../../utils/event-bus");
const error_1 = require("../../utils/error");
Page({
    data: {
        view: null,
        selectedTile: null,
        legalDiscardTiles: [],
        submitting: false,
        wsStatus: 'DISCONNECTED',
        loading: true,
    },
    async onLoad(query) {
        const gameHandler = (snapshot) => {
            this.setData({
                view: snapshot.view,
                selectedTile: snapshot.selectedTile,
                legalDiscardTiles: snapshot.legalDiscardTiles,
                submitting: snapshot.submitting,
            });
        };
        const wsHandler = (status) => this.setData({ wsStatus: status });
        this.gameHandler = gameHandler;
        this.wsHandler = wsHandler;
        event_bus_1.eventBus.on('game:update', gameHandler);
        event_bus_1.eventBus.on('ws:update', wsHandler);
        try {
            if (auth_store_1.authStore.token)
                ws_store_1.wsStore.ensureConnected(auth_store_1.authStore.token);
            if (query.gameId) {
                const view = await (0, game_api_1.getGameView)(query.gameId);
                game_store_1.gameStore.setView(view);
                ws_store_1.wsStore.subscribeRoom(view.roomId);
            }
        }
        catch (error) {
            (0, error_1.showError)(error, '加载牌桌失败');
        }
        finally {
            this.setData({ loading: false });
        }
    },
    onUnload() {
        const page = this;
        if (page.gameHandler)
            event_bus_1.eventBus.off('game:update', page.gameHandler);
        if (page.wsHandler)
            event_bus_1.eventBus.off('ws:update', page.wsHandler);
    },
    onSelectTile(event) {
        const tile = event.detail.tile;
        if (this.data.selectedTile === tile) {
            game_store_1.gameStore.submitDiscard(tile).catch((error) => (0, error_1.showError)(error, '出牌失败'));
            return;
        }
        game_store_1.gameStore.selectTile(tile);
    },
    onSubmitAction(event) {
        game_store_1.gameStore.submitAction(event.detail.action).catch((error) => (0, error_1.showError)(error, '动作提交失败'));
    },
});
