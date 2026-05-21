"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authStore = void 0;
const auth_api_1 = require("../services/auth-api");
const storage_1 = require("../utils/storage");
const event_bus_1 = require("../utils/event-bus");
class AuthStore {
    constructor() {
        this.token = null;
        this.user = null;
    }
    async init() {
        this.token = (0, storage_1.getToken)();
        this.user = (0, storage_1.getUser)();
        event_bus_1.eventBus.emit('auth:update', this.snapshot());
    }
    async login() {
        const code = await new Promise((resolve, reject) => {
            wx.login({
                success: (res) => resolve(res.code),
                fail: reject,
            });
        });
        const result = await (0, auth_api_1.wechatLogin)({ code });
        this.token = result.token;
        this.user = result.user;
        (0, storage_1.setToken)(result.token);
        (0, storage_1.setUser)(result.user);
        event_bus_1.eventBus.emit('auth:update', this.snapshot());
    }
    logout() {
        this.token = null;
        this.user = null;
        (0, storage_1.clearToken)();
        (0, storage_1.clearUser)();
        event_bus_1.eventBus.emit('auth:update', this.snapshot());
        wx.reLaunch({ url: '/pages/login/login' });
    }
    isLoggedIn() {
        return Boolean(this.token);
    }
    snapshot() {
        return { token: this.token, user: this.user };
    }
}
exports.authStore = new AuthStore();
