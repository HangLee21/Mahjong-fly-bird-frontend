import { getGameView } from '../services/game-api';
import { wsClient } from '../services/ws-client';
import { gameStore } from './game-store';
import { roomStore } from './room-store';
import type { GameEventsPayload, GameViewPayload, RoomUpdatePayload, WsMessage, WsStatus } from '../types/ws.types';
import { eventBus } from '../utils/event-bus';

class WsStore {
  status: WsStatus = 'DISCONNECTED';
  private bound = false;

  ensureConnected(token: string): void {
    this.bind();
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return;
    this.setStatus('CONNECTING');
    wsClient.connect(token);
  }

  subscribeRoom(roomId: string): void {
    wsClient.subscribeRoom(roomId);
  }

  pauseHeartbeat(): void {
    wsClient.pauseHeartbeat();
  }

  private bind(): void {
    if (this.bound) return;
    this.bound = true;
    wsClient.on('CONNECTED', () => this.setStatus('CONNECTED'));
    wsClient.on('DISCONNECTED', () => this.setStatus('DISCONNECTED'));
    wsClient.on('RECONNECTING', () => this.setStatus('RECONNECTING'));
    wsClient.on('ERROR', async (msg) => {
      this.setStatus('ERROR');
      const gameId = gameStore.view?.gameId;
      const message = (msg.payload as { message?: string } | undefined)?.message;
      if (message) wx.showToast({ title: message, icon: 'none' });
      if (gameId) gameStore.setView(await getGameView(gameId));
    });
    wsClient.on('ROOM_UPDATE', (msg: WsMessage) => {
      const payload = msg.payload as RoomUpdatePayload | undefined;
      if (payload?.room) roomStore.setRoom(payload.room);
    });
    wsClient.on('GAME_VIEW', (msg: WsMessage) => {
      const payload = msg.payload as GameViewPayload | undefined;
      if (!payload?.view) return;
      gameStore.setView(payload.view);
      if (payload.view.status === 'FINISHED') {
        wx.navigateTo({ url: `/pages/result/result?gameId=${payload.view.gameId}` });
      }
    });
    wsClient.on('GAME_EVENTS', (msg: WsMessage) => {
      const payload = msg.payload as GameEventsPayload | undefined;
      if (payload?.events) gameStore.setEvents(payload.events);
    });
  }

  private setStatus(status: WsStatus): void {
    this.status = status;
    eventBus.emit('ws:update', status);
  }
}

export const wsStore = new WsStore();
