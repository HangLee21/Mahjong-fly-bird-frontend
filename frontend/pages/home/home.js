"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_store_1 = require("../../stores/auth-store");
const room_store_1 = require("../../stores/room-store");
const error_1 = require("../../utils/error");
Page({
    data: {
        user: null,
        roomId: '',
        loading: false,
    },
    onShow() {
        this.setData({ user: auth_store_1.authStore.user });
    },
    onRoomInput(event) {
        this.setData({ roomId: event.detail.value });
    },
    async onCreateRoom() {
        this.setData({ loading: true });
        try {
            const room = await room_store_1.roomStore.create();
            wx.navigateTo({ url: `/pages/room/room?roomId=${room.roomId}` });
        }
        catch (error) {
            (0, error_1.showError)(error, '创建房间失败');
        }
        finally {
            this.setData({ loading: false });
        }
    },
    async onJoinRoom() {
        if (!this.data.roomId) {
            wx.showToast({ title: '请输入房间号', icon: 'none' });
            return;
        }
        try {
            const room = await room_store_1.roomStore.join(this.data.roomId);
            wx.navigateTo({ url: `/pages/room/room?roomId=${room.roomId}` });
        }
        catch (error) {
            (0, error_1.showError)(error, '加入房间失败');
        }
    },
    onReplay() {
        wx.navigateTo({ url: '/pages/replay-list/replay-list' });
    },
    onLogout() {
        auth_store_1.authStore.logout();
    },
});
