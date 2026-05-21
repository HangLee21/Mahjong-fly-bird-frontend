import { authStore } from '../../stores/auth-store';
import { roomStore } from '../../stores/room-store';
import { wsStore } from '../../stores/ws-store';
import type { RoomView } from '../../types/room.types';
import type { WsStatus } from '../../types/ws.types';
import { eventBus } from '../../utils/event-bus';
import { showError } from '../../utils/error';

Page({
  data: {
    room: null as RoomView | null,
    wsStatus: 'DISCONNECTED' as WsStatus,
  },
  async onLoad(query: { roomId?: string }) {
    try {
      const roomHandler = (room: RoomView) => this.setData({ room });
      const wsHandler = (status: WsStatus) => this.setData({ wsStatus: status });
      (this as unknown as { roomHandler: typeof roomHandler }).roomHandler = roomHandler;
      (this as unknown as { wsHandler: typeof wsHandler }).wsHandler = wsHandler;
      eventBus.on<RoomView>('room:update', roomHandler);
      eventBus.on<WsStatus>('ws:update', wsHandler);
      if (authStore.token) wsStore.ensureConnected(authStore.token);
      if (query.roomId) {
        const room = roomStore.room?.roomId === query.roomId ? roomStore.room : await roomStore.refresh(query.roomId);
        this.setData({ room });
        wsStore.subscribeRoom(query.roomId);
      }
    } catch (error) {
      showError(error, '加载房间失败');
    }
  },
  onUnload() {
    const page = this as unknown as { roomHandler?: (room: RoomView) => void; wsHandler?: (status: WsStatus) => void };
    if (page.roomHandler) eventBus.off<RoomView>('room:update', page.roomHandler);
    if (page.wsHandler) eventBus.off<WsStatus>('ws:update', page.wsHandler);
  },
  async onAddAi(event: WechatMiniprogram.CustomEvent<{ seatIndex: number }>) {
    try {
      await roomStore.addAi(event.detail.seatIndex);
    } catch (error) {
      showError(error, '添加 AI 失败');
    }
  },
  async onStart() {
    try {
      const gameId = await roomStore.start();
      wx.navigateTo({ url: `/pages/game/game?gameId=${gameId}` });
    } catch (error) {
      showError(error, '开始游戏失败');
    }
  },
});
