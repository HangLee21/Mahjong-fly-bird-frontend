import { authStore } from '../../stores/auth-store';
import { showError } from '../../utils/error';

Page({
  data: {
    loading: false,
  },
  async onLoad() {
    await authStore.init();
    if (authStore.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/home/home' });
    }
  },
  async onLogin() {
    this.setData({ loading: true });
    try {
      await authStore.login();
      wx.redirectTo({ url: '/pages/home/home' });
    } catch (error) {
      showError(error, '登录失败');
    } finally {
      this.setData({ loading: false });
    }
  },
});
