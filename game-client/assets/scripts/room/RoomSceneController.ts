import { _decorator, Color, Label, Node, Sprite, UITransform, Vec3 } from 'cc';
import { GameEvents } from '../app/GameEvents';
import { loadScene } from '../app/SceneNavigator';
import { AppConfig } from '../app/AppConfig';
import { authManager } from '../auth/AuthManager';
import { BaseScene } from '../core/BaseScene';
import { eventBus } from '../core/EventBus';
import { gameManager } from '../game/GameManager';
import {
  createButton,
  createImage,
  createImageButton,
  createLabel,
  createLayout,
  createPanel,
  createRemoteImage,
  ensureCanvas,
  ensureChild,
  RuntimeLayout,
  TEXT_SCALE,
} from '../ui/RuntimeUi';
import { roomManager } from './RoomManager';
import type { RoomRules, RoomSeat, RoomView } from './RoomTypes';

const { ccclass } = _decorator;

type RoundCount = 8 | 16 | 24 | 32;

interface RoomLocalSettings {
  roundCount: RoundCount;
  allowChow: boolean;
  allowPong: boolean;
  xiaoJiWildEnabled: boolean;
  allowMultiWin: boolean;
  fanCap: 3 | 4;
  publicKongTiles: 2 | 4;
}

const ROOM_BG_RATIO = 1672 / 941;
const PANEL_RATIO = 640 / 260;
const CENTER_STATUS_RATIO = 360 / 180;
const SEAT_RATIO = 1;
const BUTTON_START_RATIO = 420 / 120;
const READY_BUTTON_RATIO = 2048 / 819;
const BUTTON_ADD_AI_RATIO = 360 / 100;
const BUTTON_DELETE_RATIO = 1;

@ccclass('RoomSceneController')
export class RoomSceneController extends BaseScene {
  private settingsLayer: Node | null = null;
  private roomPollTimer: ReturnType<typeof setInterval> | null = null;
  private roomPolling = false;
  private settings: RoomLocalSettings = {
    roundCount: 16,
    allowChow: true,
    allowPong: true,
    xiaoJiWildEnabled: true,
    allowMultiWin: true,
    fanCap: 3,
    publicKongTiles: 2,
  };

  private readonly handleRoomChanged = (room: RoomView): void => {
    if (room.status === 'PLAYING') {
      this.stopRoomPolling();
      loadScene('Game');
      return;
    }

    this.syncSettingsFromRoom(room);
    this.buildRuntimeUi();
  };

  async start(): Promise<void> {
    console.log('[RoomSceneController] start');
    await this.enter();
    this.syncSettingsFromRoom(roomManager.currentRoom);
    this.bindRoomEvents();
    this.buildRuntimeUi();
    this.startRoomPolling();
  }

  onDestroy(): void {
    this.stopRoomPolling();
    this.unbindRoomEvents();
  }

  private addAiToFirstEmptySeat(): void {
    if (!this.isCurrentUserOwner()) {
      console.warn('[RoomSceneController] only room owner can add AI');
      this.showNotice('只有房主可以添加人机');
      return;
    }
    const room = this.ensureRoom();
    const emptySeat = room.seats.find((seat) => !seat.user);
    if (!emptySeat) {
      console.warn('[RoomSceneController] no empty seat for AI');
      this.showNotice('没有空座位');
      return;
    }
    void this.addAi(emptySeat.seatIndex);
  }

  private async startGame(): Promise<void> {
    if (!this.isCurrentUserOwner()) return;
    if (!this.allHumansReady()) {
      this.showNotice('还有玩家未准备');
      return;
    }
    if (gameManager.snapshot().openingLocked) gameManager.leaveGame();
    gameManager.bindNetwork();
    gameManager.beginOpeningSequence();
    try {
      await roomManager.startGame();
    } catch (error) {
      gameManager.cancelOpeningSequence();
      console.error('[RoomSceneController] start game failed', error);
      this.showNotice('开始游戏失败');
    }
  }

  private async toggleReady(): Promise<void> {
    const seat = this.ensureRoom().seats.find((item) => item.user?.id === this.currentUserId());
    const ready = !Boolean(seat?.isReady);
    try {
      await roomManager.setReady(ready);
    } catch (err) {
      console.error('[RoomSceneController] ready update failed', err);
      this.showNotice('准备状态更新失败');
    }
  }

  private leaveRoom(): void {
    void roomManager.leaveRoom();
    loadScene('RoomEntry');
  }

  private buildRuntimeUi(): void {
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);

    const layout = createLayout();
    const room = this.ensureRoom();
    const isOwner = this.isOwner(room);

    this.createBackground(canvas, layout);

    const uiLayer = ensureChild(canvas, 'RoomUiLayer');
    uiLayer.removeAllChildren();
    this.bringToFront(uiLayer);

    this.createTopInfo(uiLayer, layout, room);
    this.createCenterStatus(uiLayer, layout);
    this.createSeats(uiLayer, layout, room, isOwner);
    this.createActionButtons(uiLayer, layout, isOwner);
    this.createSettingsDialog(uiLayer, layout);
  }

  private createBackground(canvas: Node, layout: RuntimeLayout): void {
    createPanel(canvas, 'BackgroundColor', layout.width, layout.height, new Color(5, 38, 29, 255));
    this.createCoverImage(canvas, 'RoomBackground', 'textures/ui/room_bg', layout.width, layout.height, ROOM_BG_RATIO);
  }

  private createTopInfo(canvas: Node, layout: RuntimeLayout, room: RoomView): void {
    const panelWidth = layout.w(38);
    const panelHeight = panelWidth / PANEL_RATIO;
    const panelPos = layout.pos(0, 34);
    createImage(canvas, 'RoomInfoPanel', 'textures/ui/room_panel', panelWidth, panelHeight, panelPos);

    this.createText(canvas, 'RoomCodeText', `房间号 ${room.roomId}`, layout.pos(0, 36.5), layout.s(2.45), new Color(255, 238, 171, 255));
    this.setChildContentSize(canvas, 'RoomCodeText', panelWidth * 0.78, panelHeight * 0.34);
    this.createText(
      canvas,
      'RuleText',
      `${this.settings.roundCount}轮 ${this.settings.fanCap}番 ${this.settings.allowChow ? '吃' : '无吃'} ${this.settings.allowPong ? '碰' : '无碰'} ${this.settings.xiaoJiWildEnabled ? '鸡万能' : '鸡非万能'} ${this.settings.allowMultiWin ? '多响' : '单响'}`,
      layout.pos(0, 31.5),
      layout.s(1.45),
      new Color(229, 248, 211, 255),
    );
    this.setChildContentSize(canvas, 'RuleText', panelWidth * 0.86, panelHeight * 0.25);

    const settings = createImageButton(
      canvas,
      'SettingsButton',
      '',
      'textures/ui/button_setting',
      () => this.showSettingsDialog(true),
      layout.pos(39, 34),
      layout.w(6),
      layout.h(6),
    );

    const leave = createImageButton(
      canvas,
      'LeaveRoomButton',
      '',
      'textures/ui/button_back',
      () => this.leaveRoom(),
      layout.pos(-43, 32),
      layout.w(6),
      layout.h(6),
    );
  }

  private createCenterStatus(canvas: Node, layout: RuntimeLayout): void {
    const panelWidth = layout.w(22);
    this.createImageByWidth(canvas, 'CenterStatusPanel', 'textures/ui/center_status_panel', panelWidth, CENTER_STATUS_RATIO, layout.pos(0, 1));
  }

  private createSeats(canvas: Node, layout: RuntimeLayout, room: RoomView, canManage: boolean): void {
    const seats = [0, 1, 2, 3].map((index) => room.seats.find((seat) => seat.seatIndex === index) || this.emptySeat(index));
    this.createSeat(canvas, layout, seats[0], 'SeatBottom', layout.pos(0, -19), true, canManage);
    this.createSeat(canvas, layout, seats[1], 'SeatRight', layout.pos(31, 0), false, canManage);
    this.createSeat(canvas, layout, seats[2], 'SeatTop', layout.pos(0, 19), false, canManage);
    this.createSeat(canvas, layout, seats[3], 'SeatLeft', layout.pos(-31, 0), false, canManage);
  }

  private createSeat(parent: Node, layout: RuntimeLayout, seat: RoomSeat, name: string, position: Vec3, isSelfPosition: boolean, canManage: boolean): void {
    const node = ensureChild(parent, name);
    node.setPosition(position);
    node.removeAllChildren();

    const currentUserId = this.currentUserId();
    const isLocalUser = seat.user?.id === currentUserId;
    const canManageOccupiedSeat = canManage && Boolean(seat.user) && !isLocalUser;
    const canRemoveAi = canManage && seat.isAI && !isLocalUser;
    const shouldShowDelete = AppConfig.USE_MOCK_HTTP ? canManageOccupiedSeat : canRemoveAi;
    const canTransfer = canManageOccupiedSeat && !seat.isAI && !seat.isOwner;
    const size = layout.s(isSelfPosition ? 15.5 : 14);
    const imagePath = !seat.user ? 'textures/ui/seat_empty' : seat.isAI ? 'textures/ui/seat_ai' : 'textures/ui/seat_player';

    this.createImageByWidth(node, 'SeatFrame', imagePath, size, SEAT_RATIO);
    if (seat.user) {
      const avatarSize = size * 0.44;
      const avatarPosition = new Vec3(0, size * 0.06, 0);
      const avatarFallback = seat.isAI ? 'textures/ui/default_avatar' : 'textures/ui/avatar_placeholder';
      createRemoteImage(
        node,
        'Avatar',
        seat.user.avatarUrl || '',
        avatarFallback,
        avatarSize,
        avatarSize,
        avatarPosition,
      );

      if (seat.isOwner) {
        this.createImageByWidth(
          node,
          'OwnerAvatarFrame',
          'textures/ui/avatar_placeholder',
          avatarSize * 1.34,
          SEAT_RATIO,
          avatarPosition,
        );
      }
    }

    const nickname = seat.user?.nickname || (seat.user ? '游客' : '空位');
    const status = seat.user ? (seat.isOwner ? '房主' : seat.isReady ? '已准备' : '未准备') : '等待中';
    this.createText(node, 'Nickname', nickname, new Vec3(0, -size * 0.28, 0), layout.s(isSelfPosition ? 1.55 : 1.35), Color.WHITE);
    this.setChildContentSize(node, 'Nickname', size * 1.25, size * 0.22);
    this.createText(
      node,
      'SeatStatus',
      status,
      new Vec3(0, -size * 0.44, 0),
      layout.s(isSelfPosition ? 1.3 : 1.15),
      seat.user ? new Color(255, 232, 153, 255) : new Color(178, 230, 202, 255),
    );
    this.setChildContentSize(node, 'SeatStatus', size * 1.12, size * 0.19);

    if (!seat.user && canManage) {
      const addAiButton = createButton(node, 'SeatAddAiButton', '+AI', () => void this.addAi(seat.seatIndex), new Vec3(size * 0.36, size * 0.27, 0));
      this.sizeButton(addAiButton, size * 0.36, size * 0.22);
      this.tintButton(addAiButton, new Color(20, 112, 82, 235));
      const addAiLabel = addAiButton.children.find((child) => child.name === 'Label')?.getComponent(Label);
      if (addAiLabel) {
        addAiLabel.fontSize = size * 0.13;
        addAiLabel.lineHeight = size * 0.16;
      }
      this.createClickHotspot(node, 'SeatAddAiHotspot', () => void this.addAi(seat.seatIndex), new Vec3(size * 0.36, size * 0.27, 0), size * 0.48, size * 0.32);
    }

    if (shouldShowDelete) {
      this.createImageByWidth(
        node,
        'DeleteSeatButton',
        'textures/ui/button_delete',
        size * 0.28,
        BUTTON_DELETE_RATIO,
        new Vec3(size * 0.43, size * 0.38, 0),
      ).on('touch-end', () => {
        if (AppConfig.USE_MOCK_HTTP) {
          roomManager.removeSeat(seat.seatIndex);
        } else {
          void this.removeAi(seat.seatIndex);
        }
      });
    }

    if (canTransfer) {
      const transfer = createButton(node, 'TransferOwnerButton', '转让', () => void this.transferOwner(seat.seatIndex), new Vec3(-size * 0.38, size * 0.34, 0));
      this.sizeButton(transfer, size * 0.45, size * 0.2);
      this.tintButton(transfer, new Color(175, 122, 35, 235));
    }
  }

  private createActionButtons(canvas: Node, layout: RuntimeLayout, isOwner: boolean): void {
    if (isOwner) {
      const addAiWidth = layout.w(20);
      createImageButton(
        canvas,
        'ButtonAddAi',
        '',
        'textures/ui/button_add_ai',
        () => this.addAiToFirstEmptySeat(),
        layout.pos(-16, -34),
        addAiWidth,
        addAiWidth / BUTTON_ADD_AI_RATIO,
      );
      this.createClickHotspot(canvas, 'ButtonAddAiHotspot', () => this.addAiToFirstEmptySeat(), layout.pos(-16, -34), addAiWidth, addAiWidth / BUTTON_ADD_AI_RATIO);

      const startWidth = layout.w(20);
      createImageButton(
        canvas,
        'ButtonStartGame',
        '',
        'textures/ui/button_start',
        () => this.startGame(),
        layout.pos(16, -34),
        startWidth,
        startWidth / BUTTON_START_RATIO,
      );
      return;
    }

    const readyWidth = layout.w(18);
    createImageButton(
      canvas,
      'ButtonReady',
      '',
      'textures/ui/badge_ready',
      () => void this.toggleReady(),
      layout.pos(0, -34),
      readyWidth,
      readyWidth / READY_BUTTON_RATIO,
    );
  }

  private createSettingsDialog(canvas: Node, layout: RuntimeLayout): void {
    const layer = ensureChild(canvas, 'SettingsDialogLayer');
    layer.removeAllChildren();
    layer.active = false;
    this.settingsLayer = layer;

    createPanel(layer, 'Mask', layout.width, layout.height, new Color(0, 0, 0, 160));

    const dialogWidth = layout.w(46);
    const dialogHeight = dialogWidth / PANEL_RATIO;
    createImage(layer, 'SettingsPanel', 'textures/ui/room_panel', dialogWidth, dialogHeight);
    this.createText(layer, 'SettingsTitle', '房间设置', layout.pos(0, 15), layout.s(3.2), new Color(255, 238, 171, 255));

    this.createText(layer, 'RoundTitle', '局数', layout.pos(-16, 7), layout.s(2.2));
    this.createRoundButtons(layer, layout);
    this.createToggleButton(layer, layout, '吃牌', 'allowChow', layout.pos(-10, -1));
    this.createToggleButton(layer, layout, '碰牌', 'allowPong', layout.pos(8, -1));
    this.createToggleButton(layer, layout, '小鸡万能', 'xiaoJiWildEnabled', layout.pos(-10, -6));
    this.createToggleButton(layer, layout, '一炮多响', 'allowMultiWin', layout.pos(8, -6));
    this.createFanCapButtons(layer, layout);
    this.createPublicKongButtons(layer, layout);

    createImageButton(
      layer,
      'CloseSettingsButton',
      '',
      'textures/ui/button_start',
      () => this.showSettingsDialog(false),
      layout.pos(0, -18),
      layout.w(12),
      layout.w(12) / BUTTON_START_RATIO,
    );
  }

  private createRoundButtons(parent: Node, layout: RuntimeLayout): void {
    const options: RoundCount[] = [8, 16, 24, 32];
    options.forEach((round, index) => {
      const selected = this.settings.roundCount === round;
      const button = createButton(
        parent,
        `Round${round}Button`,
        `${round}轮`,
        () => {
          this.settings.roundCount = round;
          this.applySettingsToRoom();
          this.showSettingsDialog(true);
        },
        layout.pos(-7 + index * 6, 7),
      );
      this.sizeButton(button, layout.w(5), layout.h(5));
      this.tintButton(button, selected ? new Color(185, 129, 41, 255) : new Color(21, 91, 67, 255));
    });
  }

  private createToggleButton(parent: Node, layout: RuntimeLayout, text: string, key: 'allowChow' | 'allowPong' | 'xiaoJiWildEnabled' | 'allowMultiWin', position: Vec3): void {
    const selected = this.settings[key];
    const button = createButton(
      parent,
      `${key}Button`,
      `${text} ${selected ? '开' : '关'}`,
      () => {
        this.settings[key] = !this.settings[key];
        this.applySettingsToRoom();
        this.showSettingsDialog(true);
      },
      position,
    );
    this.sizeButton(button, layout.w(14), layout.h(5));
    this.tintButton(button, selected ? new Color(27, 118, 80, 255) : new Color(58, 68, 63, 255));
  }

  private createFanCapButtons(parent: Node, layout: RuntimeLayout): void {
    this.createText(parent, 'FanCapTitle', '封顶', layout.pos(-16, -11), layout.s(2.1));
    ([3, 4] as const).forEach((fanCap, index) => {
      const button = createButton(
        parent,
        `FanCap${fanCap}Button`,
        `${fanCap}番`,
        () => {
          this.settings.fanCap = fanCap;
          this.applySettingsToRoom();
          this.showSettingsDialog(true);
        },
        layout.pos(-7 + index * 6, -11),
      );
      this.sizeButton(button, layout.w(5), layout.h(5));
      this.tintButton(button, this.settings.fanCap === fanCap ? new Color(185, 129, 41, 255) : new Color(21, 91, 67, 255));
    });
  }

  private createPublicKongButtons(parent: Node, layout: RuntimeLayout): void {
    this.createText(parent, 'PublicKongTitle', '公开杠牌', layout.pos(8, -11), layout.s(2.1));
    ([2, 4] as const).forEach((count, index) => {
      const button = createButton(
        parent,
        `PublicKong${count}Button`,
        `${count}张`,
        () => {
          this.settings.publicKongTiles = count;
          this.applySettingsToRoom();
          this.showSettingsDialog(true);
        },
        layout.pos(18 + index * 6, -11),
      );
      this.sizeButton(button, layout.w(5), layout.h(5));
      this.tintButton(button, this.settings.publicKongTiles === count ? new Color(185, 129, 41, 255) : new Color(21, 91, 67, 255));
    });
  }

  private applySettingsToRoom(): void {
    const room = this.ensureRoom();
    if (!this.isCurrentUserOwner()) return;
    const rules: RoomRules = {
      ...room.rules,
      roundCount: this.settings.roundCount,
      allowChow: this.settings.allowChow,
      allowPong: this.settings.allowPong,
      xiaoJiWildEnabled: this.settings.xiaoJiWildEnabled,
      fanCap: this.settings.fanCap,
      publicKongTiles: this.settings.publicKongTiles,
      allowMultiWin: this.settings.allowMultiWin,
    };
    roomManager.setRoom({ ...room, rules });
    void roomManager.updateRules(rules).catch((err) => {
      console.warn('[RoomSceneController] update rules failed', err);
      this.showNotice('设置保存失败');
    });
  }

  private async addAi(seatIndex: number): Promise<void> {
    try {
      await roomManager.addAi(seatIndex);
    } catch (err) {
      console.error('[RoomSceneController] add AI failed', err);
      this.showNotice('添加人机失败');
    }
  }

  private async removeAi(seatIndex: number): Promise<void> {
    try {
      await roomManager.removeAi(seatIndex);
    } catch (err) {
      console.error('[RoomSceneController] remove AI failed', err);
      this.showNotice('移除人机失败');
    }
  }

  private async transferOwner(seatIndex: number): Promise<void> {
    try {
      await roomManager.transferOwner(seatIndex);
    } catch (err) {
      console.error('[RoomSceneController] transfer owner failed', err);
      this.showNotice('转让房主失败');
    }
  }

  private showSettingsDialog(visible: boolean): void {
    if (visible && !this.isCurrentUserOwner()) {
      this.showNotice('只有房主可以修改房间设置');
      return;
    }
    if (this.settingsLayer) this.settingsLayer.active = visible;
  }

  private syncSettingsFromRoom(room: RoomView | null): void {
    if (!room) return;
    this.settings = {
      roundCount: room.rules.roundCount || this.settings.roundCount,
      allowChow: room.rules.allowChow,
      allowPong: room.rules.allowPong,
      xiaoJiWildEnabled: room.rules.xiaoJiWildEnabled,
      allowMultiWin: room.rules.allowMultiWin,
      fanCap: room.rules.fanCap === 4 ? 4 : 3,
      publicKongTiles: room.rules.publicKongTiles === 4 ? 4 : 2,
    };
  }

  private ensureRoom(): RoomView {
    if (roomManager.currentRoom) return roomManager.currentRoom;

    const user = authManager.user || { id: 'u_001', nickname: '游客' };
    const room: RoomView = {
      roomId: '886688',
      ownerId: user.id,
      status: 'WAITING',
      rules: {
        preset: 'qujing-fei-xiaoji-v1.5',
        roundCount: this.settings.roundCount,
        allowChow: this.settings.allowChow,
        allowPong: this.settings.allowPong,
        xiaoJiWildEnabled: this.settings.xiaoJiWildEnabled,
        fanCap: this.settings.fanCap,
        publicKongTiles: this.settings.publicKongTiles,
        xiaoJiTile: '1-tiao',
        drawMode: 'fixed-wall-reserve',
        allowMultiWin: this.settings.allowMultiWin,
      },
      seats: [
        { seatIndex: 0, user, isReady: true, isOwner: true },
        this.emptySeat(1),
        this.emptySeat(2),
        this.emptySeat(3),
      ],
    };
    roomManager.currentRoom = room;
    return room;
  }

  private emptySeat(seatIndex: number): RoomSeat {
    return { seatIndex, isReady: false };
  }

  private isOwner(room: RoomView): boolean {
    const userId = this.currentUserId();
    return room.ownerId === userId || room.seats.some((seat) => seat.isOwner && seat.user?.id === userId);
  }

  private isCurrentUserOwner(): boolean {
    return this.isOwner(this.ensureRoom());
  }

  private allHumansReady(): boolean {
    return this.ensureRoom().seats
      .filter((seat) => Boolean(seat.user) && !seat.isAI)
      .every((seat) => seat.isReady);
  }

  private startRoomPolling(): void {
    this.stopRoomPolling();
    this.roomPollTimer = setInterval(() => {
      if (this.roomPolling) return;
      this.roomPolling = true;
      roomManager.refreshRoom()
        .catch((error) => console.warn('[RoomSceneController] room poll failed', error))
        .finally(() => {
          this.roomPolling = false;
        });
    }, 1000);
    (this.roomPollTimer as unknown as { unref?: () => void }).unref?.();
  }

  private stopRoomPolling(): void {
    if (!this.roomPollTimer) return;
    clearInterval(this.roomPollTimer);
    this.roomPollTimer = null;
  }

  private currentUserId(): string {
    return authManager.user?.id || 'u_001';
  }

  private showNotice(title: string): void {
    const wxApi = (globalThis as { wx?: { showToast?: (options: { title: string; icon?: 'none'; duration?: number }) => void } }).wx;
    if (wxApi?.showToast) {
      wxApi.showToast({ title, icon: 'none', duration: 1600 });
      return;
    }

    console.warn(`[RoomSceneController] ${title}`);
  }

  private bindRoomEvents(): void {
    const bus = eventBus as unknown as {
      on(type: string, callback: (room: RoomView) => void, target?: unknown): void;
    };
    bus.on(GameEvents.ROOM_CHANGED, this.handleRoomChanged, this);
  }

  private unbindRoomEvents(): void {
    const bus = eventBus as unknown as {
      off(type: string, callback: (room: RoomView) => void, target?: unknown): void;
    };
    bus.off(GameEvents.ROOM_CHANGED, this.handleRoomChanged, this);
  }

  private createText(parent: Node, name: string, text: string, position: Vec3, fontSize: number, color = Color.WHITE): Label {
    const label = createLabel(parent, name, text, position);
    label.fontSize = fontSize * TEXT_SCALE;
    label.lineHeight = label.fontSize * 1.15;
    label.color = color;
    return label;
  }

  private sizeButton(button: Node, width: number, height: number): void {
    button.getComponent(UITransform)?.setContentSize(width, height);
    const label = button.children.find((child) => child.name === 'Label')?.getComponent(Label);
    if (label) {
      label.fontSize = Math.min(height * 0.38, width * 0.22);
      label.lineHeight = label.fontSize * 1.15;
      label.node.getComponent(UITransform)?.setContentSize(width * 0.86, height * 0.72);
    }
  }

  private setChildContentSize(parent: Node, childName: string, width: number, height: number): void {
    parent.children.find((child) => child.name === childName)?.getComponent(UITransform)?.setContentSize(width, height);
  }

  private bringToFront(node: Node): void {
    (node as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(9999);
  }

  private tintButton(node: Node, color: Color): void {
    const sprite = node.getComponent(Sprite);
    if (sprite) sprite.color = color;
  }

  private createClickHotspot(parent: Node, name: string, onClick: () => void, position: Vec3, width: number, height: number): Node {
    const hotspot = createPanel(parent, name, width, height, new Color(255, 255, 255, 1), position);
    hotspot.off('touch-end', onClick);
    hotspot.on('touch-end', onClick);
    return hotspot;
  }

  private createImageByWidth(parent: Node, name: string, path: string, width: number, ratio: number, position = Vec3.ZERO): Node {
    return createImage(parent, name, path, width, width / ratio, position);
  }

  private createCoverImage(parent: Node, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }
}
