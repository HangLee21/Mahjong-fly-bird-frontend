"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_store_1 = require("./stores/auth-store");
const ws_store_1 = require("./stores/ws-store");
App({
    async onLaunch() {
        await auth_store_1.authStore.init();
    },
    onShow() {
        if (auth_store_1.authStore.token) {
            ws_store_1.wsStore.ensureConnected(auth_store_1.authStore.token);
        }
    },
    onHide() {
        ws_store_1.wsStore.pauseHeartbeat();
    },
});
