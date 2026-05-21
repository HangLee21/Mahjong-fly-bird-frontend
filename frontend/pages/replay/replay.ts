import { getReplay } from '../../services/replay-api';
import type { PlayerGameView } from '../../types/game.types';
import type { ReplayDetail } from '../../types/replay.types';
import { showError } from '../../utils/error';

Page({
  data: {
    replay: null as ReplayDetail | null,
    index: 0,
    view: null as PlayerGameView | null,
  },
  async onLoad(query: { gameId?: string }) {
    try {
      if (!query.gameId) return;
      const replay = await getReplay(query.gameId);
      this.setData({ replay, view: replay.steps[0]?.view || null });
    } catch (error) {
      showError(error, '加载回放失败');
    }
  },
  onPrev() {
    const index = Math.max(0, this.data.index - 1);
    this.setData({ index, view: this.data.replay?.steps[index]?.view || null });
  },
  onNext() {
    const max = (this.data.replay?.steps.length || 1) - 1;
    const index = Math.min(max, this.data.index + 1);
    this.setData({ index, view: this.data.replay?.steps[index]?.view || null });
  },
});
