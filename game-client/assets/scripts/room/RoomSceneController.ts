import { _decorator, Color, Label, Node, Sprite, UITransform, Vec3 } from 'cc';
import { GameEvents } from '../app/GameEvents';
import { loadScene } from '../app/SceneNavigator';
import { authManager } from '../auth/AuthManager';
import { BaseScene } from '../core/BaseScene';
import { eventBus } from '../core/EventBus';
import {
  createButton,
  createImage,
  createImageButton,
  createLabel,
  createLayout,
  createPanel,
  ensureCanvas,
  ensureChild,
  RuntimeLayout,
} from '../ui/RuntimeUi';
import { roomManager } from './RoomManager';
import type { RoomSeat, RoomView } from './RoomTypes';

const { ccclass } = _decorator;

type RoundCount = 8 | 16 | 24 | 32;

interface RoomLocalSettings {
  roundCount: RoundCount;
  allowChow: boolean;
  allowMultiWin: boolean;
  fanCap: 3 | 4;
  publicKongTiles: 2 | 4;
}

const ROOM_BG_RATIO = 1672 / 941;
const PANEL_RATIO = 640 / 260;
const CENTER_STATUS_RATIO = 360 / 180;
const SEAT_RATIO = 1;
const AVATAR_RATIO = 1;
const BUTTON_START_RATIO = 420 / 120;
const BUTTON_ADD_AI_RATIO = 360 / 100;

@ccclass('RoomSceneController')
export class RoomSceneController extends BaseScene {
  private settingsLayer: Node | null = null;
  private settings: RoomLocalSettings = {
    roundCount: 16,
    allowChow: true,
    allowMultiWin: true,
    fanCap: 3,
    publicKongTiles: 2,
  };

  private readonly handleRoomChanged = (room: RoomView): void => {
    if (room.status === 'PLAYING') {
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
  }

  onDestroy(): void {
    this.unbindRoomEvents();
  }

  async addAiToFirstEmptySeat(): Promise<void> {
    const room = this.ensureRoom();
    const emptySeat = room.seats.find((seat) => !seat.user);
    if (!emptySeat) return;
    await roomManager.addAi(emptySeat.seatIndex);
  }

  async startGame(): Promise<void> {
    const gameId = await roomManager.startGame();
    if (!roomManager.currentRoom) return;
    loadScene('Game');
    void gameId;
  }

  toggleLocalReady(): void {
    const room = this.ensureRoom();
    const userId = authManager.user?.id || 'u_001';
    roomManager.setRoom({
      ...room,
      seats: room.seats.map((seat) =>
        seat.user?.id === userId ? { ...seat, isReady: !seat.isReady } : seat,
      ),
    });
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
    this.createSeats(uiLayer, layout, room);
    this.createActionButtons(uiLayer, layout, isOwner);
    this.createSettingsDialog(uiLayer, layout);

    this.bringToFront(uiLayer);
  }

  private createBackground(canvas: Node, layout: RuntimeLayout): void {
    createPanel(canvas, 'BackgroundColor', layout.width, layout.height, new Color(5, 38, 29, 255));

    const screenRatio = layout.width / layout.height;
    const bgWidth = screenRatio > ROOM_BG_RATIO ? layout.width : layout.height * ROOM_BG_RATIO;
    const bgHeight = bgWidth / ROOM_BG_RATIO;
    createImage(canvas, 'RoomBackground', 'textures/ui/room_bg', bgWidth, bgHeight);
  }

  private createTopInfo(canvas: Node, layout: RuntimeLayout, room: RoomView): void {
    const panelWidth = layout.s(50);
    const panelHeight = panelWidth / PANEL_RATIO;

    const panelPos = layout.pos(-31, 31);

    createImage(
      canvas,
      'RoomInfoPanel',
      'textures/ui/room_panel',
      panelWidth,
      panelHeight,
      panelPos,
    );

    this.createText(
      canvas,
      'RoomCodeText',
      `房间号 ${room.roomId}`,
      layout.pos(-36, 33),
      layout.s(3.0),
      new Color(255, 238, 171, 255),
    );

    this.createText(
      canvas,
      'RuleText',
      `${this.settings.roundCount}轮  三番封顶  小鸡万能  一炮多响`,
      layout.pos(-35, 28.8),
      layout.s(1.75),
      new Color(229, 248, 211, 255),
    );

    // 设置按钮放在面板内部右侧
    const settings = createButton(
      canvas,
      'SettingsButton',
      '设置',
      () => this.showSettingsDialog(true),
      layout.pos(-11, 31),
    );

    this.sizeButton(settings, layout.s(7.5), layout.s(4.2));
    this.tintButton(settings, new Color(18, 95, 67, 235));
  }

  private createCenterStatus(canvas: Node, layout: RuntimeLayout): void {
    const panelWidth = layout.s(24);
    this.createImageByWidth(canvas, 'CenterStatusPanel', 'textures/ui/center_status_panel', panelWidth, CENTER_STATUS_RATIO, layout.pos(0, 0));
    // this.createText(canvas, 'CenterStatusText', '等待入座', layout.pos(0, 0.2), layout.s(2.1), new Color(255, 237, 167, 255));
  }

  private createSeats(canvas: Node, layout: RuntimeLayout, room: RoomView): void {
    const seats = [0, 1, 2, 3].map((index) => room.seats.find((seat) => seat.seatIndex === index) || this.emptySeat(index));
    this.createSeat(canvas, layout, seats[0], 'SeatBottom', layout.pos(0, -28), true);
    this.createSeat(canvas, layout, seats[1], 'SeatRight', layout.pos(39, -1), false);
    this.createSeat(canvas, layout, seats[2], 'SeatTop', layout.pos(0, 17), false);
    this.createSeat(canvas, layout, seats[3], 'SeatLeft', layout.pos(-39, -1), false);
  }

  private createSeat(parent: Node, layout: RuntimeLayout, seat: RoomSeat, name: string, position: Vec3, isSelf: boolean): void {
    const node = ensureChild(parent, name);
    node.setPosition(position);
    node.removeAllChildren();

    const size = layout.s(isSelf ? 18 : 16);
    const imagePath = !seat.user ? 'textures/ui/seat_empty' : seat.isAI ? 'textures/ui/seat_ai' : 'textures/ui/seat_player';
    this.createImageByWidth(node, 'SeatFrame', imagePath, size, SEAT_RATIO);
    this.createImageByWidth(node, 'Avatar', 'textures/ui/avatar_placeholder', size * 0.34, AVATAR_RATIO, new Vec3(0, size * 0.04, 0));

    const nickname = seat.user?.nickname || '空位';
    const status = seat.user ? (seat.isReady ? '已准备' : seat.isOwner ? '房主' : '未准备') : '等待中';
    this.createText(node, 'Nickname', nickname, new Vec3(0, -size * 0.32, 0), layout.s(isSelf ? 2.25 : 1.95), Color.WHITE);
    this.setChildContentSize(node, 'Nickname', size * 1.45, size * 0.25);

    this.createText(
      node,
      'SeatStatus',
      status,
      new Vec3(0, -size * 0.49, 0),
      layout.s(isSelf ? 1.85 : 1.65),
      seat.user ? new Color(255, 232, 153, 255) : new Color(178, 230, 202, 255),
    );
    this.setChildContentSize(node, 'SeatStatus', size * 1.25, size * 0.22);

    if (!seat.user) {
      const addAiButton = createButton(node, 'SeatAddAiButton', '+AI', () => void roomManager.addAi(seat.seatIndex), new Vec3(size * 0.36, size * 0.27, 0));
      this.sizeButton(addAiButton, size * 0.32, size * 0.2);
      this.tintButton(addAiButton, new Color(20, 112, 82, 235));
    }
  }

  private createActionButtons(canvas: Node, layout: RuntimeLayout, isOwner: boolean): void {
    if (isOwner) {
      const addAiWidth = layout.s(35);
      createImageButton(
        canvas,
        'ButtonAddAi',
        '',
        'textures/ui/button_add_ai',
        () => void this.addAiToFirstEmptySeat(),
        layout.pos(-16, 0),
        addAiWidth,
        addAiWidth / BUTTON_ADD_AI_RATIO,
      );

      const startWidth = layout.s(31);
      createImageButton(
        canvas,
        'ButtonStartGame',
        '',
        'textures/ui/button_start',
        () => void this.startGame(),
        layout.pos(16, 0),
        startWidth,
        startWidth / BUTTON_START_RATIO,
      );
      return;
    }

    const readyWidth = layout.s(31);
    createImageButton(
      canvas,
      'ButtonReady',
      '',
      'textures/ui/badge_ready',
      () => this.toggleLocalReady(),
      layout.pos(0, 0),
      readyWidth,
      readyWidth / BUTTON_START_RATIO,
    );
  }

  private createSettingsDialog(canvas: Node, layout: RuntimeLayout): void {
    const layer = ensureChild(canvas, 'SettingsDialogLayer');
    layer.removeAllChildren();
    layer.active = false;
    this.settingsLayer = layer;

    createPanel(layer, 'Mask', layout.width, layout.height, new Color(0, 0, 0, 160));

    const dialogWidth = layout.w(50);
    const dialogHeight = dialogWidth / PANEL_RATIO;
    createImage(layer, 'SettingsPanel', 'textures/ui/room_panel', dialogWidth, dialogHeight);
    this.createText(layer, 'SettingsTitle', '房间设置', layout.pos(0, 16), layout.s(3.4), new Color(255, 238, 171, 255));

    this.createText(layer, 'RoundTitle', '局数', layout.pos(-17, 8), layout.s(2.4));
    this.createRoundButtons(layer, layout);
    this.createToggleButton(layer, layout, '吃牌', 'allowChow', layout.pos(-10, -1));
    this.createToggleButton(layer, layout, '一炮多响', 'allowMultiWin', layout.pos(12, -1));
    this.createFanCapButtons(layer, layout);
    this.createPublicKongButtons(layer, layout);

    const confirm = createImageButton(
      layer,
      'CloseSettingsButton',
      '确定',
      'textures/ui/button_start',
      () => this.showSettingsDialog(false),
      layout.pos(0, -17),
      layout.w(12),
      layout.w(12) / BUTTON_START_RATIO,
    );
    this.tintButton(confirm, new Color(255, 255, 255, 255));
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
          this.buildRuntimeUi();
          this.showSettingsDialog(true);
        },
        layout.pos(-8 + index * 6.2, 8),
      );
      this.sizeButton(button, layout.w(5.4), layout.h(5.4));
      this.tintButton(button, selected ? new Color(185, 129, 41, 255) : new Color(21, 91, 67, 255));
    });
  }

  private createToggleButton(parent: Node, layout: RuntimeLayout, text: string, key: 'allowChow' | 'allowMultiWin', position: Vec3): void {
    const selected = this.settings[key];
    const button = createButton(
      parent,
      `${key}Button`,
      `${text} ${selected ? '开' : '关'}`,
      () => {
        this.settings[key] = !this.settings[key];
        this.buildRuntimeUi();
        this.showSettingsDialog(true);
      },
      position,
    );
    this.sizeButton(button, layout.w(16), layout.h(5.2));
    this.tintButton(button, selected ? new Color(27, 118, 80, 255) : new Color(58, 68, 63, 255));
  }

  private createFanCapButtons(parent: Node, layout: RuntimeLayout): void {
    this.createText(parent, 'FanCapTitle', '封顶', layout.pos(-17, -8), layout.s(2.3));
    ([3, 4] as const).forEach((fanCap, index) => {
      const button = createButton(
        parent,
        `FanCap${fanCap}Button`,
        `${fanCap}番`,
        () => {
          this.settings.fanCap = fanCap;
          this.buildRuntimeUi();
          this.showSettingsDialog(true);
        },
        layout.pos(-7 + index * 7, -8),
      );
      this.sizeButton(button, layout.w(5.8), layout.h(5.2));
      this.tintButton(button, this.settings.fanCap === fanCap ? new Color(185, 129, 41, 255) : new Color(21, 91, 67, 255));
    });
  }

  private createPublicKongButtons(parent: Node, layout: RuntimeLayout): void {
    this.createText(parent, 'PublicKongTitle', '公开杠牌', layout.pos(8, -8), layout.s(2.3));
    ([2, 4] as const).forEach((count, index) => {
      const button = createButton(
        parent,
        `PublicKong${count}Button`,
        `${count}张`,
        () => {
          this.settings.publicKongTiles = count;
          this.buildRuntimeUi();
          this.showSettingsDialog(true);
        },
        layout.pos(18 + index * 7, -8),
      );
      this.sizeButton(button, layout.w(5.8), layout.h(5.2));
      this.tintButton(button, this.settings.publicKongTiles === count ? new Color(185, 129, 41, 255) : new Color(21, 91, 67, 255));
    });
  }

  private showSettingsDialog(visible: boolean): void {
    if (this.settingsLayer) this.settingsLayer.active = visible;
  }

  private syncSettingsFromRoom(room: RoomView | null): void {
    if (!room) return;
    this.settings = {
      roundCount: room.rules.roundCount || this.settings.roundCount,
      allowChow: room.rules.allowChow,
      allowMultiWin: room.rules.allowMultiWin,
      fanCap: room.rules.fanCap === 4 ? 4 : 3,
      publicKongTiles: room.rules.publicKongTiles === 4 ? 4 : 2,
    };
  }

  private ensureRoom(): RoomView {
    if (roomManager.currentRoom) return roomManager.currentRoom;

    const room: RoomView = {
      roomId: '886688',
      ownerId: authManager.user?.id || 'u_001',
      status: 'WAITING',
      rules: {
        preset: 'qujing-fei-xiao-ji-v1.5',
        roundCount: this.settings.roundCount,
        allowChow: this.settings.allowChow,
        fanCap: this.settings.fanCap,
        publicKongTiles: this.settings.publicKongTiles,
        xiaoJiTile: '1-tiao',
        drawMode: 'fixed-wall-reserve',
        allowMultiWin: this.settings.allowMultiWin,
      },
      seats: [this.localSeat(), this.emptySeat(1), this.emptySeat(2), this.emptySeat(3)],
    };
    roomManager.currentRoom = room;
    return room;
  }

  private emptySeat(seatIndex: number): RoomSeat {
    return { seatIndex, isReady: false };
  }

  private localSeat(): RoomSeat {
    return {
      seatIndex: 0,
      user: authManager.user || { id: 'u_001', nickname: 'Mock玩家' },
      isReady: true,
      isOwner: true,
    };
  }

  private isOwner(room: RoomView): boolean {
    const userId = authManager.user?.id || 'u_001';
    return room.ownerId === userId || room.seats.some((seat) => seat.isOwner && seat.user?.id === userId);
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
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.15;
    label.color = color;
    return label;
  }

  private sizeButton(button: Node, width: number, height: number): void {
    button.getComponent(UITransform)?.setContentSize(width, height);
    const label = button.children.find((child) => child.name === 'Label')?.getComponent(Label);
    if (label) {
      label.fontSize = Math.min(height * 0.38, width * 0.22);
      label.lineHeight = label.fontSize * 1.15;
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

  private createImageByWidth(parent: Node, name: string, path: string, width: number, ratio: number, position = Vec3.ZERO): Node {
    return createImage(parent, name, path, width, width / ratio, position);
  }
}
