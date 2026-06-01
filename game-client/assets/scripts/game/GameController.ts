import { _decorator, Color, Label, Node, UITransform, Vec3 } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { GameEvents } from '../app/GameEvents';
import { BaseScene } from '../core/BaseScene';
import { eventBus } from '../core/EventBus';
import { mockGameView } from '../mock/MockData';
import { roomManager } from '../room/RoomManager';
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
import { getTileTexturePath, TILE_BACK_TEXTURE } from '../assets/TileAssetMap';
import { getTileLabel } from '../utils/TileUtils';
import { gameManager } from './GameManager';
import type { ActionType, GameAction, LocalSeatPosition, PlayerGameView, PlayerPublicView, ScoreResult, TileId } from './GameTypes';

const { ccclass } = _decorator;

const ACTION_ORDER: ActionType[] = [
  'WIN',
  'KONG_EXPOSED',
  'KONG_CONCEALED',
  'KONG_ADDED',
  'PONG',
  'CHOW_LEFT',
  'CHOW_MIDDLE',
  'CHOW_RIGHT',
  'SELECT_KONG_TILE',
  'PASS',
];

const ACTION_IMAGE_PATHS: Partial<Record<ActionType, string>> = {
  PASS: 'textures/ui/action_button_pass',
  WIN: 'textures/ui/action_button_win',
  PONG: 'textures/ui/action_button_pong',
  CHOW_LEFT: 'textures/ui/action_button_chow_left',
  CHOW_MIDDLE: 'textures/ui/action_button_chow_middle',
  CHOW_RIGHT: 'textures/ui/action_button_chow_right',
  KONG_EXPOSED: 'textures/ui/action_button_kong',
  KONG_CONCEALED: 'textures/ui/action_button_kong',
  KONG_ADDED: 'textures/ui/action_button_kong',
  SELECT_KONG_TILE: 'textures/ui/action_button_select_kong',
};

const RESPONSE_ACTION_TYPES = new Set<ActionType>([
  'WIN',
  'PONG',
  'KONG_EXPOSED',
  'CHOW_LEFT',
  'CHOW_MIDDLE',
  'CHOW_RIGHT',
]);

const GAME_BG_RATIO = 1672 / 941;
const PLAYER_PANEL_RATIO_SELF = 560 / 170;
const PLAYER_PANEL_RATIO_OTHER = 460 / 150;
const CENTER_STATUS_RATIO = 360 / 180;

@ccclass('GameController')
export class GameController extends BaseScene {
  private resultVisible = false;
  private selectedHandIndex: number | null = null;
  private lastTapTile: TileId | null = null;
  private lastTapAt = 0;
  private currentRound = 1;

  async start(): Promise<void> {
    console.log('[GameController] start');
    await this.enter();
    const room = roomManager.currentRoom;
    const roomId = room?.roomId || mockGameView.roomId;
    const gameId = room?.gameId || mockGameView.gameId;
    const subscribeRoomIds = [roomId, room?.internalRoomId].filter((id): id is string => Boolean(id));
    await this.enterGame(roomId, gameId, subscribeRoomIds);
  }

  onDestroy(): void {
    eventBus.off(GameEvents.GAME_VIEW_CHANGED, this.render, this);
    eventBus.off(GameEvents.DISCARD_REQUESTED, this.handleDiscard, this);
    eventBus.off(GameEvents.ACTION_SELECTED, this.handleActionSelected, this);
  }

  async enterGame(roomId: string, gameId: string, subscribeRoomIds: string[] = [roomId]): Promise<void> {
    gameManager.bindNetwork();
    this.bindEvents();
    await gameManager.enterGame(roomId, gameId, subscribeRoomIds);
  }

  private bindEvents(): void {
    eventBus.off(GameEvents.GAME_VIEW_CHANGED, this.render, this);
    eventBus.off(GameEvents.DISCARD_REQUESTED, this.handleDiscard, this);
    eventBus.off(GameEvents.ACTION_SELECTED, this.handleActionSelected, this);
    eventBus.on(GameEvents.GAME_VIEW_CHANGED, this.render, this);
    eventBus.on(GameEvents.DISCARD_REQUESTED, this.handleDiscard, this);
    eventBus.on(GameEvents.ACTION_SELECTED, this.handleActionSelected, this);
  }

  private render = (): void => {
    const snapshot = gameManager.snapshot();
    const view = snapshot.view;
    if (!view) return;

    let canvas = ensureCanvas(this.node);
    canvas.removeAllChildren();
    canvas = ensureCanvas(this.node);

    const layout = createLayout();
    this.createBackground(canvas, layout);
    this.createTopHud(canvas, layout, view);
    this.createCenterStatus(canvas, layout, view);
    this.createPlayers(canvas, layout, view);
    this.createSelfHand(canvas, layout, view, snapshot.legalDiscardTiles);
    this.createActionPanel(canvas, layout, view.legalActions, snapshot.submitting);
    this.createKongTileChoice(canvas, layout, view.legalActions, snapshot.submitting);
    this.createResponseHint(canvas, layout, view);

    if (view.status === 'FINISHED' || view.status === 'DRAW') {
      this.resultVisible = true;
      this.createResultDialog(canvas, layout, view);
    } else {
      this.resultVisible = false;
    }
  };

  private createBackground(canvas: Node, layout: RuntimeLayout): void {
    createPanel(canvas, 'BackgroundFallback', layout.width, layout.height, new Color(4, 45, 33, 255));
    this.createCoverImage(canvas, 'Background', 'textures/ui/game_bg', layout.width, layout.height, GAME_BG_RATIO);
  }

  private createTopHud(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const hudWidth = layout.w(38);
    const hudHeight = layout.h(5.6);
    createPanel(canvas, 'TopHudFallback', hudWidth, hudHeight, new Color(8, 58, 43, 215), layout.pos(0, 37));
    createImage(canvas, 'TopHud', 'textures/ui/hud_panel_top', hudWidth, hudHeight, layout.pos(0, 37));
    this.createText(
      canvas,
      'TopHudText',
      `房间 ${this.displayRoomId(view)}    剩余 ${view.wallTilesRemaining} 张    第 ${view.stepIndex} 手`,
      layout.pos(0, 37),
      layout.s(1.8),
      new Color(235, 248, 217, 255),
    );
  }

  private createCenterStatus(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const centerWidth = layout.w(15);
    createImage(canvas, 'CenterStatusPanel', 'textures/ui/center_status_panel', centerWidth, centerWidth / CENTER_STATUS_RATIO, layout.pos(0, 2));
    const lastDiscard = view.lastDiscard ? `${getTileLabel(view.lastDiscard.tile)} / ${view.lastDiscard.fromPlayer}号位` : '无';
    this.createText(canvas, 'CurrentPlayerText', `当前 ${view.currentPlayer}号`, layout.pos(0, 5.1), layout.s(1.55), new Color(255, 238, 168, 255));
    this.createText(canvas, 'DealerText', `庄 ${view.dealer}号`, layout.pos(0, 2), layout.s(1.4));
    this.createText(canvas, 'LastDiscardText', `上张 ${lastDiscard}`, layout.pos(0, -1.1), layout.s(1.25));

    const kongWidth = layout.w(16);
    createImage(canvas, 'PublicKongPanel', 'textures/ui/public_kong_panel', kongWidth, kongWidth / 3.1, layout.pos(0, -9.5));
    this.createText(canvas, 'XiaoJiText', view.xiaoJiActiveAsWild ? '小鸡万能' : '小鸡关闭', layout.pos(0, -12), layout.s(1.3));
    view.publicKongTiles.slice(0, 4).forEach((tile, index) => {
      this.createTile(canvas, `PublicKongTile${index}`, tile, layout.pos(-4 + index * 2.7, -8.4), layout.w(2.05), layout.w(2.8));
    });
  }

  private createPlayers(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const selfPlayer: PlayerPublicView = {
      seatIndex: view.playerIndex,
      handCount: view.self.hand.length,
      melds: view.self.melds,
      discards: view.self.discards,
      status: 'SELF',
      nickname: '我',
    };

    this.createPlayerArea(canvas, layout, view, selfPlayer, 'bottom');
    view.opponents.forEach((player) => {
      this.createPlayerArea(canvas, layout, view, player, this.positionForOpponent(view.playerIndex, player.seatIndex));
    });
  }

  private createPlayerArea(canvas: Node, layout: RuntimeLayout, view: PlayerGameView, player: PlayerPublicView, position: LocalSeatPosition): void {
    const config = this.playerAreaConfig(layout, position);
    const root = ensureChild(canvas, `Player_${position}`);
    root.setPosition(config.position);
    this.setNodeAngle(root, this.sideAngle(position));
    root.removeAllChildren();

    if (view.currentPlayer === player.seatIndex) {
      createImage(root, 'TurnGlow', 'textures/ui/turn_glow', config.width * 1.12, config.height * 1.18);
    }

    createImage(root, 'PlayerPanel', position === 'bottom' ? 'textures/ui/player_panel_self' : 'textures/ui/player_panel_other', config.width, config.height);
    const avatarSize = config.height * 0.76;
    const avatarPosition = this.avatarPosition(config.width, config.height, position);
    createRemoteImage(root, 'Avatar', player.avatarUrl || '', 'textures/ui/default_avatar', avatarSize, avatarSize, avatarPosition);
    this.createText(root, 'Nickname', player.nickname || `${player.seatIndex}号位`, new Vec3(config.width * 0.1, config.height * 0.14, 0), layout.s(position === 'bottom' ? 1.85 : 1.55));
    this.createText(root, 'Score', `分数 ${view.scores[player.seatIndex] ?? 0}`, new Vec3(config.width * 0.1, -config.height * 0.2, 0), layout.s(position === 'bottom' ? 1.65 : 1.4), new Color(255, 234, 166, 255));

    if (view.dealer === player.seatIndex) {
      createImage(root, 'DealerBadge', 'textures/ui/dealer_badge', avatarSize * 0.42, avatarSize * 0.42, new Vec3(avatarPosition.x - avatarSize * 0.38, avatarPosition.y + avatarSize * 0.35, 0));
    }

    this.createDiscardArea(canvas, layout, position, player.discards, view.lastDiscard?.fromPlayer === player.seatIndex ? view.lastDiscard.tile : null);
    this.createMeldArea(canvas, layout, position, player.melds.map((meld) => meld.tiles).flat());
    if (position !== 'bottom') this.createOpponentHandCount(canvas, layout, position, player.handCount);
  }

  private createDiscardArea(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, discards: TileId[], highlightedTile: TileId | null): void {
    const config = this.discardAreaConfig(layout, position);
    const area = ensureChild(canvas, `Discard_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.removeAllChildren();
    createImage(area, 'DiscardAreaBg', 'textures/ui/discard_area', config.width, config.height);
    const visibleDiscards = discards.slice(-18);
    const lastHighlightIndex = highlightedTile === null ? -1 : findLastIndex(visibleDiscards, (tile) => tile === highlightedTile);
    visibleDiscards.forEach((tile, index) => {
      const col = index % 6;
      const row = Math.floor(index / 6);
      const tilePosition = new Vec3((col - 2.5) * config.tileW * 0.86, config.height * 0.2 - row * config.tileH * 0.66, 0);
      if (index === lastHighlightIndex) {
        createPanel(area, `DiscardTileGlow${index}`, config.tileW * 1.18, config.tileH * 1.14, new Color(255, 218, 82, 175), tilePosition);
      }
      this.createTile(area, `DiscardTile${index}`, tile, tilePosition, config.tileW, config.tileH);
    });
  }

  private createMeldArea(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, tiles: TileId[]): void {
    const config = this.meldAreaConfig(layout, position);
    const area = ensureChild(canvas, `Meld_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.removeAllChildren();
    createImage(area, 'MeldAreaBg', 'textures/ui/meld_area', config.width, config.height);
    tiles.slice(0, 12).forEach((tile, index) => {
      this.createTile(area, `MeldTile${index}`, tile, new Vec3((index - 5.5) * config.tileW * 0.62, 0, 0), config.tileW, config.tileH);
    });
  }

  private createOpponentHandCount(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, count: number): void {
    const config = this.opponentHandConfig(layout, position);
    const area = ensureChild(canvas, `HandCount_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.removeAllChildren();
    const displayCount = Math.min(count, 13);
    for (let index = 0; index < displayCount; index += 1) {
      const offset = (index - (displayCount - 1) / 2) * config.gap;
      const positionVec = new Vec3(offset, 0, 0);
      this.createTile(area, `BackTile${index}`, null, positionVec, config.tileW, config.tileH, true);
    }
    this.createText(area, 'HandCountText', `${count}`, new Vec3(0, -config.tileH * 0.72, 0), layout.s(1.4), new Color(255, 255, 255, 255));
  }

  private createSelfHand(canvas: Node, layout: RuntimeLayout, view: PlayerGameView, legalDiscardTiles: TileId[]): void {
    const handArea = ensureChild(canvas, 'SelfHandArea');
    handArea.setPosition(layout.pos(4, -33));
    this.setNodeAngle(handArea, 0);
    handArea.removeAllChildren();

    const legal = new Set(legalDiscardTiles);
    const canDiscard = legalDiscardTiles.length > 0;
    const sorted = [...view.self.hand].sort((a, b) => a - b);
    const tileW = layout.w(3.0);
    const tileH = tileW * 1.36;
    const gap = tileW * 0.8;
    sorted.forEach((tile, index) => {
      const isSelected = this.selectedHandIndex === index;
      const node = this.createTile(
        handArea,
        `SelfTile${index}`,
        tile,
        new Vec3((index - (sorted.length - 1) / 2) * gap, isSelected ? tileH * 0.22 : 0, 0),
        tileW,
        tileH,
      );
      node.active = true;
      if (!canDiscard) return;
      node.on('touch-end', () => {
        if (!legal.has(tile)) return;
        const now = Date.now();
        const isQuickSecondTap = this.lastTapTile === tile && now - this.lastTapAt <= 650;
        if (this.selectedHandIndex === index || isQuickSecondTap) {
          eventBus.emit(GameEvents.DISCARD_REQUESTED, tile);
          return;
        }

        this.selectedHandIndex = index;
        this.lastTapTile = tile;
        this.lastTapAt = now;
        this.createSelfHand(canvas, layout, view, legalDiscardTiles);
      });
    });
  }

  private createActionPanel(canvas: Node, layout: RuntimeLayout, actions: GameAction[], submitting: boolean): void {
    const panel = ensureChild(canvas, 'ActionPanel');
    panel.setPosition(layout.pos(31, -25));
    panel.removeAllChildren();
    const visibleActions = actions
      .filter((action) => action.type !== 'DISCARD' && action.type !== 'SELECT_KONG_TILE')
      .sort((a, b) => ACTION_ORDER.indexOf(a.type) - ACTION_ORDER.indexOf(b.type));
    panel.active = visibleActions.length > 0;

    visibleActions.forEach((action, index) => {
      const width = action.type === 'WIN' ? layout.w(6.3) : action.type === 'SELECT_KONG_TILE' ? layout.w(7.5) : layout.w(5.6);
      const height = width / (action.type === 'WIN' ? 1.72 : action.type === 'SELECT_KONG_TILE' ? 2.24 : 1.68);
      createImageButton(
        panel,
        `Action_${action.type}_${index}`,
        '',
        ACTION_IMAGE_PATHS[action.type] || 'textures/ui/action_button_pass',
        () => {
          if (!submitting) eventBus.emit(GameEvents.ACTION_SELECTED, action);
        },
        new Vec3((index - (visibleActions.length - 1) / 2) * width * 1.02, 0, 0),
        width,
        height,
      );
    });
  }

  private createKongTileChoice(canvas: Node, layout: RuntimeLayout, actions: GameAction[], submitting: boolean): void {
    const choices = actions.filter((action) => action.type === 'SELECT_KONG_TILE' && action.tile !== undefined);
    if (choices.length === 0) return;

    const layer = ensureChild(canvas, 'KongTileChoice');
    layer.setPosition(layout.pos(0, -18));
    layer.removeAllChildren();

    const panelWidth = layout.w(26);
    const panelHeight = layout.h(16);
    createPanel(layer, 'ChoiceBg', panelWidth, panelHeight, new Color(10, 58, 43, 238));
    createPanel(layer, 'ChoiceGlow', panelWidth * 0.94, panelHeight * 0.86, new Color(255, 218, 82, 55));
    this.createText(layer, 'ChoiceTitle', '选择杠后补牌', new Vec3(0, panelHeight * 0.32, 0), layout.s(1.85), new Color(255, 240, 168, 255));

    choices.slice(0, 2).forEach((action, index) => {
      const tile = action.tile as TileId;
      const x = (index - (Math.min(choices.length, 2) - 1) / 2) * layout.w(7);
      const tileNode = this.createTile(layer, `KongChoiceTile${index}`, tile, new Vec3(x, -panelHeight * 0.04, 0), layout.w(3.9), layout.w(5.3));
      createPanel(layer, `KongChoiceHit${index}`, layout.w(5.4), layout.w(6.7), new Color(255, 255, 255, 1), new Vec3(x, -panelHeight * 0.04, 0)).on('touch-end', () => {
        if (!submitting) eventBus.emit(GameEvents.ACTION_SELECTED, action);
      });
      this.createText(layer, `KongChoiceName${index}`, getTileLabel(tile), new Vec3(x, -panelHeight * 0.42, 0), layout.s(1.35), new Color(235, 248, 217, 255));
      tileNode.active = true;
    });
  }

  private createResponseHint(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const responseTile = this.responseTile(view);
    if (responseTile === null) return;

    const hint = ensureChild(canvas, 'ResponseHint');
    hint.setPosition(layout.pos(31, -16.5));
    hint.removeAllChildren();

    const panelWidth = layout.w(14);
    const panelHeight = layout.h(10.5);
    createPanel(hint, 'ResponseHintBg', panelWidth, panelHeight, new Color(14, 71, 50, 230));
    createPanel(hint, 'ResponseHintGlow', panelWidth * 0.94, panelHeight * 0.86, new Color(255, 218, 82, 70));
    this.createText(hint, 'ResponseHintTitle', '可响应', new Vec3(0, panelHeight * 0.27, 0), layout.s(1.65), new Color(255, 240, 168, 255));
    this.createTile(hint, 'ResponseHintTile', responseTile, new Vec3(0, -panelHeight * 0.11, 0), layout.w(3.4), layout.w(4.65));
    this.createText(hint, 'ResponseHintName', getTileLabel(responseTile), new Vec3(0, -panelHeight * 0.38, 0), layout.s(1.35), new Color(235, 248, 217, 255));
  }

  private createResultDialog(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const layer = ensureChild(canvas, 'ResultDialogLayer');
    layer.removeAllChildren();
    createPanel(layer, 'Mask', layout.width, layout.height, new Color(0, 0, 0, 165));
    const isFinal = this.isFinalResult(view);
    const dialogWidth = isFinal ? layout.w(62) : layout.w(56);
    const dialogHeight = isFinal ? layout.h(78) : layout.h(72);
    createPanel(layer, 'DialogFallback', dialogWidth, dialogHeight, new Color(9, 57, 43, 245));
    createImage(layer, 'DialogBg', isFinal ? 'textures/ui/final_result_dialog_bg' : 'textures/ui/result_dialog_bg', dialogWidth, dialogHeight);

    const result = view.result;
    const selfWon = Boolean(result?.winnerIndexes.includes(view.playerIndex));
    this.createText(
      layer,
      'ResultTitle',
      isFinal ? '总分结算' : result?.title || (view.status === 'DRAW' ? '流局' : selfWon ? '胡牌结算' : '本局结算'),
      layout.pos(0, 27),
      layout.s(3.6),
      new Color(255, 234, 164, 255),
    );
    this.createText(layer, 'RoundText', `第 ${view.currentRound ?? this.currentRound} / ${this.displayMaxRounds(view)} 局`, layout.pos(0, 22.5), layout.s(2.0), new Color(218, 244, 205, 255));

    this.createResultScores(layer, layout, view, result);
    this.createFanList(layer, layout, result);

    if (isFinal) {
      createImageButton(layer, 'EndGameButton', '', 'textures/ui/button_back_room', () => this.backToRoom(), layout.pos(-11, -29), layout.w(18), layout.w(18) / 3.02);
      createImageButton(layer, 'ReplayButton', '', 'textures/ui/button_replay', () => loadScene('Replay'), layout.pos(11, -29), layout.w(18), layout.w(18) / 3.02);
      return;
    }

    createImageButton(layer, 'ContinueButton', '', 'textures/ui/button_continue', () => this.continueGame(), layout.pos(-11, -29), layout.w(18), layout.w(18) / 3.02);
    createImageButton(layer, 'ReplayButton', '', 'textures/ui/button_replay', () => loadScene('Replay'), layout.pos(11, -29), layout.w(18), layout.w(18) / 3.02);
  }

  private createResultScores(layer: Node, layout: RuntimeLayout, view: PlayerGameView, result?: ScoreResult): void {
    const names = this.playerNames(view);
    const deltas = result?.scoreDelta || [0, 0, 0, 0];
    for (let index = 0; index < 4; index += 1) {
      const y = 16 - index * 6.5;
      const delta = deltas[index] || 0;
      const rowPath = delta >= 0 ? 'textures/ui/score_row_win' : 'textures/ui/score_row_lose';
      createImage(layer, `ScoreRow${index}`, rowPath, layout.w(46), layout.h(6.3), layout.pos(0, y));
      this.createText(layer, `ScoreName${index}`, `${index}号 ${names[index] || '玩家'}`, layout.pos(-14, y), layout.s(2.0));
      this.createText(layer, `ScoreDelta${index}`, `${delta >= 0 ? '+' : ''}${delta}`, layout.pos(13, y), layout.s(2.55), delta >= 0 ? new Color(255, 229, 137, 255) : new Color(170, 230, 255, 255));
    }
  }

  private createFanList(layer: Node, layout: RuntimeLayout, result?: ScoreResult): void {
    const fanItems = result?.fanItems || [];
    this.createText(layer, 'FanTitle', '番型明细', layout.pos(0, -10), layout.s(2.35), new Color(255, 238, 170, 255));
    fanItems.slice(0, 4).forEach((item, index) => {
      const y = -15 - index * 4.8;
      createImage(layer, `FanItemBg${index}`, 'textures/ui/fan_item_bg', layout.w(42), layout.h(4.8), layout.pos(0, y));
      this.createText(layer, `FanItemText${index}`, `${item.name}  ${item.points}分`, layout.pos(0, y), layout.s(1.75));
    });
    if (fanItems.length === 0) this.createText(layer, 'FanEmptyText', '暂无番型明细', layout.pos(0, -17), layout.s(2.1));
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

  private async handleDiscard(tile: TileId): Promise<void> {
    if (this.resultVisible) return;
    this.selectedHandIndex = null;
    this.lastTapTile = null;
    try {
      await gameManager.submitDiscard(tile);
    } catch (err) {
      console.error('[GameController] discard failed', tile, err);
      this.showNotice('出牌失败');
      this.createSelfHand(ensureCanvas(this.node), createLayout(), gameManager.currentView || mockGameView, gameManager.getLegalDiscardTiles());
    }
  }

  private handleActionSelected = (action: GameAction): void => {
    if (!this.resultVisible) void gameManager.submitAction(action);
  };

  private backToRoom(): void {
    if (roomManager.currentRoom) {
      roomManager.setRoom({
        ...roomManager.currentRoom,
        status: 'WAITING',
        gameId: undefined,
      });
    }
    loadScene('Room');
  }

  private async continueGame(): Promise<void> {
    this.currentRound = Math.min((gameManager.currentView?.currentRound ?? this.currentRound) + 1, this.maxRoundCount());
    this.resultVisible = false;
    this.selectedHandIndex = null;
    this.lastTapTile = null;
    try {
      const gameId = await roomManager.startGame();
      const room = roomManager.currentRoom;
      const roomId = room?.roomId || gameManager.currentView?.roomId || mockGameView.roomId;
      const subscribeRoomIds = [roomId, room?.internalRoomId].filter((id): id is string => Boolean(id));
      await this.enterGame(roomId, gameId, subscribeRoomIds);
    } catch (err) {
      console.error('[GameController] continue game failed', err);
      this.showNotice('继续游戏失败');
    }
  }

  private isFinalRound(): boolean {
    return this.currentRound >= this.maxRoundCount();
  }

  private isFinalResult(view: PlayerGameView): boolean {
    const currentRound = view.currentRound ?? this.currentRound;
    const backendMaxRounds = this.displayMaxRounds(view);
    return view.isFinalRound === true && currentRound >= backendMaxRounds;
  }

  private displayMaxRounds(view: PlayerGameView): number {
    const configuredRounds = this.maxRoundCount();
    return view.maxRounds && view.maxRounds > 1 ? view.maxRounds : configuredRounds;
  }

  private responseTile(view: PlayerGameView): TileId | null {
    if (!view.lastDiscard) return null;
    const hasResponseAction = view.legalActions.some((action) => RESPONSE_ACTION_TYPES.has(action.type));
    return hasResponseAction ? view.lastDiscard.tile : null;
  }

  private maxRoundCount(): number {
    return roomManager.currentRoom?.rules.roundCount || 16;
  }

  private createText(parent: Node, name: string, text: string, position: Vec3, fontSize: number, color = Color.WHITE): Label {
    const label = createLabel(parent, name, text, position);
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.15;
    label.color = color;
    return label;
  }

  private displayRoomId(view: PlayerGameView): string {
    const roomId = roomManager.currentRoom?.roomId || view.roomId;
    return /^\d{6}$/.test(roomId) ? roomId : view.gameId.slice(-6).toUpperCase();
  }

  private showNotice(title: string): void {
    const wxApi = (globalThis as { wx?: { showToast?: (options: { title: string; icon?: 'none'; duration?: number }) => void } }).wx;
    if (wxApi?.showToast) {
      wxApi.showToast({ title, icon: 'none', duration: 1600 });
      return;
    }
    console.warn(`[GameController] ${title}`);
  }

  private playerNames(view: PlayerGameView): string[] {
    const names = ['我', '', '', ''];
    view.opponents.forEach((player) => {
      names[player.seatIndex] = player.nickname || `${player.seatIndex}号位`;
    });
    names[view.playerIndex] = '我';
    return names;
  }

  private positionForOpponent(selfSeat: number, seat: number): LocalSeatPosition {
    const offset = (seat - selfSeat + 4) % 4;
    if (offset === 1) return 'right';
    if (offset === 2) return 'top';
    return 'left';
  }

  private playerAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    if (position === 'bottom') return { width: layout.w(21), height: layout.w(21) / PLAYER_PANEL_RATIO_SELF, position: layout.pos(-34, -29) };
    if (position === 'right') return { width: layout.w(14), height: layout.w(14) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(35, 2) };
    if (position === 'top') return { width: layout.w(15), height: layout.w(15) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(0, 29) };
    return { width: layout.w(14), height: layout.w(14) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(-35, 2) };
  }

  private discardAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    const width = position === 'bottom' || position === 'top' ? layout.w(23) : layout.w(13);
    const height = layout.h(10.5);
    if (position === 'bottom') return { width, height, position: layout.pos(0, -15.5), tileW: layout.w(2.2), tileH: layout.w(3.0) };
    if (position === 'right') return { width, height, position: layout.pos(22, 3), tileW: layout.w(1.8), tileH: layout.w(2.45) };
    if (position === 'top') return { width, height, position: layout.pos(0, 15.5), tileW: layout.w(2.05), tileH: layout.w(2.8) };
    return { width, height, position: layout.pos(-22, 3), tileW: layout.w(1.8), tileH: layout.w(2.45) };
  }

  private meldAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    const width = position === 'bottom' ? layout.w(24) : layout.w(15);
    const height = layout.h(5.8);
    if (position === 'bottom') return { width, height, position: layout.pos(-17, -23.5), tileW: layout.w(2.25), tileH: layout.w(3.05) };
    if (position === 'right') return { width, height, position: layout.pos(30, -12), tileW: layout.w(1.8), tileH: layout.w(2.45) };
    if (position === 'top') return { width, height, position: layout.pos(-15, 23), tileW: layout.w(1.85), tileH: layout.w(2.5) };
    return { width, height, position: layout.pos(-30, -12), tileW: layout.w(1.8), tileH: layout.w(2.45) };
  }

  private opponentHandConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    if (position === 'right') return { position: layout.pos(32, 3), tileW: layout.w(1.35), tileH: layout.w(1.85), gap: layout.w(1.2) };
    if (position === 'left') return { position: layout.pos(-32, 3), tileW: layout.w(1.35), tileH: layout.w(1.85), gap: layout.w(1.2) };
    return { position: layout.pos(0, 23), tileW: layout.w(1.65), tileH: layout.w(2.25), gap: layout.w(1.32) };
  }

  private avatarPosition(width: number, height: number, position: LocalSeatPosition): Vec3 {
    if (position === 'bottom') return new Vec3(-width * 0.29, height * 0.02, 0);
    return new Vec3(-width * 0.4, height * 0.02, 0);
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

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}
