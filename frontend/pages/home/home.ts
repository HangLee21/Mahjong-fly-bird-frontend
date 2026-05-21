import { authStore } from '../../stores/auth-store';
import { roomStore } from '../../stores/room-store';
import type { User } from '../../types/auth.types';
import { showError } from '../../utils/error';

Page({
  data: {
    user: null as User | null,
    roomId: '',
    loading: false,
  },
  onShow() {
    this.setData({ user: authStore.user });
  },
  onRoomInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ roomId: event.detail.value });
  },
  async onCreateRoom() {
    this.setData({ loading: true });
    try {
      const room = await roomStore.create();
      wx.navigateTo({ url: `/pages/room/room?roomId=${room.roomId}` });
    } catch (error) {
      showError(error, '创建房间失败');
    } finally {
      this.setData({ loading: false });
    }
  },
  async onJoinRoom() {
    if (!this.data.roomId) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    try {
      const room = await roomStore.join(this.data.roomId);
      wx.navigateTo({ url: `/pages/room/room?roomId=${room.roomId}` });
    } catch (error) {
      showError(error, '加入房间失败');
    }
  },
  onReplay() {
    wx.navigateTo({ url: '/pages/replay-list/replay-list' });
  },
  onLogout() {
    authStore.logout();
  },
});
