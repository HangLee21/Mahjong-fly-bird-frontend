import { _decorator, Color, Label, Node, Sprite, tween, UITransform, Vec3 } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { ActionLabels } from '../app/Constants';
import { GameEvents } from '../app/GameEvents';
import { BaseScene } from '../core/BaseScene';
import { eventBus } from '../core/EventBus';
import { mockGameView } from '../mock/MockData';
import { roomManager } from '../room/RoomManager';
import { gameAudio } from '../audio/GameAudio';
import { bgmManager } from '../audio/BgmManager';
import {
  applyLandscapeResolution,
  bindTouchEnd,
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
import { getTileLabel, sortTiles } from '../utils/TileUtils';
import { getActionPreviewTiles, getKongPreviewTiles } from './GameActionBuilder';
import { gameManager, getDisplayedScores } from './GameManager';
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

const MELD_ACTION_TYPES = new Set<ActionType>([
  'PONG',
  'CHOW_LEFT',
  'CHOW_MIDDLE',
  'CHOW_RIGHT',
  'KONG_EXPOSED',
  'KONG_CONCEALED',
  'KONG_ADDED',
]);

const GAME_BG_RATIO = 1672 / 941;
const PLAYER_PANEL_RATIO_SELF = 330 / 110;
const PLAYER_PANEL_RATIO_OTHER = 260 / 96;
const CENTER_STATUS_RATIO = 360 / 180;
const DISCARD_AREA_RATIO = 360 / 140;
const MELD_AREA_RATIO = 380 / 80;

@ccclass('GameController')
export class GameController extends BaseScene {
  private resultVisible = false;
  private selectedHandIndex: number | null = null;
  private lastTapTile: TileId | null = null;
  private currentRound = 1;
  private readonly handTouchHandlers = new Map<Node, () => void>();
  private readonly seatByPosition = new Map<LocalSeatPosition, number>();
  private readonly discardCounts = new Map<LocalSeatPosition, number>();
  private readonly meldTileCounts = new Map<LocalSeatPosition, number>();
  private readonly openingAnimationTimers: Array<ReturnType<typeof setTimeout>> = [];
  private turnPulseVisible = true;
  private lastCurrentPlayer: number | null = null;
  private lastAudioRoundKey = '';
  private lastAudioStatus = '';
  private openingAnimationToken = 0;
  private meldChoiceSignature = '';
  private kongChoiceSignature = '';
  private winPromptSignature = '';

  async start(): Promise<void> {
    console.log('[GameController] start');
    applyLandscapeResolution();
    gameAudio.attach(this.node);
    void bgmManager.play('tableAmbient');
    await this.enter();
    const room = roomManager.currentRoom;
    const roomId = room?.roomId || mockGameView.roomId;
    const gameId = room?.gameId || mockGameView.gameId;
    const subscribeRoomIds = [roomId, room?.internalRoomId].filter((id): id is string => Boolean(id));
    await this.enterGame(roomId, gameId, subscribeRoomIds);
    this.unschedule?.(this.updateTurnPulse);
    this.schedule?.(this.updateTurnPulse, 0.45);
  }

  onDestroy(): void {
    eventBus.off(GameEvents.GAME_VIEW_CHANGED, this.render, this);
    eventBus.off(GameEvents.DISCARD_REQUESTED, this.handleDiscard, this);
    eventBus.off(GameEvents.ACTION_SELECTED, this.handleActionSelected, this);
    this.unschedule?.(this.updateTurnPulse);
    this.handTouchHandlers.forEach((handler, node) => node.off('touch-end', handler));
    this.handTouchHandlers.clear();
    this.clearOpeningAnimationTimers();
    gameAudio.detach();
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
    const displayedCurrentPlayer = snapshot.presentationAiSeat ?? view.currentPlayer;
    if (displayedCurrentPlayer !== this.lastCurrentPlayer) {
      this.lastCurrentPlayer = displayedCurrentPlayer;
      this.turnPulseVisible = true;
    }
    const audioRoundKey = `${view.gameId}:${view.currentRound ?? this.currentRound}`;
    let playRoundOpening = false;
    if (view.status === 'PLAYING' && audioRoundKey !== this.lastAudioRoundKey) {
      const continuingFromPreviousRound = this.lastAudioRoundKey.length > 0;
      this.lastAudioRoundKey = audioRoundKey;
      playRoundOpening = continuingFromPreviousRound || view.stepIndex <= 4;
    }
    if (view.status === 'FINISHED' && this.lastAudioStatus !== 'FINISHED') {
      const selfWon = Boolean(view.result?.winnerIndexes.includes(view.playerIndex));
      gameAudio.play(selfWon ? 'win' : 'winOthers', selfWon ? 0.7 : 0.55);
    }
    this.lastAudioStatus = view.status;

    const canvas = ensureCanvas(this.node);

    const layout = createLayout();
    this.createBackground(canvas, layout);
    this.createTopHud(canvas, layout, view);
    this.createCenterStatus(canvas, layout, view, displayedCurrentPlayer);
    this.createPlayers(canvas, layout, view, displayedCurrentPlayer, snapshot.presentationAiSeat);
    this.createSelfHand(canvas, layout, view, snapshot.submitting ? [] : snapshot.legalDiscardTiles);
    this.createActionPanel(canvas, layout, view, snapshot.submitting);
    this.createMeldActionChoices(canvas, layout, view.legalActions, view, snapshot.submitting);
    this.createKongTileChoice(canvas, layout, view.legalActions, snapshot.submitting);
    this.createResponseHint(canvas, layout, view);
    if (playRoundOpening) this.playRoundOpeningAnimation(canvas, layout, view);

    if (view.status === 'FINISHED' || view.status === 'DRAW') {
      this.resultVisible = true;
      this.createResultDialog(canvas, layout, view);
    } else {
      this.resultVisible = false;
      const resultLayer = canvas.children.find((child) => child.name === 'ResultDialogLayer');
      if (resultLayer) resultLayer.active = false;
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
      `房间 ${this.displayRoomId(view)}  ·  余 ${view.wallTilesRemaining} 张  ·  第 ${view.stepIndex} 手`,
      layout.pos(0, 37),
      layout.s(1.65),
      new Color(235, 248, 217, 255),
    );
  }

  private createCenterStatus(
    canvas: Node,
    layout: RuntimeLayout,
    view: PlayerGameView,
    displayedCurrentPlayer: number,
  ): void {
    const centerWidth = layout.w(15);
    createImage(canvas, 'CenterStatusPanel', 'textures/ui/center_status_panel', centerWidth, centerWidth / CENTER_STATUS_RATIO, layout.pos(0, 2));
    this.createText(canvas, 'CurrentPlayerText', `第 ${displayedCurrentPlayer + 1} 位`, layout.pos(0, 4.1), layout.s(2.05), new Color(255, 238, 168, 255));
    this.createText(canvas, 'DealerText', `庄 ${view.dealer + 1}`, layout.pos(0, 1.2), layout.s(1.55), new Color(224, 243, 206, 255));
    const lastDiscardText = canvas.children.find((child) => child.name === 'LastDiscardText');
    if (lastDiscardText) lastDiscardText.active = false;

    const kongWidth = layout.w(16);
    createImage(canvas, 'PublicKongPanel', 'textures/ui/public_kong_panel', kongWidth, kongWidth / 3.1, layout.pos(0, -9.5));
    this.createText(canvas, 'PublicKongTitle', '杠牌', layout.pos(0, -12.15), layout.s(1.55), new Color(255, 232, 151, 255));
    const xiaoJiText = canvas.children.find((child) => child.name === 'XiaoJiText');
    if (xiaoJiText) xiaoJiText.active = false;
    for (let index = 0; index < 4; index += 1) {
      const tile = view.publicKongTiles[index];
      const node = ensureChild(canvas, `PublicKongTile${index}`);
      node.active = tile !== undefined;
      if (tile !== undefined) {
        this.createTile(canvas, `PublicKongTile${index}`, tile, layout.pos(-2.8 + index * 2.55, -8.8), layout.w(2.05), layout.w(2.8));
      }
    }
  }

  private createPlayers(
    canvas: Node,
    layout: RuntimeLayout,
    view: PlayerGameView,
    displayedCurrentPlayer: number,
    thinkingSeat: number | null,
  ): void {
    const selfPlayer: PlayerPublicView = {
      seatIndex: view.playerIndex,
      handCount: view.self.hand.length,
      melds: view.self.melds,
      discards: view.self.discards,
      status: 'SELF',
      nickname: '我',
    };

    this.createPlayerArea(canvas, layout, view, selfPlayer, 'bottom', displayedCurrentPlayer, thinkingSeat);
    view.opponents.forEach((player) => {
      this.createPlayerArea(
        canvas,
        layout,
        view,
        player,
        this.positionForOpponent(view.playerIndex, player.seatIndex),
        displayedCurrentPlayer,
        thinkingSeat,
      );
    });
  }

  private createPlayerArea(
    canvas: Node,
    layout: RuntimeLayout,
    view: PlayerGameView,
    player: PlayerPublicView,
    position: LocalSeatPosition,
    displayedCurrentPlayer: number,
    thinkingSeat: number | null,
  ): void {
    const config = this.playerAreaConfig(layout, position);
    const root = ensureChild(canvas, `Player_${position}`);
    root.setPosition(config.position);
    this.setNodeAngle(root, this.sideAngle(position));
    this.seatByPosition.set(position, player.seatIndex);

    const turnGlow = createImage(root, 'TurnGlow', 'textures/ui/turn_glow', config.width * 1.12, config.height * 1.18);
    turnGlow.active = displayedCurrentPlayer === player.seatIndex;

    createImage(root, 'PlayerPanel', position === 'bottom' ? 'textures/ui/player_panel_self' : 'textures/ui/player_panel_other', config.width, config.height);
    const avatarSize = config.height * 0.76;
    const avatarPosition = this.avatarPosition(config.width, config.height, position);
    createRemoteImage(root, 'Avatar', player.avatarUrl || '', 'textures/ui/default_avatar', avatarSize, avatarSize, avatarPosition);
    this.createText(root, 'Nickname', player.nickname || `${player.seatIndex}号位`, new Vec3(config.width * 0.1, config.height * 0.14, 0), layout.s(position === 'bottom' ? 1.85 : 1.55));
    const displayedScores = getDisplayedScores(view);
    this.createText(root, 'Score', `总分 ${displayedScores[player.seatIndex] ?? 0}`, new Vec3(config.width * 0.1, -config.height * 0.2, 0), layout.s(position === 'bottom' ? 1.65 : 1.4), new Color(255, 234, 166, 255));

    const dealerBadge = createImage(root, 'DealerBadge', 'textures/ui/dealer_badge', avatarSize * 0.42, avatarSize * 0.42, new Vec3(avatarPosition.x - avatarSize * 0.38, avatarPosition.y + avatarSize * 0.35, 0));
    dealerBadge.active = view.dealer === player.seatIndex;
    this.createText(
      root,
      'TurnIndicatorText',
      thinkingSeat === player.seatIndex ? '思考中' : '出牌中',
      new Vec3(config.width * 0.23, config.height * 0.52, 0),
      layout.s(position === 'bottom' ? 1.55 : 1.35),
      new Color(255, 228, 92, 255),
    );
    ensureChild(root, 'TurnIndicatorText').active = displayedCurrentPlayer === player.seatIndex && this.turnPulseVisible;

    this.createDiscardArea(canvas, layout, position, player.discards, view.lastDiscard?.fromPlayer === player.seatIndex ? view.lastDiscard.tile : null);
    this.createMeldArea(canvas, layout, position, player.melds.map((meld) => meld.tiles));
    if (position !== 'bottom') this.createOpponentHandCount(canvas, layout, position, player.handCount);
  }

  private createDiscardArea(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, discards: TileId[], highlightedTile: TileId | null): void {
    const config = this.discardAreaConfig(layout, position);
    const area = ensureChild(canvas, `Discard_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.children.forEach((child) => {
      if (child.name.startsWith('DiscardTile')) child.active = false;
    });
    const discardBackground = createImage(area, 'DiscardAreaBg', 'textures/ui/discard_area', config.width, config.height);
    discardBackground.active = discards.length > 0;
    const visibleDiscards = discards.slice(-18);
    const previousCount = this.discardCounts.get(position);
    const animateNewestTile = previousCount !== undefined && discards.length > previousCount;
    const lastHighlightIndex = highlightedTile === null ? -1 : findLastIndex(visibleDiscards, (tile) => tile === highlightedTile);
    visibleDiscards.forEach((tile, index) => {
      const col = index % 6;
      const row = Math.floor(index / 6);
      const tilePosition = new Vec3((col - 2.5) * config.tileW * 0.86, config.height * 0.2 - row * config.tileH * 0.66, 0);
      if (index === lastHighlightIndex) {
        const glow = createImage(area, `DiscardTileGlow${index}`, 'textures/ui/tile_selected_glow', config.tileW * 1.28, config.tileH * 1.18, tilePosition);
        glow.active = true;
      }
      const tileNode = this.createTile(area, `DiscardTile${index}`, tile, tilePosition, config.tileW, config.tileH);
      tileNode.active = true;
      if (animateNewestTile && index === visibleDiscards.length - 1) {
        this.animatePop(tileNode, 0.72, 0.2);
      }
    });
    if (animateNewestTile && visibleDiscards.length > 0) {
      gameAudio.play('tileDiscard', 0.55);
    }
    this.discardCounts.set(position, discards.length);
  }

  private createMeldArea(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, melds: TileId[][]): void {
    const config = this.meldAreaConfig(layout, position);
    const area = ensureChild(canvas, `Meld_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    const meldTileCount = melds.reduce((sum, meld) => sum + meld.length, 0);
    const previousMeldTileCount = this.meldTileCounts.get(position);
    const hasNewMeld = previousMeldTileCount !== undefined && meldTileCount > previousMeldTileCount;
    this.meldTileCounts.set(position, meldTileCount);
    area.active = melds.some((meld) => meld.length > 0);
    if (!area.active) return;
    area.children.forEach((child) => {
      if (child.name.startsWith('MeldTile')) child.active = false;
    });
    createImage(area, 'MeldAreaBg', 'textures/ui/meld_area', config.width, config.height);
    const visibleMelds = melds.slice(0, 4);
    const contentUnits = 1
      + visibleMelds.reduce((sum, meld) => sum + Math.max(0, meld.length - 1) * 0.64, 0)
      + Math.max(0, visibleMelds.length - 1) * 1.15;
    const tileWidth = Math.min(config.tileW, config.width * 0.9 / contentUnits);
    const tileHeight = tileWidth * (config.tileH / config.tileW);
    const tileGap = tileWidth * 0.64;
    const groupGap = tileWidth * 1.15;
    const totalSpan = visibleMelds.reduce((sum, meld) => sum + Math.max(0, meld.length - 1) * tileGap, 0)
      + Math.max(0, visibleMelds.length - 1) * groupGap;
    let cursor = -totalSpan / 2;
    visibleMelds.forEach((meld, meldIndex) => {
      meld.forEach((tile, tileIndex) => {
        const tileNode = this.createTile(area, `MeldTile${meldIndex}_${tileIndex}`, tile, new Vec3(cursor + tileIndex * tileGap, 0, 0), tileWidth, tileHeight);
        tileNode.active = true;
      });
      cursor += Math.max(0, meld.length - 1) * tileGap + groupGap;
    });
    if (hasNewMeld) gameAudio.play('meld', 0.62);
  }

  private createOpponentHandCount(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, count: number): void {
    const config = this.opponentHandConfig(layout, position);
    const area = ensureChild(canvas, `HandCount_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.children.forEach((child) => {
      if (child.name.startsWith('BackTile')) child.active = false;
    });
    const displayCount = Math.min(count, 13);
    for (let index = 0; index < displayCount; index += 1) {
      const offset = (index - (displayCount - 1) / 2) * config.gap;
      const positionVec = new Vec3(offset, 0, 0);
      const tileNode = this.createTile(area, `BackTile${index}`, null, positionVec, config.tileW, config.tileH, true);
      tileNode.active = true;
    }
    this.createText(area, 'HandCountText', `${count}`, new Vec3(0, -config.tileH * 0.72, 0), layout.s(1.4), new Color(255, 255, 255, 255));
  }

  private createSelfHand(canvas: Node, layout: RuntimeLayout, view: PlayerGameView, legalDiscardTiles: TileId[]): void {
    const handArea = ensureChild(canvas, 'SelfHandArea');
    handArea.setPosition(layout.pos(4, -33));
    this.setNodeAngle(handArea, 0);
    handArea.children.forEach((child) => {
      if (child.name.startsWith('SelfTile')) child.active = false;
    });

    const legal = new Set(legalDiscardTiles);
    const canDiscard = legalDiscardTiles.length > 0;
    const sorted = sortTiles(view.self.hand);
    const meldHint = this.meldHandHint(view);
    const tileW = layout.w(3.0);
    const tileH = tileW * 1.36;
    const gap = tileW * 0.8;
    sorted.forEach((tile, index) => {
      const isSelected = this.selectedHandIndex === index && this.lastTapTile === tile;
      const isMeldHint = meldHint.has(tile);
      const node = this.createTile(
        handArea,
        `SelfTile${index}`,
        tile,
        new Vec3((index - (sorted.length - 1) / 2) * gap, isSelected ? tileH * 0.28 : isMeldHint ? tileH * 0.16 : 0, 0),
        tileW,
        tileH,
      );
      node.active = true;
      const tileSprite = ensureComponent(ensureChild(node, 'TileImage'), Sprite);
      tileSprite.color = isSelected
        ? new Color(255, 235, 145, 255)
        : isMeldHint
          ? new Color(205, 255, 218, 255)
          : Color.WHITE;
      const previousHandler = this.handTouchHandlers.get(node);
      if (previousHandler) {
        node.off('touch-end', previousHandler);
        this.handTouchHandlers.delete(node);
      }
      const handler = (): void => {
        const isSameSelectedTile = this.selectedHandIndex === index && this.lastTapTile === tile;
        if (isSameSelectedTile) {
          if (!canDiscard) {
            this.showNotice(view.currentPlayer === view.playerIndex ? '当前没有可出的牌' : '还没轮到你出牌');
            return;
          }
          if (!legal.has(tile)) {
            this.showNotice('当前不能打出这张牌');
            return;
          }
          eventBus.emit(GameEvents.DISCARD_REQUESTED, tile);
          return;
        }

        this.selectedHandIndex = index;
        this.lastTapTile = tile;
        gameAudio.play('tileSelect', 0.42);
        this.createSelfHand(canvas, layout, view, legalDiscardTiles);
        this.animateLift(node, tileH * 0.28);
      };
      this.handTouchHandlers.set(node, handler);
      node.on('touch-end', handler);
    });
  }

  private meldHandHint(view: PlayerGameView): Set<TileId> {
    const hint = new Set<TileId>();
    const discard = view.lastDiscard?.tile;
    if (discard === undefined) return hint;
    view.legalActions.forEach((action) => {
      if (!MELD_ACTION_TYPES.has(action.type)) return;
      getActionPreviewTiles(action).forEach((tile) => {
        if (tile !== discard) hint.add(tile);
      });
    });
    return hint;
  }

  private meldPreviewTiles(action: GameAction, view: PlayerGameView): TileId[] {
    return getKongPreviewTiles(action, view.self.hand, view.xiaoJiActiveAsWild !== false);
  }

  private createActionPanel(canvas: Node, layout: RuntimeLayout, view: PlayerGameView, submitting: boolean): void {
    const actions = view.legalActions;
    const panel = ensureChild(canvas, 'ActionPanel');
    panel.children.forEach((child) => {
      if (child.name.startsWith('Action_')) child.active = false;
    });
    const visibleActions = actions
      .filter((action) => action.type !== 'DISCARD' && action.type !== 'SELECT_KONG_TILE' && !MELD_ACTION_TYPES.has(action.type))
      .sort((a, b) => ACTION_ORDER.indexOf(a.type) - ACTION_ORDER.indexOf(b.type));
    panel.active = visibleActions.length > 0;
    if (visibleActions.length === 0) {
      this.winPromptSignature = '';
      return;
    }

    const winAction = visibleActions.find((action) => action.type === 'WIN');
    if (winAction) {
      panel.setPosition(layout.pos(29, -20.5));
      const promptWidth = layout.w(20);
      const promptHeight = promptWidth / (640 / 260);
      const promptBackground = createImage(panel, 'ActionPromptBg', 'textures/ui/room_panel', promptWidth, promptHeight);
      promptBackground.active = true;
      (promptBackground as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(0);

      this.createText(
        panel,
        'WinPromptTitle',
        submitting ? '正在确认' : '可以胡牌',
        new Vec3(promptWidth * 0.13, promptHeight * 0.29, 0),
        layout.s(1.65),
        new Color(255, 236, 158, 255),
      );
      ensureChild(panel, 'WinPromptTitle').active = true;

      const responseTile = this.responseTile(view) ?? winAction.tile ?? null;
      const tileWidth = layout.w(3.25);
      const tileHeight = tileWidth * 1.36;
      const tilePosition = new Vec3(-promptWidth * 0.32, -promptHeight * 0.04, 0);
      const tileGlow = createImage(panel, 'WinTargetGlow', 'textures/ui/tile_selected_glow', tileWidth * 1.42, tileHeight * 1.2, tilePosition);
      tileGlow.active = responseTile !== null;
      const targetTile = ensureChild(panel, 'WinTargetTile');
      targetTile.active = responseTile !== null;
      if (responseTile !== null) {
        this.createTile(panel, 'WinTargetTile', responseTile, tilePosition, tileWidth, tileHeight).active = true;
        this.createText(
          panel,
          'WinTargetName',
          getTileLabel(responseTile),
          new Vec3(tilePosition.x, -promptHeight * 0.39, 0),
          layout.s(1.15),
          new Color(229, 246, 215, 255),
        );
        ensureChild(panel, 'WinTargetName').active = true;
      } else {
        const targetName = panel.children.find((child) => child.name === 'WinTargetName');
        if (targetName) targetName.active = false;
      }

      const promptActions = visibleActions.filter((action) => action.type === 'WIN' || action.type === 'PASS');
      const buttonWidth = layout.w(5.05);
      const buttonHeight = buttonWidth / 1.7;
      const buttonCenterX = promptWidth * 0.18;
      promptActions.forEach((action, index) => {
        const button = createImageButton(
          panel,
          `Action_${action.type}_${index}`,
          '',
          ACTION_IMAGE_PATHS[action.type] || 'textures/ui/action_button_pass',
          () => {
            if (!submitting) {
              gameAudio.play('button', 0.5);
              eventBus.emit(GameEvents.ACTION_SELECTED, action);
            }
          },
          new Vec3(buttonCenterX + (index - (promptActions.length - 1) / 2) * buttonWidth * 1.12, -promptHeight * 0.08, 0),
          buttonWidth,
          buttonHeight,
        );
        button.active = true;
        (button as Node & { setSiblingIndex?: (siblingIndex: number) => void }).setSiblingIndex?.(panel.children.length - 1);
      });

      const signature = `${winAction.actionId}:${responseTile ?? 'none'}`;
      if (signature !== this.winPromptSignature) {
        this.winPromptSignature = signature;
        this.animatePop(panel, 0.9, 0.22);
      }
      return;
    }

    this.winPromptSignature = '';
    ['ActionPromptBg', 'WinPromptTitle', 'WinTargetGlow', 'WinTargetTile', 'WinTargetName'].forEach((name) => {
      const node = panel.children.find((child) => child.name === name);
      if (node) node.active = false;
    });
    const hasCenteredChoice = actions.some(
      (action) => MELD_ACTION_TYPES.has(action.type) || action.type === 'SELECT_KONG_TILE',
    );
    panel.setPosition(hasCenteredChoice ? layout.pos(0, -19) : layout.pos(31, -30));

    visibleActions.forEach((action, index) => {
      const width = action.type === 'PASS' && hasCenteredChoice
        ? layout.w(6.4)
        : action.type === 'WIN'
          ? layout.w(6.3)
          : action.type === 'SELECT_KONG_TILE'
            ? layout.w(7.5)
            : layout.w(5.6);
      const height = width / (action.type === 'WIN' ? 1.72 : action.type === 'SELECT_KONG_TILE' ? 2.24 : 1.68);
      const button = createImageButton(
        panel,
        `Action_${action.type}_${index}`,
        '',
        ACTION_IMAGE_PATHS[action.type] || 'textures/ui/action_button_pass',
        () => {
          if (!submitting) {
            gameAudio.play('button', 0.5);
            eventBus.emit(GameEvents.ACTION_SELECTED, action);
          }
        },
        new Vec3((index - (visibleActions.length - 1) / 2) * width * 1.02, 0, 0),
        width,
        height,
      );
      button.active = true;
    });
  }

  private createMeldActionChoices(canvas: Node, layout: RuntimeLayout, actions: GameAction[], view: PlayerGameView, submitting: boolean): void {
    const choices = actions.filter((action) => MELD_ACTION_TYPES.has(action.type) && getActionPreviewTiles(action).length > 0);
    const layer = ensureChild(canvas, 'MeldActionChoices');
    layer.active = choices.length > 0;
    if (choices.length === 0) {
      this.meldChoiceSignature = '';
      return;
    }
    layer.setPosition(layout.pos(0, -1.8));
    layer.children.forEach((child) => {
      if (child.name.startsWith('MeldChoice_')) child.active = false;
    });

    const passAction = actions.find((action) => action.type === 'PASS');
    const visibleChoices = [...choices.slice(0, 4), ...(passAction ? [passAction] : [])];
    const panelWidth = layout.w(44);
    const panelHeight = (panelWidth / (1600 / 656)) * (visibleChoices.length > 4 ? 1.24 : 1);
    const optionWidth = panelWidth * 0.365;
    const optionHeight = panelHeight * 0.255;
    const oldFallback = layer.children.find((child) => child.name === 'MeldChoiceBg');
    if (oldFallback) oldFallback.active = false;
    const backdrop = createImage(layer, 'MeldChoiceBackdrop', 'textures/ui/action_background', panelWidth, panelHeight);
    (backdrop as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(0);
    this.createText(layer, 'MeldChoiceTitle', '选择牌型', new Vec3(0, panelHeight * 0.395, 0), layout.s(2.25), new Color(61, 52, 30, 255));

    visibleChoices.forEach((action, index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x = (column === 0 ? -1 : 1) * panelWidth * 0.192;
      const y = row === 0 ? panelHeight * 0.116 : row === 1 ? -panelHeight * 0.192 : -panelHeight * 0.48;
      const option = ensureChild(layer, `MeldChoice_${index}`);
      option.setPosition(x, y, 0);
      option.active = true;
      ensureComponent(option, UITransform).setContentSize(optionWidth, optionHeight);
      const optionSprite = option.getComponent(Sprite);
      if (optionSprite) (optionSprite as Sprite & { enabled: boolean }).enabled = false;
      (option as Node & { setSiblingIndex?: (siblingIndex: number) => void }).setSiblingIndex?.(layer.children.length - 1);
      const optionBg = option.children.find((child) => child.name === 'OptionBg');
      if (optionBg) optionBg.active = false;
      bindTouchEnd(option, () => {
        if (!submitting) {
          gameAudio.play('button', 0.5);
          eventBus.emit(GameEvents.ACTION_SELECTED, action);
        }
      });
      option.children.forEach((child) => {
        if (child.name.startsWith('PreviewTile_')) child.active = false;
      });

      const previewTiles = this.meldPreviewTiles(action, view);
      const tileWidth = layout.w(2.2);
      const tileHeight = tileWidth * 1.36;
      const tileGap = tileWidth * 0.8;
      const label = action.type === 'PASS' ? ActionLabels.PASS : this.meldActionLabel(action.type);
      this.createText(option, 'ActionLabel', label, new Vec3(-optionWidth * 0.34, 0, 0), layout.s(2.15), new Color(255, 232, 153, 255));
      ensureChild(option, 'ActionLabel').active = true;
      previewTiles.forEach((tile, tileIndex) => {
        const tileX = optionWidth * 0.15 + (tileIndex - (previewTiles.length - 1) / 2) * tileGap;
        const tileNode = this.createTile(option, `PreviewTile_${tileIndex}`, tile, new Vec3(tileX, 0, 0), tileWidth, tileHeight);
        tileNode.active = true;
        ensureChild(tileNode, 'TileImage').active = true;
      });
    });
    const titleNode = ensureChild(layer, 'MeldChoiceTitle');
    titleNode.active = true;
    (titleNode as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(layer.children.length - 1);
    const signature = visibleChoices.map((action) => `${action.type}:${action.actionId}:${this.meldPreviewTiles(action, view).join(',')}`).join('|');
    if (signature !== this.meldChoiceSignature) {
      this.meldChoiceSignature = signature;
      this.animatePop(layer, 0.92, 0.22);
    }
  }

  private createKongTileChoice(canvas: Node, layout: RuntimeLayout, actions: GameAction[], submitting: boolean): void {
    const choices = actions.filter((action) => action.type === 'SELECT_KONG_TILE' && action.tile !== undefined);
    const layer = ensureChild(canvas, 'KongTileChoice');
    layer.active = choices.length > 0;
    if (choices.length === 0) {
      this.kongChoiceSignature = '';
      return;
    }
    layer.setPosition(layout.pos(0, -1.5));
    layer.children.forEach((child) => {
      if (child.name.startsWith('KongChoice')) child.active = false;
    });

    const panelWidth = layout.w(40);
    const panelHeight = panelWidth / (1616 / 656);
    const choiceBackground = createImage(layer, 'ChoiceBg', 'textures/ui/kong_card_action_backgroud', panelWidth, panelHeight);
    (choiceBackground as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(0);
    const oldGlow = layer.children.find((child) => child.name === 'ChoiceGlow');
    if (oldGlow) oldGlow.active = false;
    this.createText(layer, 'ChoiceTitle', '选择杠后补牌', new Vec3(0, panelHeight * 0.405, 0), layout.s(1.85), new Color(61, 52, 30, 255));

    choices.slice(0, 2).forEach((action, index) => {
      const tile = action.tile as TileId;
      const x = (index === 0 ? -1 : 1) * panelWidth * 0.214;
      const choiceNode = ensureChild(layer, `KongChoiceHit${index}`);
      choiceNode.setPosition(x, -panelHeight * 0.045, 0);
      ensureComponent(choiceNode, UITransform).setContentSize(panelWidth * 0.19, panelHeight * 0.61);
      const choiceSprite = choiceNode.getComponent(Sprite);
      if (choiceSprite) (choiceSprite as Sprite & { enabled: boolean }).enabled = false;
      choiceNode.active = true;
      (choiceNode as Node & { setSiblingIndex?: (siblingIndex: number) => void }).setSiblingIndex?.(layer.children.length - 1);
      bindTouchEnd(choiceNode, () => {
        if (!submitting) {
          gameAudio.play('button', 0.5);
          eventBus.emit(GameEvents.ACTION_SELECTED, action);
        }
      });
      const tileNode = this.createTile(choiceNode, 'Tile', tile, new Vec3(0, panelHeight * 0.015, 0), panelWidth * 0.105, panelWidth * 0.143);
      this.createText(choiceNode, 'TileName', getTileLabel(tile), new Vec3(0, -panelHeight * 0.34, 0), layout.s(1.35), new Color(235, 248, 217, 255));
      tileNode.active = true;
      ensureChild(tileNode, 'TileImage').active = true;
      ensureChild(choiceNode, 'TileName').active = true;
    });
    const choiceTitle = ensureChild(layer, 'ChoiceTitle');
    choiceTitle.active = true;
    (choiceTitle as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(layer.children.length - 1);
    const signature = choices.slice(0, 2).map((action) => `${action.actionId}:${action.tile}`).join('|');
    if (signature !== this.kongChoiceSignature) {
      this.kongChoiceSignature = signature;
      this.animatePop(layer, 0.9, 0.24);
    }
  }

  private createResponseHint(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const hint = ensureChild(canvas, 'ResponseHint');
    if (view.legalActions.some((action) => MELD_ACTION_TYPES.has(action.type) || action.type === 'WIN')) {
      hint.active = false;
      return;
    }
    const responseTile = this.responseTile(view);
    hint.active = responseTile !== null;
    if (responseTile === null) return;
    hint.setPosition(layout.pos(31, -16.5));

    const panelWidth = layout.w(14);
    const panelHeight = layout.h(10.5);
    createImage(hint, 'ResponseHintBg', 'textures/ui/room_panel', panelWidth, panelHeight);
    createImage(hint, 'ResponseHintGlow', 'textures/ui/turn_glow', panelWidth * 0.82, panelHeight * 0.5, new Vec3(0, -panelHeight * 0.08, 0));
    this.createText(hint, 'ResponseHintTitle', '可响应', new Vec3(0, panelHeight * 0.27, 0), layout.s(1.65), new Color(255, 240, 168, 255));
    this.createTile(hint, 'ResponseHintTile', responseTile, new Vec3(0, -panelHeight * 0.11, 0), layout.w(3.4), layout.w(4.65));
    this.createText(hint, 'ResponseHintName', getTileLabel(responseTile), new Vec3(0, -panelHeight * 0.38, 0), layout.s(1.35), new Color(235, 248, 217, 255));
  }

  private createResultDialog(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    const layer = ensureChild(canvas, 'ResultDialogLayer');
    layer.active = true;
    createPanel(layer, 'Mask', layout.width, layout.height, new Color(0, 0, 0, 165));
    const isFinal = this.isFinalResult(view);
    const dialogWidth = layout.w(isFinal ? 62 : 60);
    const dialogHeight = dialogWidth / (1200 / 880);
    createPanel(layer, 'DialogFallback', dialogWidth, dialogHeight, new Color(9, 57, 43, 245));
    createImage(layer, 'DialogBg', 'textures/ui/result_board', dialogWidth, dialogHeight);

    const result = view.result;
    const selfWon = Boolean(result?.winnerIndexes.includes(view.playerIndex));
    this.createText(
      layer,
      'ResultTitle',
      isFinal ? '总分结算' : result?.title || (view.status === 'DRAW' ? '流局' : selfWon ? '胡牌结算' : '本局结算'),
      new Vec3(0, dialogHeight * 0.405, 0),
      layout.s(2.75),
      new Color(255, 234, 164, 255),
    );
    this.createText(layer, 'RoundText', `第 ${view.currentRound ?? this.currentRound} / ${this.displayMaxRounds(view)} 局`, new Vec3(0, dialogHeight * 0.35, 0), layout.s(1.55), new Color(218, 244, 205, 255));

    this.createResultScores(layer, layout, view, result, dialogWidth, dialogHeight);
    this.createFanList(layer, layout, result, dialogWidth, dialogHeight);
    const replayButton = layer.children.find((child) => child.name === 'ReplayButton');
    if (replayButton) replayButton.active = false;
    const buttonWidth = dialogWidth * 0.185;
    const buttonPosition = new Vec3(0, -dialogHeight * 0.368, 0);

    if (isFinal) {
      const continueButton = layer.children.find((child) => child.name === 'ContinueButton');
      if (continueButton) continueButton.active = false;
      createImageButton(layer, 'EndGameButton', '', 'textures/ui/button_back_room', () => this.backToRoom(), buttonPosition, buttonWidth, buttonWidth / 3.02).active = true;
      return;
    }

    const endGameButton = layer.children.find((child) => child.name === 'EndGameButton');
    if (endGameButton) endGameButton.active = false;
    createImageButton(layer, 'ContinueButton', '', 'textures/ui/button_continue', () => this.continueGame(), buttonPosition, buttonWidth, buttonWidth / 3.02).active = true;
  }

  private createResultScores(
    layer: Node,
    layout: RuntimeLayout,
    view: PlayerGameView,
    result: ScoreResult | undefined,
    dialogWidth: number,
    dialogHeight: number,
  ): void {
    const names = this.playerNames(view);
    const avatarUrls = this.playerAvatarUrls(view);
    const deltas = result?.scoreDelta || [0, 0, 0, 0];
    layer.children.forEach((child) => {
      if (child.name.startsWith('ScoreRow')) child.active = false;
    });
    const rowYRatios = [0.218, 0.064, -0.087, -0.239];
    const avatarSize = dialogHeight * 0.1;
    for (let index = 0; index < 4; index += 1) {
      const y = dialogHeight * rowYRatios[index];
      const delta = deltas[index] || 0;
      createRemoteImage(
        layer,
        `ScoreAvatar${index}`,
        avatarUrls[index],
        'textures/ui/default_avatar',
        avatarSize,
        avatarSize,
        new Vec3(-dialogWidth * 0.321, y, 0),
      );
      this.createText(layer, `ScoreName${index}`, `${index}号  ${names[index] || '玩家'}`, new Vec3(-dialogWidth * 0.2, y, 0), layout.s(1.7));
      this.createText(layer, `ScoreDelta${index}`, `${delta >= 0 ? '+' : ''}${delta}`, new Vec3(dialogWidth * 0.06, y, 0), layout.s(2.15), delta >= 0 ? new Color(255, 229, 137, 255) : new Color(170, 230, 255, 255));
    }
  }

  private createFanList(
    layer: Node,
    layout: RuntimeLayout,
    result: ScoreResult | undefined,
    dialogWidth: number,
    dialogHeight: number,
  ): void {
    const fanItems = result?.fanItems || [];
    layer.children.forEach((child) => {
      if (child.name.startsWith('FanItem') || child.name === 'FanEmptyText') child.active = false;
    });
    const columnX = dialogWidth * 0.29;
    this.createText(layer, 'FanTitle', '番型明细', new Vec3(columnX, dialogHeight * 0.218, 0), layout.s(1.8), new Color(255, 238, 170, 255));
    fanItems.slice(0, 6).forEach((item, index) => {
      const y = dialogHeight * (0.135 - index * 0.069);
      this.createText(layer, `FanItemText${index}`, `${item.name}  ${item.points}分`, new Vec3(columnX, y, 0), layout.s(1.35), new Color(225, 241, 211, 255));
      ensureChild(layer, `FanItemText${index}`).active = true;
    });
    if (fanItems.length === 0) {
      this.createText(layer, 'FanEmptyText', '暂无番型', new Vec3(columnX, dialogHeight * 0.1, 0), layout.s(1.45), new Color(190, 213, 183, 255));
      ensureChild(layer, 'FanEmptyText').active = true;
    }
  }

  private createTile(parent: Node, name: string, tile: TileId | null, position: Vec3, width: number, height: number, faceDown = false): Node {
    const node = ensureChild(parent, name);
    node.setPosition(position);
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
    void bgmManager.play('lobbyAmbient');
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

  private meldActionLabel(type: ActionType): string {
    if (type === 'PONG') return '碰';
    if (type === 'KONG_EXPOSED') return '明杠';
    if (type === 'KONG_CONCEALED') return '暗杠';
    if (type === 'KONG_ADDED') return '加杠';
    return '吃';
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

  private playerAvatarUrls(view: PlayerGameView): string[] {
    const urls = ['', '', '', ''];
    urls[view.playerIndex] = (view.self as { avatarUrl?: string }).avatarUrl || '';
    view.opponents.forEach((player) => {
      urls[player.seatIndex] = player.avatarUrl || '';
    });
    return urls;
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
    const width = position === 'bottom' || position === 'top' ? layout.w(18.5) : layout.w(13);
    const height = width / DISCARD_AREA_RATIO;
    if (position === 'bottom') return { width, height, position: layout.pos(0, -21), tileW: layout.w(2.2), tileH: layout.w(3.0) };
    if (position === 'right') return { width, height, position: layout.pos(22, 3), tileW: layout.w(1.8), tileH: layout.w(2.45) };
    if (position === 'top') return { width, height, position: layout.pos(0, 14.5), tileW: layout.w(2.05), tileH: layout.w(2.8) };
    return { width, height, position: layout.pos(-22, 3), tileW: layout.w(1.8), tileH: layout.w(2.45) };
  }

  private meldAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    const width = position === 'bottom' ? layout.w(22) : layout.w(17);
    const height = width / MELD_AREA_RATIO;
    if (position === 'bottom') return { width, height, position: layout.pos(-23, -30.5), tileW: layout.w(2.25), tileH: layout.w(3.05) };
    if (position === 'right') return { width, height, position: layout.pos(30, -12), tileW: layout.w(1.8), tileH: layout.w(2.45) };
    if (position === 'top') return { width, height, position: layout.pos(-19, 23), tileW: layout.w(1.85), tileH: layout.w(2.5) };
    return { width, height, position: layout.pos(-30, -12), tileW: layout.w(1.8), tileH: layout.w(2.45) };
  }

  private opponentHandConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    if (position === 'right') return { position: layout.pos(32, 3), tileW: layout.w(1.35), tileH: layout.w(1.85), gap: layout.w(1.2) };
    if (position === 'left') return { position: layout.pos(-32, 3), tileW: layout.w(1.35), tileH: layout.w(1.85), gap: layout.w(1.2) };
    return { position: layout.pos(0, 23), tileW: layout.w(1.65), tileH: layout.w(2.25), gap: layout.w(1.32) };
  }

  private avatarPosition(width: number, height: number, position: LocalSeatPosition): Vec3 {
    if (position === 'bottom') return new Vec3(-width * 0.318, height * 0.02, 0);
    return new Vec3(-width * 0.279, height * 0.02, 0);
  }

  private sideAngle(position: LocalSeatPosition): number {
    if (position === 'left') return -90;
    if (position === 'right') return 90;
    return 0;
  }

  private setNodeAngle(node: Node, angle: number): void {
    (node as Node & { angle?: number }).angle = angle;
  }

  private animatePop(node: Node, fromScale: number, duration: number): void {
    node.setScale(fromScale, fromScale, 1);
    tween(node).to(duration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
  }

  private animateLift(node: Node, distance: number): void {
    const target = new Vec3(node.position.x, node.position.y, node.position.z);
    node.setPosition(target.x, target.y - distance, target.z);
    tween(node).to(0.14, { position: target }, { easing: 'quadOut' }).start();
  }

  private playRoundOpeningAnimation(canvas: Node, layout: RuntimeLayout, view: PlayerGameView): void {
    this.clearOpeningAnimationTimers();
    const token = ++this.openingAnimationToken;
    const layer = ensureChild(canvas, 'RoundOpeningAnimation');
    layer.active = true;
    layer.setPosition(Vec3.ZERO);
    layer.setScale(1, 1, 1);
    layer.children.forEach((child) => {
      if (child.name.startsWith('OpeningHand_') || child.name.startsWith('RoundOpeningTile_')) child.active = false;
    });
    ['RoundOpeningMask', 'RoundOpeningTitle', 'RoundOpeningSubtitle'].forEach((name) => {
      const oldNode = layer.children.find((child) => child.name === name);
      if (oldNode) oldNode.active = false;
    });

    const openingHands: Array<{
      position: LocalSeatPosition;
      tiles: TileId[];
      faceDown: boolean;
    }> = [
      {
        position: 'bottom',
        tiles: [...view.self.hand].sort((a, b) => a - b),
        faceDown: false,
      },
      ...view.opponents.map((player) => ({
        position: this.positionForOpponent(view.playerIndex, player.seatIndex),
        tiles: Array.from({ length: Math.min(player.handCount, 13) }, () => 0),
        faceDown: true,
      })),
    ];

    openingHands.forEach(({ position, tiles, faceDown }) => {
      const original = canvas.children.find((child) => child.name === (
        position === 'bottom' ? 'SelfHandArea' : `HandCount_${position}`
      ));
      if (original) original.active = false;

      const group = ensureChild(layer, `OpeningHand_${position}`);
      const config = position === 'bottom'
        ? {
            position: layout.pos(4, -33),
            tileW: layout.w(3.0),
            tileH: layout.w(3.0) * 1.36,
            gap: layout.w(3.0) * 0.8,
          }
        : this.opponentHandConfig(layout, position);
      group.active = true;
      group.setPosition(config.position);
      group.setScale(1, 1, 1);
      this.setNodeAngle(group, this.sideAngle(position));
      group.children.forEach((child) => {
        if (child.name.startsWith('OpeningTile_')) child.active = false;
      });

      tiles.forEach((tileId, index) => {
        const target = new Vec3((index - (tiles.length - 1) / 2) * config.gap, 0, 0);
        const tile = this.createTile(
          group,
          `OpeningTile_${index}`,
          faceDown ? null : tileId,
          Vec3.ZERO,
          config.tileW,
          config.tileH,
          faceDown,
        );
        tile.active = true;
        tile.setScale(0.82, 0.82, 1);
        this.scheduleOpeningAnimationStep(token, index * 34, () => {
          tween(tile)
            .to(0.32, { position: target, scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
        });
      });
    });

    gameAudio.play('roundStart', 0.3);
    this.scheduleOpeningAnimationStep(token, 620, () => gameAudio.play('meld', 0.26));
    this.scheduleOpeningAnimationStep(token, 880, () => {
      ['bottom', 'right', 'top', 'left'].forEach((position) => {
        const original = canvas.children.find((child) => child.name === (
          position === 'bottom' ? 'SelfHandArea' : `HandCount_${position}`
        ));
        if (original) original.active = true;
      });
      layer.active = false;
    });
  }

  private scheduleOpeningAnimationStep(token: number, delayMs: number, callback: () => void): void {
    const timer = setTimeout(() => {
      if (token === this.openingAnimationToken) callback();
    }, delayMs);
    this.openingAnimationTimers.push(timer);
  }

  private clearOpeningAnimationTimers(): void {
    this.openingAnimationTimers.forEach((timer) => clearTimeout(timer));
    this.openingAnimationTimers.length = 0;
    this.openingAnimationToken += 1;
  }

  private readonly updateTurnPulse = (): void => {
    this.turnPulseVisible = !this.turnPulseVisible;
    const canvas = this.node.children.find((child) => child.name === 'RuntimeCanvas');
    const view = gameManager.currentView;
    if (!canvas || !view) return;
    const displayedCurrentPlayer = gameManager.presentationAiSeat ?? view.currentPlayer;

    (['bottom', 'right', 'top', 'left'] as LocalSeatPosition[]).forEach((position) => {
      const playerRoot = canvas.children.find((child) => child.name === `Player_${position}`);
      if (!playerRoot) return;
      const isCurrent = this.seatByPosition.get(position) === displayedCurrentPlayer;
      const glow = playerRoot.children.find((child) => child.name === 'TurnGlow');
      const indicator = playerRoot.children.find((child) => child.name === 'TurnIndicatorText');
      if (glow) {
        glow.active = isCurrent;
        if (isCurrent) {
          const pulseScale = this.turnPulseVisible ? 1.04 : 0.98;
          tween(glow).to(0.4, { scale: new Vec3(pulseScale, pulseScale, 1) }, { easing: 'sineInOut' }).start();
        } else {
          glow.setScale(1, 1, 1);
        }
      }
      if (indicator) indicator.active = isCurrent && this.turnPulseVisible;
    });

    canvas.children
      .filter((child) => child.name.startsWith('Discard_'))
      .forEach((discardArea) => {
        discardArea.children
          .filter((child) => child.active && child.name.startsWith('DiscardTileGlow'))
          .forEach((glow) => {
            const pulseScale = this.turnPulseVisible ? 1.08 : 0.98;
            tween(glow).to(0.4, { scale: new Vec3(pulseScale, pulseScale, 1) }, { easing: 'sineInOut' }).start();
          });
      });

    const actionPanel = canvas.children.find((child) => child.name === 'ActionPanel');
    const winTargetGlow = actionPanel?.children.find((child) => child.name === 'WinTargetGlow');
    if (winTargetGlow?.active) {
      const pulseScale = this.turnPulseVisible ? 1.08 : 0.97;
      tween(winTargetGlow).to(0.4, { scale: new Vec3(pulseScale, pulseScale, 1) }, { easing: 'sineInOut' }).start();
    }
  };

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
