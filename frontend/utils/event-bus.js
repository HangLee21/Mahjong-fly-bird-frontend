"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
class EventBus {
    constructor() {
        this.listeners = new Map();
    }
    on(event, handler) {
        const set = this.listeners.get(event) || new Set();
        set.add(handler);
        this.listeners.set(event, set);
    }
    off(event, handler) {
        this.listeners.get(event)?.delete(handler);
    }
    emit(event, payload) {
        this.listeners.get(event)?.forEach((handler) => handler(payload));
    }
}
exports.eventBus = new EventBus();
