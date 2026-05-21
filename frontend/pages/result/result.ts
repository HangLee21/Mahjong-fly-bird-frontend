import { getGameView } from '../../services/game-api';
import { gameStore } from '../../stores/game-store';
import type { PlayerGameView } from '../../types/game.types';
import { showError } from '../../utils/error';

Page({
  data: {
    view: null as PlayerGameView | null,
  },
  async onLoad(query: { gameId?: string }) {
    try {
      const view = gameStore.view?.gameId === query.gameId ? gameStore.view : query.gameId ? await getGameView(query.gameId) : gameStore.view;
      this.setData({ view });
    } catch (error) {
      showError(error, '加载结算失败');
    }
  },
  onBackRoom() {
    const roomId = this.data.view?.roomId;
    if (roomId) wx.redirectTo({ url: `/pages/room/room?roomId=${roomId}` });
  },
  onReplay() {
    const gameId = this.data.view?.gameId;
    if (gameId) wx.navigateTo({ url: `/pages/replay/replay?gameId=${gameId}` });
  },
});
