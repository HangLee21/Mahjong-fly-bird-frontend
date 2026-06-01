import { _decorator, Color, Label, Node, UITransform, Vec3 } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { getTileTexturePath, TILE_BACK_TEXTURE } from '../assets/TileAssetMap';
import type { LocalSeatPosition, PlayerGameView, PlayerPublicView, TileId } from '../game/GameTypes';
import { getTileLabel } from '../utils/TileUtils';
import { mockReplay } from '../mock/MockData';
import {
  createImage,
  createImageButton,
  createLabel,
  createLayout,
  createPanel,
  createRemoteImage,
  ensureCanvas,
  ensureChild,
  ensureComponent,
  RuntimeLayout,
} from '../ui/RuntimeUi';
import { replayManager } from './ReplayManager';

const { ccclass } = _decorator;

const GAME_BG_RATIO = 1672 / 941;
const BUTTON_RATIO = 420 / 120;
const PLAYER_PANEL_RATIO_SELF = 560 / 170;
const PLAYER_PANEL_RATIO_OTHER = 460 / 150;
const CENTER_STATUS_RATIO = 360 / 180;

@ccclass('ReplayController')
export class ReplayController extends BaseScene {
  private canvas: Node | null = null;
  private replayLayer: Node | null = null;

  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    await replayManager.load(mockReplay.gameId);
    this.buildRuntimeUi();
    this.render();
  }

  private nextStep(): void {
    replayManager.next();
    this.render();
  }

  private previousStep(): void {
    replayManager.previous();
    this.render();
  }

  private render(): void {
    const step = replayManager.current();
    if (!step || !this.canvas || !this.replayLayer) return;

    this.replayLayer.removeAllChildren();
    const layout = createLayout();
    const view = step.view;

    this.createTopInfo(this.replayLayer, layout, view);
    this.createCenterInfo(this.replayLayer, layout, view, step.stepIndex);
    this.createPlayers(this.replayLayer, layout, view);
    this.createControls(this.canvas, layout);
  }

  private buildRuntimeUi(): void {
    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);
    this.canvas = canvas;

    const layout = createLayout();
    createPanel(canvas, 'BackgroundFallback', layout.width, layout.height, new Color(4, 45, 33, 255));
    this.createCoverImage(canvas, 'Background', 'textures/ui/game_bg', layout.width, layout.height, GAME_BG_RATIO);

    this.replayLayer = ensureChild(canvas, 'ReplayLayer');
    this.replayLayer.removeAllChildren();
  }

  private createTopInfo(parent: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    createPanel(parent, 'TitlePanelFallback', layout.w(42), layout.h(8), new Color(8, 58, 43, 215), layout.pos(0, 41));
    createImage(parent, 'TitlePanel', 'textures/ui/hud_panel_top', layout.w(42), layout.h(8), layout.pos(0, 41));
    this.createText(parent, 'ReplayTitle', `牌局回放  ${view.roomId}`, layout.pos(0, 42.3), layout.s(2.2), new Color(255, 236, 171, 255));
    this.createText(parent, 'ReplaySubTitle', `第 ${replayManager.index + 1} / ${replayManager.record?.steps.length || 1} 步`, layout.pos(0, 39.5), layout.s(1.55), new Color(218, 244, 205, 255));
  }

  private createCenterInfo(parent: Node, layout: RuntimeLayout, view: PlayerGameView, stepIndex: number): void {
    const centerWidth = layout.w(18);
    createImage(parent, 'CenterStatusPanel', 'textures/ui/center_status_panel', centerWidth, centerWidth / CENTER_STATUS_RATIO, layout.pos(0, 3));
    const lastDiscard = view.lastDiscard ? `${getTileLabel(view.lastDiscard.tile)} / ${view.lastDiscard.fromPlayer}号` : '无';
    this.createText(parent, 'ReplayCurrent', `当前 ${view.currentPlayer}号`, layout.pos(0, 6.5), layout.s(1.65), new Color(255, 238, 168, 255));
    this.createText(parent, 'ReplayStep', `步骤 ${stepIndex}`, layout.pos(0, 2.8), layout.s(1.45));
    this.createText(parent, 'ReplayLastDiscard', `上张 ${lastDiscard}`, layout.pos(0, -0.8), layout.s(1.35));

    const kongWidth = layout.w(18);
    createImage(parent, 'PublicKongPanel', 'textures/ui/public_kong_panel', kongWidth, kongWidth / 3.1, layout.pos(0, -11));
    this.createText(parent, 'PublicKongText', view.xiaoJiActiveAsWild ? '小鸡万能' : '小鸡关闭', layout.pos(0, -13.5), layout.s(1.45));
    view.publicKongTiles.slice(0, 4).forEach((tile, index) => {
      this.createTile(parent, `PublicKongTile${index}`, tile, layout.pos(-4.5 + index * 3, -9.8), layout.w(2.4), layout.w(3.25));
    });
  }

  private createPlayers(parent: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const selfPlayer: PlayerPublicView = {
      seatIndex: view.playerIndex,
      handCount: view.self.hand.length,
      melds: view.self.melds,
      discards: view.self.discards,
      status: 'SELF',
      nickname: '我',
    };

    this.createPlayerArea(parent, layout, view, selfPlayer, 'bottom');
    view.opponents.forEach((player) => {
      this.createPlayerArea(parent, layout, view, player, this.positionForOpponent(view.playerIndex, player.seatIndex));
    });
    this.createSelfHand(parent, layout, view);
  }

  private createPlayerArea(parent: Node, layout: RuntimeLayout, view: PlayerGameView, player: PlayerPublicView, position: LocalSeatPosition): void {
    const config = this.playerAreaConfig(layout, position);
    const root = ensureChild(parent, `Player_${position}`);
    root.setPosition(config.position);
    this.setNodeAngle(root, this.sideAngle(position));
    root.removeAllChildren();

    createImage(root, 'PlayerPanel', position === 'bottom' ? 'textures/ui/player_panel_self' : 'textures/ui/player_panel_other', config.width, config.height);
    const avatarSize = config.height * 0.76;
    const avatarPosition = this.avatarPosition(config.width, config.height, position);
    createRemoteImage(root, 'Avatar', player.avatarUrl || '', 'textures/ui/default_avatar', avatarSize, avatarSize, avatarPosition);
    this.createText(root, 'Nickname', player.nickname || `${player.seatIndex}号位`, new Vec3(config.width * 0.1, config.height * 0.14, 0), layout.s(position === 'bottom' ? 1.75 : 1.45));
    this.createText(root, 'Score', `分数 ${view.scores[player.seatIndex] ?? 0}`, new Vec3(config.width * 0.1, -config.height * 0.2, 0), layout.s(position === 'bottom' ? 1.55 : 1.3), new Color(255, 234, 166, 255));

    this.createDiscardArea(parent, layout, position, player.discards);
    this.createMeldArea(parent, layout, position, player.melds.map((meld) => meld.tiles).flat());
    if (position !== 'bottom') this.createOpponentHandCount(parent, layout, position, player.handCount);
  }

  private createDiscardArea(parent: Node, layout: RuntimeLayout, position: LocalSeatPosition, discards: TileId[]): void {
    const config = this.discardAreaConfig(layout, position);
    const area = ensureChild(parent, `Discard_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.removeAllChildren();
    createImage(area, 'DiscardAreaBg', 'textures/ui/discard_area', config.width, config.height);
    discards.slice(-18).forEach((tile, index) => {
      const col = index % 6;
      const row = Math.floor(index / 6);
      this.createTile(area, `DiscardTile${index}`, tile, new Vec3((col - 2.5) * config.tileW * 0.86, config.height * 0.2 - row * config.tileH * 0.66, 0), config.tileW, config.tileH);
    });
  }

  private createMeldArea(parent: Node, layout: RuntimeLayout, position: LocalSeatPosition, tiles: TileId[]): void {
    const config = this.meldAreaConfig(layout, position);
    const area = ensureChild(parent, `Meld_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.removeAllChildren();
    createImage(area, 'MeldAreaBg', 'textures/ui/meld_area', config.width, config.height);
    tiles.slice(0, 12).forEach((tile, index) => {
      this.createTile(area, `MeldTile${index}`, tile, new Vec3((index - 5.5) * config.tileW * 0.62, 0, 0), config.tileW, config.tileH);
    });
  }

  private createOpponentHandCount(parent: Node, layout: RuntimeLayout, position: LocalSeatPosition, count: number): void {
    const config = this.opponentHandConfig(layout, position);
    const area = ensureChild(parent, `HandCount_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.removeAllChildren();
    const displayCount = Math.min(count, 13);
    for (let index = 0; index < displayCount; index += 1) {
      const offset = (index - (displayCount - 1) / 2) * config.gap;
      this.createTile(area, `BackTile${index}`, null, new Vec3(offset, 0, 0), config.tileW, config.tileH, true);
    }
    this.createText(area, 'HandCountText', `${count}`, new Vec3(0, -config.tileH * 0.72, 0), layout.s(1.3));
  }

  private createSelfHand(parent: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const handArea = ensureChild(parent, 'SelfHandArea');
    handArea.setPosition(layout.pos(6, -32));
    handArea.removeAllChildren();
    const sorted = [...view.self.hand].sort((a, b) => a - b);
    const tileW = layout.w(3.15);
    const tileH = tileW * 1.36;
    const gap = tileW * 0.82;
    sorted.forEach((tile, index) => {
      this.createTile(handArea, `SelfTile${index}`, tile, new Vec3((index - (sorted.length - 1) / 2) * gap, 0, 0), tileW, tileH);
    });
  }

  private createControls(parent: Node, layout: RuntimeLayout): void {
    const controls = ensureChild(parent, 'ReplayControls');
    controls.removeAllChildren();
    const buttonWidth = layout.w(13);
    const buttonHeight = buttonWidth / BUTTON_RATIO;
    createImageButton(controls, 'BackButton', '', 'textures/ui/button_back_room', () => loadScene('Room'), layout.pos(-29, -40), buttonWidth, buttonHeight);
    createImageButton(controls, 'PreviousButton', '', 'textures/ui/button_back', () => this.previousStep(), layout.pos(28, -40), layout.s(6), layout.s(6));
    createImageButton(controls, 'NextButton', '', 'textures/ui/button_continue', () => this.nextStep(), layout.pos(39, -40), buttonWidth, buttonHeight);
  }

  private createTile(parent: Node, name: string, tile: TileId | null, position: Vec3, width: number, height: number, faceDown = false): Node {
    const node = ensureChild(parent, name);
    node.setPosition(position);
    node.removeAllChildren();
    ensureComponent(node, UITransform).setContentSize(width, height);
    const path = faceDown || tile === null ? TILE_BACK_TEXTURE : getTileTexturePath(tile);
    createImage(node, 'TileImage', path, width, height);
    return node;
  }

  private createText(parent: Node, name: string, text: string, position: Vec3, fontSize: number, color = Color.WHITE): Label {
    const label = createLabel(parent, name, text, position);
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.15;
    label.color = color;
    return label;
  }

  private positionForOpponent(selfSeat: number, seat: number): LocalSeatPosition {
    const offset = (seat - selfSeat + 4) % 4;
    if (offset === 1) return 'right';
    if (offset === 2) return 'top';
    return 'left';
  }

  private playerAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    if (position === 'bottom') return { width: layout.w(23), height: layout.w(23) / PLAYER_PANEL_RATIO_SELF, position: layout.pos(-39, -31) };
    if (position === 'right') return { width: layout.w(17), height: layout.w(17) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(43, 3) };
    if (position === 'top') return { width: layout.w(17), height: layout.w(17) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(0, 33) };
    return { width: layout.w(17), height: layout.w(17) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(-43, 3) };
  }

  private discardAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    const width = position === 'bottom' || position === 'top' ? layout.w(25) : layout.w(18);
    const height = layout.h(12);
    if (position === 'bottom') return { width, height, position: layout.pos(0, -17), tileW: layout.w(2.5), tileH: layout.w(3.35) };
    if (position === 'right') return { width, height, position: layout.pos(24, 4), tileW: layout.w(2.25), tileH: layout.w(3.0) };
    if (position === 'top') return { width, height, position: layout.pos(0, 17), tileW: layout.w(2.35), tileH: layout.w(3.15) };
    return { width, height, position: layout.pos(-24, 4), tileW: layout.w(2.25), tileH: layout.w(3.0) };
  }

  private meldAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    const width = position === 'bottom' ? layout.w(26) : layout.w(20);
    const height = layout.h(6.5);
    if (position === 'bottom') return { width, height, position: layout.pos(-21, -25), tileW: layout.w(2.6), tileH: layout.w(3.5) };
    if (position === 'right') return { width, height, position: layout.pos(34, -14), tileW: layout.w(2.1), tileH: layout.w(2.85) };
    if (position === 'top') return { width, height, position: layout.pos(-18, 25), tileW: layout.w(2.15), tileH: layout.w(2.9) };
    return { width, height, position: layout.pos(-34, -14), tileW: layout.w(2.1), tileH: layout.w(2.85) };
  }

  private opponentHandConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    if (position === 'right') return { position: layout.pos(37, 4), tileW: layout.w(1.8), tileH: layout.w(2.45), gap: layout.w(1.55) };
    if (position === 'left') return { position: layout.pos(-37, 4), tileW: layout.w(1.8), tileH: layout.w(2.45), gap: layout.w(1.55) };
    return { position: layout.pos(0, 25), tileW: layout.w(2.05), tileH: layout.w(2.75), gap: layout.w(1.68) };
  }

  private avatarPosition(width: number, height: number, position: LocalSeatPosition): Vec3 {
    if (position === 'bottom') return new Vec3(-width * 0.29, height * 0.02, 0);
    return new Vec3(-width * 0.25, height * 0.02, 0);
  }

  private sideAngle(position: LocalSeatPosition): number {
    if (position === 'left') return -90;
    if (position === 'right') return 90;
    return 0;
  }

  private setNodeAngle(node: Node, angle: number): void {
    (node as Node & { angle?: number }).angle = angle;
  }

  private createCoverImage(parent: Node, name: string, path: string, width: number, height: number, ratio: number): void {
    const screenRatio = width / height;
    const imageWidth = screenRatio > ratio ? width : height * ratio;
    const imageHeight = imageWidth / ratio;
    createImage(parent, name, path, imageWidth, imageHeight);
  }
}
