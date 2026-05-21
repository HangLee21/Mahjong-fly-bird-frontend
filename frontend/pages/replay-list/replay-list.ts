import { listReplays } from '../../services/replay-api';
import type { ReplaySummary } from '../../types/replay.types';
import { formatTime } from '../../utils/format';
import { showError } from '../../utils/error';

Page({
  data: {
    items: [] as ReplaySummary[],
  },
  formatTime,
  async onShow() {
    try {
      this.setData({ items: await listReplays() });
    } catch (error) {
      showError(error, '加载牌谱失败');
    }
  },
  onOpen(event: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/replay/replay?gameId=${event.currentTarget.dataset.id}` });
  },
});
