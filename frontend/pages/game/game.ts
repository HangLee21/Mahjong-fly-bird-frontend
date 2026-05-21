import { getGameView } from '../../services/game-api';
import { authStore } from '../../stores/auth-store';
import { gameStore } from '../../stores/game-store';
import { wsStore } from '../../stores/ws-store';
import type { GameAction, PlayerGameView } from '../../types/game.types';
import type { WsStatus } from '../../types/ws.types';
import { eventBus } from '../../utils/event-bus';
import { showError } from '../../utils/error';

Page({
  data: {
    view: null as PlayerGameView | null,
    selectedTile: null as number | null,
    legalDiscardTiles: [] as number[],
    submitting: false,
    wsStatus: 'DISCONNECTED' as WsStatus,
    loading: true,
  },
  async onLoad(query: { gameId?: string }) {
    const gameHandler = (snapshot: ReturnType<typeof gameStore.snapshot>) => {
      this.setData({
        view: snapshot.view,
        selectedTile: snapshot.selectedTile,
        legalDiscardTiles: snapshot.legalDiscardTiles,
        submitting: snapshot.submitting,
      });
    };
    const wsHandler = (status: WsStatus) => this.setData({ wsStatus: status });
    (this as unknown as { gameHandler: typeof gameHandler }).gameHandler = gameHandler;
    (this as unknown as { wsHandler: typeof wsHandler }).wsHandler = wsHandler;
    eventBus.on<ReturnType<typeof gameStore.snapshot>>('game:update', gameHandler);
    eventBus.on<WsStatus>('ws:update', wsHandler);
    try {
      if (authStore.token) wsStore.ensureConnected(authStore.token);
      if (query.gameId) {
        const view = await getGameView(query.gameId);
        gameStore.setView(view);
        wsStore.subscribeRoom(view.roomId);
      }
    } catch (error) {
      showError(error, '加载牌桌失败');
    } finally {
      this.setData({ loading: false });
    }
  },
  onUnload() {
    const page = this as unknown as {
      gameHandler?: (snapshot: ReturnType<typeof gameStore.snapshot>) => void;
      wsHandler?: (status: WsStatus) => void;
    };
    if (page.gameHandler) eventBus.off<ReturnType<typeof gameStore.snapshot>>('game:update', page.gameHandler);
    if (page.wsHandler) eventBus.off<WsStatus>('ws:update', page.wsHandler);
  },
  onSelectTile(event: WechatMiniprogram.CustomEvent<{ tile: number }>) {
    const tile = event.detail.tile;
    if (this.data.selectedTile === tile) {
      gameStore.submitDiscard(tile).catch((error) => showError(error, '出牌失败'));
      return;
    }
    gameStore.selectTile(tile);
  },
  onSubmitAction(event: WechatMiniprogram.CustomEvent<{ action: GameAction }>) {
    gameStore.submitAction(event.detail.action).catch((error) => showError(error, '动作提交失败'));
  },
});
