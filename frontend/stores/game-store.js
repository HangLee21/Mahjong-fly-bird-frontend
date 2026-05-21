"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameStore = void 0;
const game_api_1 = require("../services/game-api");
const ws_client_1 = require("../services/ws-client");
const event_bus_1 = require("../utils/event-bus");
class GameStore {
    constructor() {
        this.view = null;
        this.events = [];
        this.selectedTile = null;
        this.submitting = false;
    }
    setView(view) {
        this.view = view;
        this.submitting = false;
        event_bus_1.eventBus.emit('game:update', this.snapshot());
    }
    setEvents(events) {
        this.events = [...events, ...this.events].slice(0, 20);
        event_bus_1.eventBus.emit('game:update', this.snapshot());
    }
    selectTile(tile) {
        this.selectedTile = this.selectedTile === tile ? null : tile;
        event_bus_1.eventBus.emit('game:update', this.snapshot());
    }
    async submitDiscard(tile) {
        const action = this.view?.legalActions.find((item) => item.type === 'DISCARD' && item.tile === tile);
        if (!action) {
            wx.showToast({ title: '当前不能打出这张牌', icon: 'none' });
            return;
        }
        await this.submitAction(action);
    }
    async submitAction(action) {
        if (!this.view || this.submitting)
            return;
        this.submitting = true;
        event_bus_1.eventBus.emit('game:update', this.snapshot());
        const payload = { ...action, clientSeq: this.view.stepIndex };
        ws_client_1.wsClient.send({
            type: 'GAME_ACTION',
            roomId: this.view.roomId,
            gameId: this.view.gameId,
            payload,
        });
        const result = await (0, game_api_1.submitAction)(this.view.gameId, payload);
        if (result.view)
            this.setView(result.view);
    }
    canSubmitAction(action) {
        return Boolean(this.view?.legalActions.some((item) => item.type === action.type && item.tile === action.tile && item.actionId === action.actionId));
    }
    getLegalDiscardTiles() {
        return (this.view?.legalActions
            .filter((action) => action.type === 'DISCARD' && action.tile !== undefined)
            .map((action) => action.tile) || []);
    }
    snapshot() {
        return {
            view: this.view,
            events: this.events,
            selectedTile: this.selectedTile,
            submitting: this.submitting,
            legalDiscardTiles: this.getLegalDiscardTiles(),
        };
    }
}
exports.gameStore = new GameStore();
