"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_store_1 = require("../../stores/auth-store");
const error_1 = require("../../utils/error");
Page({
    data: {
        loading: false,
    },
    async onLoad() {
        await auth_store_1.authStore.init();
        if (auth_store_1.authStore.isLoggedIn()) {
            wx.redirectTo({ url: '/pages/home/home' });
        }
    },
    async onLogin() {
        this.setData({ loading: true });
        try {
            await auth_store_1.authStore.login();
            wx.redirectTo({ url: '/pages/home/home' });
        }
        catch (error) {
            (0, error_1.showError)(error, '登录失败');
        }
        finally {
            this.setData({ loading: false });
        }
    },
});
