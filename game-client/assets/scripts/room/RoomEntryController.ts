import { _decorator, Color, Node, Rect, resources, Sprite, SpriteFrame, Texture2D, UITransform, Vec3 } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { gameManager } from '../game/GameManager';
import {
  createImage,
  createImageButton,
  createLayout,
  createPanel,
  ensureCanvas,
  ensureChild,
  ensureComponent,
} from '../ui/RuntimeUi';
import { roomManager } from './RoomManager';

const { ccclass } = _decorator;

const ROOM_ENTRY_BG_RATIO = 1672 / 941;
const ROOM_ENTRY_TITLE_RATIO = 874 / 323;
const ROOM_CODE_PANEL_RATIO = 2172 / 724;
const ROOM_ENTRY_BUTTON_RATIO = 2345 / 670;

const ROOM_CODE_DIGIT_RECTS = [
  { x: 70, yFromTop: 270, width: 147, height: 216 },
  { x: 215, yFromTop: 270, width: 214, height: 213 },
  { x: 490, yFromTop: 270, width: 137, height: 214 },
  { x: 605, yFromTop: 270, width: 224, height: 216 },
  { x: 805, yFromTop: 270, width: 223, height: 211 },
  { x: 1005, yFromTop: 270, width: 223, height: 215 },
  { x: 1205, yFromTop: 270, width: 224, height: 217 },
  { x: 1405, yFromTop: 270, width: 223, height: 216 },
  { x: 1595, yFromTop: 270, width: 210, height: 216 },
  { x: 1825, yFromTop: 270, width: 156, height: 215 },
];

@ccclass('RoomEntryController')
export class RoomEntryController extends BaseScene {
  private roomCode = '';
  private digitTexture: Texture2D | null = null;
  private codeDigitNodes: Node[] = [];
  private codeDigitHeight = 72;
  private codeDigitWidth = 40;
  private submitting = false;
  private keyboardInputHandler: ((event: { value: string }) => void) | null = null;
  private keyboardConfirmHandler: ((event: { value: string }) => void) | null = null;
  private keyboardCompleteHandler: ((event: { value: string }) => void) | null = null;

  async start(): Promise<void> {
    console.log('[RoomEntryController] start');
    gameManager.leaveGame();
    await this.enter();
    this.buildRuntimeUi();
  }

  private buildRuntimeUi(): void {
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);
    const layout = createLayout();

    this.createCoverImage(canvas, 'Background', 'textures/ui/room_entry_bg', layout.width, layout.height, ROOM_ENTRY_BG_RATIO);
    createPanel(canvas, 'FallbackBackground', layout.width, layout.height, new Color(0, 0, 0, 25));

    createImage(canvas, 'BackButton', 'textures/ui/button_back', layout.s(8), layout.s(8), layout.pos(-40, 30));
    canvas.children.find((child) => child.name === 'BackButton')?.on('touch-end', () => {
      this.hideRoomCodeKeyboard();
      loadScene('Lobby');
    });

    const titleWidth = layout.w(30);
    createImage(canvas, 'TitleImage', 'textures/ui/room_entry_title', titleWidth, titleWidth / ROOM_ENTRY_TITLE_RATIO, layout.pos(-24, 22));
    createImage(canvas, 'RoomIcon', 'textures/ui/icon_room', layout.s(22), layout.s(22), layout.pos(-24, -5));

    const codePanelWidth = layout.w(43);
    const codePanelHeight = codePanelWidth / ROOM_CODE_PANEL_RATIO;
    const codePanelPosition = layout.pos(22, 10);
    createPanel(canvas, 'CodePanelFallback', codePanelWidth, codePanelHeight, new Color(14, 48, 39, 180), codePanelPosition);
    createImage(canvas, 'RoomCodePanel', 'textures/ui/room_code_panel', codePanelWidth, codePanelHeight, codePanelPosition);
    canvas.children.find((child) => child.name === 'RoomCodePanel')?.on('touch-end', () => this.openRoomCodeKeyboard());
    canvas.children.find((child) => child.name === 'CodePanelFallback')?.on('touch-end', () => this.openRoomCodeKeyboard());
    this.createRoomCodeDigits(canvas, codePanelPosition, codePanelWidth, codePanelHeight);

    const buttonWidth = layout.w(24);
    const buttonHeight = buttonWidth / ROOM_ENTRY_BUTTON_RATIO;

    createImageButton(
      canvas,
      'CreateRoomButton',
      '',
      'textures/ui/button_create_room',
      () => void this.createRoom(),
      layout.pos(10, -17),
      buttonWidth,
      buttonHeight,
    );

    createImageButton(
      canvas,
      'JoinRoomButton',
      '',
      'textures/ui/button_join_room',
      () => void this.joinRoom(),
      layout.pos(34, -17),
      buttonWidth,
      buttonHeight,
    );
  }

  private openRoomCodeKeyboard(): void {
    const wxApi = (globalThis as { wx?: WechatKeyboardApi }).wx;
    if (wxApi?.showKeyboard) {
      this.unbindKeyboardHandlers();
      wxApi.showKeyboard({
        defaultValue: this.roomCode,
        maxLength: 6,
        multiple: false,
        confirmHold: false,
        confirmType: 'done',
      });
      this.keyboardInputHandler = (event) => this.setRoomCode(event.value);
      this.keyboardConfirmHandler = (event) => {
        this.setRoomCode(event.value);
        this.hideRoomCodeKeyboard();
      };
      this.keyboardCompleteHandler = (event) => this.setRoomCode(event.value);
      wxApi.onKeyboardInput?.(this.keyboardInputHandler);
      wxApi.onKeyboardConfirm?.(this.keyboardConfirmHandler);
      wxApi.onKeyboardComplete?.(this.keyboardCompleteHandler);
      return;
    }

    const browserInput = globalThis.prompt?.('请输入房间号', this.roomCode);
    if (browserInput !== null && browserInput !== undefined) this.setRoomCode(browserInput);
  }

  private hideRoomCodeKeyboard(): void {
    const wxApi = (globalThis as { wx?: WechatKeyboardApi }).wx;
    wxApi?.hideKeyboard?.();
  }

  private unbindKeyboardHandlers(): void {
    const wxApi = (globalThis as { wx?: WechatKeyboardApi }).wx;
    if (this.keyboardInputHandler) wxApi?.offKeyboardInput?.(this.keyboardInputHandler);
    if (this.keyboardConfirmHandler) wxApi?.offKeyboardConfirm?.(this.keyboardConfirmHandler);
    if (this.keyboardCompleteHandler) wxApi?.offKeyboardComplete?.(this.keyboardCompleteHandler);
    this.keyboardInputHandler = null;
    this.keyboardConfirmHandler = null;
    this.keyboardCompleteHandler = null;
  }

  private setRoomCode(value: string): void {
    this.roomCode = value.replace(/\D/g, '').slice(0, 6);
    this.renderCode();
  }

  private renderCode(): void {
    this.codeDigitNodes.forEach((node, index) => {
      const digit = this.roomCode[index];
      node.active = Boolean(digit && this.digitTexture);
      if (!digit || !this.digitTexture) return;
      const frame = new SpriteFrame();
      const rect = ROOM_CODE_DIGIT_RECTS[Number(digit)];
      const textureHeight = this.digitTexture.height || 793;
      frame.texture = this.digitTexture;
      frame.rect = new Rect(rect.x, textureHeight - rect.yFromTop - rect.height, rect.width, rect.height);
      const digitWidth = this.codeDigitHeight * (rect.width / rect.height);
      ensureComponent(node, UITransform).setContentSize(digitWidth, this.codeDigitHeight);
      ensureComponent(node, Sprite).spriteFrame = frame;
    });
  }

  private createRoomCodeDigits(canvas: Node, panelPosition: Vec3, panelWidth: number, panelHeight: number): void {
    const digitHeight = panelHeight * 0.3;
    this.codeDigitHeight = digitHeight;
    this.codeDigitWidth = panelWidth * 0.06;
    const digitGap = panelWidth * 0.110;
    this.codeDigitNodes = [];

    for (let index = 0; index < 6; index += 1) {
      const node = ensureChild(canvas, `RoomCodeDigit${index}`);
      node.active = false;
      node.setPosition(new Vec3(panelPosition.x + (index - 2.5) * digitGap, panelPosition.y, 0));
      ensureComponent(node, UITransform).setContentSize(this.codeDigitWidth, this.codeDigitHeight);
      const sprite = ensureComponent(node, Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.codeDigitNodes.push(node);
    }

    resources.load('textures/ui/room_code_digits/texture', Texture2D, (err, texture) => {
      if (err || !texture) {
        console.warn('[RoomEntryController] failed to load room_code_digits', err);
        return;
      }
      this.digitTexture = texture;
      this.renderCode();
    });
  }

  private createCoverImage(parent: Node, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }

  private async createRoom(): Promise<void> {
    if (this.submitting) return;
    if (!this.isCompleteRoomCode()) {
      this.showNotice('请输入 6 位房间号');
      this.openRoomCodeKeyboard();
      return;
    }

    this.submitting = true;
    try {
      const preview = await roomManager.previewRoom(this.roomCode);
      if (preview.exists) {
        this.showNotice('该房间号已存在');
        return;
      }

      await roomManager.createRoom(this.roomCode);
      this.hideRoomCodeKeyboard();
      loadScene('Room');
    } catch (err) {
      console.error('[RoomEntryController] create room failed', err);
      this.showNotice('创建房间失败');
    } finally {
      this.submitting = false;
    }
  }

  private async joinRoom(): Promise<void> {
    if (this.submitting) return;
    if (!this.isCompleteRoomCode()) {
      this.showNotice('请输入 6 位房间号');
      this.openRoomCodeKeyboard();
      return;
    }

    this.submitting = true;
    try {
      const preview = await roomManager.previewRoom(this.roomCode);
      if (!preview.exists) {
        this.showNotice('房间号不存在');
        return;
      }
      if (!preview.canJoin) {
        this.showNotice(preview.message || '该房间不可加入');
        return;
      }

      await roomManager.joinRoom(this.roomCode);
      this.hideRoomCodeKeyboard();
      loadScene('Room');
    } catch (err) {
      console.error('[RoomEntryController] join room failed', err);
      this.showNotice('加入房间失败');
    } finally {
      this.submitting = false;
    }
  }

  private isCompleteRoomCode(): boolean {
    return /^\d{6}$/.test(this.roomCode);
  }

  private showNotice(title: string): void {
    const wxApi = (globalThis as { wx?: WechatToastApi }).wx;
    if (wxApi?.showToast) {
      wxApi.showToast({ title, icon: 'none', duration: 1600 });
      return;
    }

    console.warn(`[RoomEntryController] ${title}`);
  }
}

interface WechatToastApi {
  showToast(options: { title: string; icon?: 'none' | 'success' | 'loading' | 'error'; duration?: number }): void;
}

interface WechatKeyboardApi {
  showKeyboard(options: {
    defaultValue?: string;
    maxLength?: number;
    multiple?: boolean;
    confirmHold?: boolean;
    confirmType?: string;
  }): void;
  hideKeyboard?(): void;
  onKeyboardInput?(callback: (event: { value: string }) => void): void;
  onKeyboardConfirm?(callback: (event: { value: string }) => void): void;
  onKeyboardComplete?(callback: (event: { value: string }) => void): void;
  offKeyboardInput?(callback: (event: { value: string }) => void): void;
  offKeyboardConfirm?(callback: (event: { value: string }) => void): void;
  offKeyboardComplete?(callback: (event: { value: string }) => void): void;
}
