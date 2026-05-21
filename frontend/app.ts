import { authStore } from './stores/auth-store';
import { wsStore } from './stores/ws-store';

App<IAppOption>({
  async onLaunch() {
    await authStore.init();
  },
  onShow() {
    if (authStore.token) {
      wsStore.ensureConnected(authStore.token);
    }
  },
  onHide() {
    wsStore.pauseHeartbeat();
  },
});

interface IAppOption {
  globalData?: Record<string, unknown>;
}
