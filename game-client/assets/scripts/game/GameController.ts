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
import { meldTypeToVoiceKey, tileToVoiceKey, winVoiceKeys } from '../audio/VoiceCatalog';
import { showWechatConfirm } from '../platform/WechatPlatform';
import { authManager } from '../auth/AuthManager';
import {
  applyLandscapeResolution,
  bindTouchEnd,
  createButton,
  createImage,
  createImageButton,
  createIconButton,
  createLabel,
  createLayout,
  createPanel,
  createRemoteImage,
  ensureCanvas,
  ensureChild,
  ensureComponent,
  RuntimeLayout,
  setButtonImage,
  TEXT_SCALE,
} from '../ui/RuntimeUi';
import { getTileTexturePath, TILE_BACK_TEXTURE } from '../assets/TileAssetMap';
import { getTileLabel, sortTiles } from '../utils/TileUtils';
import { getActionPreviewTiles, getKongPreviewTiles } from './GameActionBuilder';
import { findNewDrawIndex, gameManager, getDisplayedScores, OPENING_INTERACTION_LOCK_MS } from './GameManager';
import { planGameAudioCues } from './GameAudioPlanner';
import type { ActionType, GameAction, LocalSeatPosition, Meld, PlayerGameView, PlayerPublicView, ScoreResult, TileId } from './GameTypes';

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

// Response melds are rendered in the compact tile-preview panel; self-turn kongs
// (KONG_CONCEALED / KONG_ADDED) stay in the action button panel instead.
const RESPONSE_MELD_TYPES = new Set<ActionType>([
  'PONG',
  'CHOW_LEFT',
  'CHOW_MIDDLE',
  'CHOW_RIGHT',
  'KONG_EXPOSED',
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
  private lastHandRoundKey = '';
  private lastSelfHand: TileId[] = [];
  private newDrawIndex: number | null = null;
  private currentRound = 1;
  private readonly handTouchHandlers = new Map<Node, () => void>();
  private readonly seatByPosition = new Map<LocalSeatPosition, number>();
  private readonly discardCounts = new Map<LocalSeatPosition, number>();
  private readonly meldSignatures = new Map<LocalSeatPosition, string>();
  private readonly openingAnimationTimers: Array<ReturnType<typeof setTimeout>> = [];
  private turnPulseVisible = true;
  private lastCurrentPlayer: number | null = null;
  private lastAudioRoundKey = '';
  private lastAudioStatus = '';
  private openingAnimationToken = 0;
  private meldChoiceSignature = '';
  private kongChoiceSignature = '';
  private winPromptSignature = '';
  private kongMenuOpen = false;
  private kongMenuSignature = '';
  private exiting = false;
  private lastAudioView: PlayerGameView | null = null;

  async start(): Promise<void> {
    console.log('[GameController] start');
    applyLandscapeResolution();
    gameAudio.attach(this.node);
    void bgmManager.play('tableAmbient');
    await this.enter();
    const room = roomManager.currentRoom;
    const roomId = room?.roomId || mockGameView.roomId;
    const gameId = room?.gameId || mockGameView.gameId;
    gameManager.beginOpeningSequence(gameId);
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
    // Scene destruction already removes node listeners. Calling off() here can
    // hit a node whose internal event target was destroyed earlier in the same
    // Cocos deferred-destroy pass (engine error 5000 on WeChat).
    this.handTouchHandlers.clear();
    this.clearOpeningAnimationTimers();
    gameAudio.detach();
    gameManager.stopPolling();
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
    this.presentStateAudio(view);
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
      playRoundOpening = snapshot.openingLocked || continuingFromPreviousRound || view.stepIndex <= 4;
    }
    if (view.status === 'FINISHED' && this.lastAudioStatus !== 'FINISHED') {
      const selfWon = Boolean(view.result?.winnerIndexes.includes(view.playerIndex));
      gameAudio.play(selfWon ? 'win' : 'winOthers', selfWon ? 0.7 : 0.55);
      if (view.result) gameAudio.playVoice(winVoiceKeys(view.result), 1.0, 'replace');
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
    this.createKongMenu(canvas, layout, view, snapshot.submitting);
    this.createResponseHint(canvas, layout, view);
    if (snapshot.openingLocked) this.hideOpeningInteractions(canvas);
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
    const hudWidth = layout.w(48);
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
    const exitSize = layout.s(5.5);
    createImageButton(
      canvas,
      'ExitGameButton',
      '',
      'textures/ui/button_back',
      () => void this.exitGame(),
      layout.pos(-43, 37),
      exitSize,
      exitSize,
    );
    const exitLabel = createLabel(canvas, 'ExitGameLabel', '退出', layout.pos(-43, 32.2));
    exitLabel.fontSize = layout.s(1.6) * TEXT_SCALE;
    exitLabel.lineHeight = layout.s(2.0) * TEXT_SCALE;
    exitLabel.color = new Color(255, 232, 151, 255);
    createIconButton(canvas, 'BgmToggleButton', this.bgmIcon(), () => this.toggleBgm(), layout.pos(43, 37), layout.s(7));
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

    const kongWidth = layout.w(15);
    createImage(canvas, 'PublicKongPanel', 'textures/ui/public_kong_panel', kongWidth, kongWidth / 3.1, layout.pos(0, -8.2));
    this.createText(canvas, 'PublicKongTitle', '杠牌', layout.pos(0, -5.25), layout.s(1.75), new Color(255, 232, 151, 255));
    ensureChild(canvas, 'PublicKongTitle').getComponent(UITransform)?.setContentSize(layout.w(9), layout.h(3.2));
    const xiaoJiText = canvas.children.find((child) => child.name === 'XiaoJiText');
    if (xiaoJiText) xiaoJiText.active = false;
    for (let index = 0; index < 4; index += 1) {
      const tile = view.publicKongTiles[index];
      const node = ensureChild(canvas, `PublicKongTile${index}`);
      node.active = tile !== undefined;
      if (tile !== undefined) {
        this.createTile(canvas, `PublicKongTile${index}`, tile, layout.pos(-2.7 + index * 2.45, -7.9), layout.w(2.05), layout.w(2.8));
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
      nickname: authManager.user?.nickname || view.self.nickname || '我',
      avatarUrl: authManager.user?.avatarUrl || view.self.avatarUrl || '',
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
    ensureChild(root, 'Nickname').getComponent(UITransform)?.setContentSize(config.width * 0.58, config.height * 0.28);
    const displayedScores = getDisplayedScores(view);
    this.createText(root, 'Score', `总分 ${displayedScores[player.seatIndex] ?? 0}`, new Vec3(config.width * 0.1, -config.height * 0.2, 0), layout.s(position === 'bottom' ? 1.65 : 1.4), new Color(255, 234, 166, 255));
    ensureChild(root, 'Score').getComponent(UITransform)?.setContentSize(config.width * 0.58, config.height * 0.24);

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
    this.createMeldArea(canvas, layout, position, player.melds);
    if (position !== 'bottom') this.createOpponentHandCount(canvas, layout, position, player.handCount);
  }

  private createDiscardArea(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, discards: TileId[], highlightedTile: TileId | null): void {
    const config = this.discardAreaConfig(layout, position);
    const area = ensureChild(canvas, `Discard_${position}`);
    area.active = true;
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    area.children.forEach((child) => {
      if (child.name.startsWith('DiscardTile')) child.active = false;
    });
    const discardBackground = createImage(area, 'DiscardAreaBg', 'textures/ui/discard_area', config.width, config.height);
    discardBackground.active = discards.length > 0;
    const visibleDiscards = discards.slice(-18);
    const previousCount = this.discardCounts.get(position);
    const hasNewDiscard = previousCount !== undefined && discards.length > previousCount;
    const lastHighlightIndex = highlightedTile === null ? -1 : findLastIndex(visibleDiscards, (tile) => tile === highlightedTile);
    const presentNewestTile = hasNewDiscard && lastHighlightIndex === visibleDiscards.length - 1;
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
      if (presentNewestTile && index === visibleDiscards.length - 1) {
        this.animatePop(tileNode, 0.72, 0.2);
      }
    });
    this.discardCounts.set(position, discards.length);
  }

  private createMeldArea(canvas: Node, layout: RuntimeLayout, position: LocalSeatPosition, melds: Meld[]): void {
    const config = this.meldAreaConfig(layout, position);
    const area = ensureChild(canvas, `Meld_${position}`);
    area.setPosition(config.position);
    this.setNodeAngle(area, this.sideAngle(position));
    const meldSignature = JSON.stringify(melds.map((meld) => ({ type: meld.type, tiles: meld.tiles })));
    const previousMeldSignature = this.meldSignatures.get(position);
    this.meldSignatures.set(position, meldSignature);
    area.active = melds.some((meld) => meld.tiles.length > 0);
    if (!area.active) return;
    area.children.forEach((child) => {
      if (child.name.startsWith('MeldTile')) child.active = false;
    });
    createImage(area, 'MeldAreaBg', 'textures/ui/meld_area', config.width, config.height);
    const visibleMelds = melds.slice(0, 4);
    const tileGapRatio = 0.7;
    const groupGapRatio = 0.62;
    const contentUnits = visibleMelds.reduce(
      (sum, meld) => sum + 1 + Math.max(0, meld.tiles.length - 1) * tileGapRatio,
      0,
    ) + Math.max(0, visibleMelds.length - 1) * groupGapRatio;
    const tileWidth = Math.min(config.tileW, config.width * 0.88 / Math.max(contentUnits, 1));
    const tileHeight = tileWidth * (config.tileH / config.tileW);
    const tileGap = tileWidth * tileGapRatio;
    const groupGap = tileWidth * groupGapRatio;
    const totalWidth = visibleMelds.reduce(
      (sum, meld) => sum + tileWidth + Math.max(0, meld.tiles.length - 1) * tileGap,
      0,
    ) + Math.max(0, visibleMelds.length - 1) * groupGap;
    let cursor = -totalWidth / 2 + tileWidth / 2;
    visibleMelds.forEach((meld, meldIndex) => {
      meld.tiles.forEach((tile, tileIndex) => {
        const tileNode = this.createTile(area, `MeldTile${meldIndex}_${tileIndex}`, tile, new Vec3(cursor + tileIndex * tileGap, 0, 0), tileWidth, tileHeight);
        tileNode.active = true;
      });
      cursor += tileWidth + Math.max(0, meld.tiles.length - 1) * tileGap + groupGap;
    });
  }

  private presentStateAudio(view: PlayerGameView): void {
    const previous = this.lastAudioView;
    this.lastAudioView = view;
    if (!previous || previous.gameId !== view.gameId) return;

    planGameAudioCues(previous, view).forEach((cue) => {
      if (cue.kind === 'MELD') {
        const voiceKey = meldTypeToVoiceKey(cue.meldType);
        if (voiceKey) gameAudio.announceVoice([voiceKey], 'meld', 0.95, 'append');
        else gameAudio.play('meld', 0.62);
        return;
      }

      const voiceKey = tileToVoiceKey(cue.tile);
      if (voiceKey) gameAudio.announceVoice([voiceKey], 'tileDiscard', 0.9, 'append');
      else gameAudio.play('tileDiscard', 0.55);
    });
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
    handArea.setPosition(layout.pos(4, -36));
    this.setNodeAngle(handArea, 0);
    handArea.children.forEach((child) => {
      if (child.name.startsWith('SelfTile')) child.active = false;
    });

    const legal = new Set(legalDiscardTiles);
    const canDiscard = legalDiscardTiles.length > 0;
    const sorted = sortTiles(view.self.hand);
    const meldHint = this.meldHandHint(view);
    const roundKey = `${view.gameId}:${view.currentRound ?? view.roundIndex ?? 0}`;
    if (roundKey !== this.lastHandRoundKey) {
      this.lastHandRoundKey = roundKey;
      this.lastSelfHand = [];
      this.newDrawIndex = null;
    }
    // 自己回合手牌多了一张时，把新摸的那张标记为高亮；
    // 手牌结构变化（出牌/吃碰杠）后清除，摸牌后保持到本回合结束。
    const isSelfTurn = view.currentPlayer === view.playerIndex;
    if (isSelfTurn && sorted.length === this.lastSelfHand.length + 1) {
      this.newDrawIndex = findNewDrawIndex(this.lastSelfHand, sorted);
    } else if (sorted.length !== this.lastSelfHand.length) {
      this.newDrawIndex = null;
    }
    this.lastSelfHand = [...sorted];
    // 70x100 的牌面贴图在 w(7) 下会被放大渲染导致模糊，
    // 回退到接近原图分辨率的 w(5)（约 1:1 渲染，清晰且依然比最初大）。
    const tileW = layout.w(5);
    const tileH = tileW * 1.36;
    const gap = tileW * 0.72;
    sorted.forEach((tile, index) => {
      const isSelected = this.selectedHandIndex === index && this.lastTapTile === tile;
      const isMeldHint = meldHint.has(tile);
      const isNewDraw = this.newDrawIndex === index;
      const tilePosition = new Vec3((index - (sorted.length - 1) / 2) * gap, isSelected ? tileH * 0.28 : 0, 0);
      const node = this.createTile(handArea, `SelfTile${index}`, tile, tilePosition, tileW, tileH);
      node.active = true;
      if (isNewDraw) {
        const glow = createImage(handArea, `SelfTileGlow${index}`, 'textures/ui/tile_selected_glow', tileW * 1.42, tileH * 1.2, tilePosition);
        glow.active = true;
        // 光晕必须垫在对应牌面之下，否则新创建的节点会盖住牌面。
        const tileIndex = handArea.children.indexOf(node);
        (glow as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(Math.max(0, tileIndex - 1));
      }
      const tileSprite = ensureComponent(ensureChild(node, 'TileImage'), Sprite);
      tileSprite.color = isSelected
        ? new Color(255, 235, 145, 255)
        : isNewDraw
          ? new Color(165, 215, 255, 255)
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
      .filter((action) => action.type !== 'DISCARD' && action.type !== 'SELECT_KONG_TILE' && !RESPONSE_MELD_TYPES.has(action.type))
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

      const responseTile = winAction.tile ?? this.responseTile(view);
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

      // Keep self-turn kongs reachable next to the win prompt: a player who can
      // win must still be able to kong first (e.g. pong + chick -> added kong)
      // so the replacement draw can score 杠上花 instead of forcing a flat win.
      const selfKongActions = visibleActions.filter(
        (action) => action.type === 'KONG_CONCEALED' || action.type === 'KONG_ADDED',
      );
      const kongButtons: GameAction[] = selfKongActions.length === 1
        ? selfKongActions
        : selfKongActions.length > 1
          ? [{ type: 'KONG_CONCEALED', actionId: 107, extra: { openKongMenu: true } } as GameAction]
          : [];
      const promptActions = [
        ...visibleActions.filter((action) => action.type === 'WIN' || action.type === 'PASS'),
        ...kongButtons,
      ];
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
            if (submitting) return;
            gameAudio.play('button', 0.5);
            if ((action.extra as { openKongMenu?: boolean } | undefined)?.openKongMenu) {
              this.kongMenuOpen = true;
              this.render();
              return;
            }
            eventBus.emit(GameEvents.ACTION_SELECTED, action);
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

    const kongActions = visibleActions.filter((action) => action.type === 'KONG_CONCEALED' || action.type === 'KONG_ADDED');
    let renderedActions = visibleActions.filter((action) => !kongActions.includes(action));
    if (kongActions.length === 1) {
      renderedActions = [...renderedActions, ...kongActions];
    } else if (kongActions.length > 1) {
      renderedActions = [...renderedActions, {
        type: 'KONG_CONCEALED',
        actionId: 107,
        extra: { openKongMenu: true },
      } as GameAction];
    }

    renderedActions.forEach((action, index) => {
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
          if (submitting) return;
          gameAudio.play('button', 0.5);
          if ((action.extra as { openKongMenu?: boolean } | undefined)?.openKongMenu) {
            this.kongMenuOpen = true;
            this.render();
            return;
          }
          eventBus.emit(GameEvents.ACTION_SELECTED, action);
        },
        new Vec3((index - (renderedActions.length - 1) / 2) * width * 1.02, 0, 0),
        width,
        height,
      );
      button.active = true;
    });
  }

  private createMeldActionChoices(canvas: Node, layout: RuntimeLayout, actions: GameAction[], view: PlayerGameView, submitting: boolean): void {
    const choices = actions.filter((action) => MELD_ACTION_TYPES.has(action.type) && getActionPreviewTiles(action).length > 0);
    const layer = ensureChild(canvas, 'MeldActionChoices');
    // Concealed/added kongs are self-turn options that already have action buttons;
    // skip the big tile-preview panel so a frequently-passed kong never blocks the board.
    const hasResponseMeld = choices.some((action) => action.type !== 'KONG_CONCEALED' && action.type !== 'KONG_ADDED');
    if (choices.length === 0 || !hasResponseMeld) {
      layer.active = false;
      this.meldChoiceSignature = '';
      return;
    }
    layer.active = true;
    layer.setPosition(layout.pos(0, -7));
    layer.children.forEach((child) => {
      if (child.name.startsWith('MeldChoice_')) child.active = false;
    });

    const passAction = actions.find((action) => action.type === 'PASS');
    const visibleChoices = [...choices.slice(0, 4), ...(passAction ? [passAction] : [])];
    const panelWidth = layout.w(30);
    const panelHeight = (panelWidth / (1600 / 656)) * (visibleChoices.length > 4 ? 1.24 : 1);
    const optionWidth = panelWidth * 0.36;
    const optionHeight = panelHeight * 0.26;
    const oldFallback = layer.children.find((child) => child.name === 'MeldChoiceBg');
    if (oldFallback) oldFallback.active = false;
    const backdrop = createImage(layer, 'MeldChoiceBackdrop', 'textures/ui/action_background', panelWidth, panelHeight);
    (backdrop as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(0);
    this.createText(layer, 'MeldChoiceTitle', '选择牌型', new Vec3(0, panelHeight * 0.39, 0), layout.s(1.6), new Color(61, 52, 30, 255));

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
      const tileWidth = layout.w(1.6);
      const tileHeight = tileWidth * 1.36;
      const tileGap = tileWidth * 0.8;
      const label = action.type === 'PASS' ? ActionLabels.PASS : this.meldActionLabel(action.type);
      this.createText(option, 'ActionLabel', label, new Vec3(-optionWidth * 0.34, 0, 0), layout.s(1.6), new Color(255, 232, 153, 255));
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
    layer.setPosition(layout.pos(0, -4));
    layer.children.forEach((child) => {
      if (child.name.startsWith('KongChoice')) child.active = false;
    });

    const panelWidth = layout.w(30);
    const panelHeight = panelWidth / (1616 / 656);
    const choiceBackground = createImage(layer, 'ChoiceBg', 'textures/ui/kong_card_action_backgroud', panelWidth, panelHeight);
    (choiceBackground as Node & { setSiblingIndex?: (index: number) => void }).setSiblingIndex?.(0);
    const oldGlow = layer.children.find((child) => child.name === 'ChoiceGlow');
    if (oldGlow) oldGlow.active = false;
    this.createText(layer, 'ChoiceTitle', '选择杠后补牌', new Vec3(0, panelHeight * 0.4, 0), layout.s(1.55), new Color(61, 52, 30, 255));

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
      this.createText(choiceNode, 'TileName', getTileLabel(tile), new Vec3(0, -panelHeight * 0.34, 0), layout.s(1.2), new Color(235, 248, 217, 255));
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

  private createKongMenu(canvas: Node, layout: RuntimeLayout, view: PlayerGameView, submitting: boolean): void {
    const kongActions = view.legalActions.filter(
      (action) => action.type === 'KONG_CONCEALED' || action.type === 'KONG_ADDED',
    );
    const signature = kongActions.map((action) => `${action.type}:${action.tile}`).join('|');
    if (signature !== this.kongMenuSignature) {
      this.kongMenuSignature = signature;
      this.kongMenuOpen = false;
    }
    const layer = ensureChild(canvas, 'KongMenuLayer');
    layer.active = this.kongMenuOpen && kongActions.length > 1;
    if (!layer.active) return;

    // Same position and panel style as the win prompt.
    layer.setPosition(layout.pos(28, -17.5));
    const panelWidth = layout.w(26);
    const panelHeight = panelWidth / (640 / 260);
    createImage(layer, 'KongMenuBg', 'textures/ui/room_panel', panelWidth, panelHeight);
    this.createText(
      layer,
      'KongMenuTitle',
      '选择杠牌',
      new Vec3(0, panelHeight * 0.34, 0),
      layout.s(1.8),
      new Color(255, 236, 158, 255),
    );

    kongActions.slice(0, 4).forEach((action, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const option = createButton(
        layer,
        `KongMenuOption${index}`,
        `${action.type === 'KONG_CONCEALED' ? '暗杠' : '加杠'} ${getTileLabel(action.tile ?? 0)}`,
        () => {
          this.kongMenuOpen = false;
          if (!submitting) {
            gameAudio.play('button', 0.5);
            eventBus.emit(GameEvents.ACTION_SELECTED, action);
          }
        },
        new Vec3((column === 0 ? -1 : 1) * panelWidth * 0.23, panelHeight * (0.08 - row * 0.29), 0),
      );
      ensureComponent(option, UITransform).setContentSize(panelWidth * 0.42, panelHeight * 0.23);
      const label = option.children.find((child) => child.name === 'Label')?.getComponent(Label);
      if (label) {
        label.fontSize = layout.s(1.62) * TEXT_SCALE;
        label.lineHeight = label.fontSize * 1.15;
      }
      option.active = true;
    });

    const cancel = createButton(
      layer,
      'KongMenuCancel',
      '取消',
      () => {
        this.kongMenuOpen = false;
        this.render();
      },
      new Vec3(0, -panelHeight * 0.37, 0),
    );
    ensureComponent(cancel, UITransform).setContentSize(panelWidth * 0.3, panelHeight * 0.17);
    const cancelLabel = cancel.children.find((child) => child.name === 'Label')?.getComponent(Label);
    if (cancelLabel) {
      cancelLabel.fontSize = layout.s(1.4) * TEXT_SCALE;
      cancelLabel.lineHeight = cancelLabel.fontSize * 1.15;
    }
    cancel.active = true;
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
      new Vec3(0, dialogHeight * 0.395, 0),
      layout.s(2.25),
      new Color(255, 234, 164, 255),
    );
    this.createText(layer, 'RoundText', `第 ${view.currentRound ?? this.currentRound} / ${this.displayMaxRounds(view)} 局`, new Vec3(0, dialogHeight * 0.345, 0), layout.s(1.25), new Color(218, 244, 205, 255));

    ensureChild(layer, 'ResultTitle').getComponent(UITransform)?.setContentSize(dialogWidth * 0.58, dialogHeight * 0.075);
    ensureChild(layer, 'RoundText').getComponent(UITransform)?.setContentSize(dialogWidth * 0.3, dialogHeight * 0.055);
    this.createResultScores(layer, layout, view, result, dialogWidth, dialogHeight);
    this.createWinnerDetails(layer, layout, result, dialogWidth, dialogHeight);
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
    const rowYRatios = [0.218, 0.067, -0.085, -0.237];
    const avatarSize = dialogHeight * 0.115;
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
      this.createText(layer, `ScoreName${index}`, `${index}号  ${names[index] || '玩家'}`, new Vec3(-dialogWidth * 0.18, y, 0), layout.s(1.4));
      ensureChild(layer, `ScoreName${index}`).getComponent(UITransform)?.setContentSize(dialogWidth * 0.22, dialogHeight * 0.075);
      this.createText(layer, `ScoreDelta${index}`, `${delta >= 0 ? '+' : ''}${delta}`, new Vec3(dialogWidth * 0.075, y, 0), layout.s(1.65), delta >= 0 ? new Color(255, 229, 137, 255) : new Color(170, 230, 255, 255));
      ensureChild(layer, `ScoreDelta${index}`).getComponent(UITransform)?.setContentSize(dialogWidth * 0.12, dialogHeight * 0.075);
    }
  }

  private createWinnerDetails(
    layer: Node,
    layout: RuntimeLayout,
    result: ScoreResult | undefined,
    dialogWidth: number,
    dialogHeight: number,
  ): void {
    layer.children.forEach((child) => {
      if (
        child.name.startsWith('FanItem')
        || child.name.startsWith('WinnerTitle')
        || child.name.startsWith('WinnerTile')
        || child.name === 'WinnerHandPanel'
        || child.name === 'WinnerHandLabel'
        || child.name === 'FanEmptyText'
      ) {
        child.active = false;
      }
    });
    const columnX = dialogWidth * 0.312;
    const detailWidth = dialogWidth * 0.16;
    const winners = result?.winnerDetails?.filter((item) => item.winner >= 0) ?? [];
    this.createText(
      layer,
      'FanTitle',
      winners.length > 0 ? '番型' : '番型明细',
      new Vec3(columnX, dialogHeight * 0.245, 0),
      layout.s(1.55),
      new Color(255, 238, 170, 255),
    );
    ensureChild(layer, 'FanTitle').getComponent(UITransform)?.setContentSize(detailWidth, dialogHeight * 0.065);
    winners.slice(0, 2).forEach((winner, block) => {
      const blockTop = dialogHeight * (block === 0 ? 0.17 : -0.04);
      const sourceLabel = winner.source === 'ROB_KONG' ? '抢杠' : winner.source === 'SELF_DRAW' ? '自摸' : '点炮';
      this.createText(
        layer,
        `WinnerTitle${block}`,
        `${winner.winner + 1}号位 · ${sourceLabel}`,
        new Vec3(columnX, blockTop, 0),
        layout.s(1.45),
        new Color(255, 236, 158, 255),
      );
      ensureChild(layer, `WinnerTitle${block}`).getComponent(UITransform)?.setContentSize(detailWidth, dialogHeight * 0.06);
      ensureChild(layer, `WinnerTitle${block}`).active = true;
      if (winner.tile !== undefined) {
        this.createText(
          layer,
          `WinnerTileText${block}`,
          `进张 ${getTileLabel(winner.tile)}`,
          new Vec3(columnX, blockTop - dialogHeight * 0.052, 0),
          layout.s(1.3),
          new Color(231, 246, 214, 255),
        );
        ensureChild(layer, `WinnerTileText${block}`).getComponent(UITransform)?.setContentSize(detailWidth, dialogHeight * 0.052);
        ensureChild(layer, `WinnerTileText${block}`).active = true;
      }
      const fans = winner.fanItems.slice(0, 3);
      if (fans.length === 0) {
        this.createText(layer, `FanItemText${block}_0`, '暂无番型', new Vec3(columnX, blockTop - dialogHeight * 0.11, 0), layout.s(1.25), new Color(190, 213, 183, 255));
        ensureChild(layer, `FanItemText${block}_0`).getComponent(UITransform)?.setContentSize(detailWidth, dialogHeight * 0.05);
        ensureChild(layer, `FanItemText${block}_0`).active = true;
      } else {
        fans.forEach((item, index) => {
          this.createText(
            layer,
            `FanItemText${block}_${index}`,
            `${item.name}  ${item.points}分`,
            new Vec3(columnX, blockTop - dialogHeight * (0.11 + index * 0.052), 0),
            layout.s(1.3),
            new Color(225, 241, 211, 255),
          );
          ensureChild(layer, `FanItemText${block}_${index}`).getComponent(UITransform)?.setContentSize(detailWidth, dialogHeight * 0.05);
          ensureChild(layer, `FanItemText${block}_${index}`).active = true;
        });
      }
    });
    if (winners.length === 0) {
      this.createText(layer, 'FanEmptyText', '暂无番型', new Vec3(columnX, dialogHeight * 0.14, 0), layout.s(1.15), new Color(190, 213, 183, 255));
      ensureChild(layer, 'FanEmptyText').getComponent(UITransform)?.setContentSize(detailWidth, dialogHeight * 0.06);
      ensureChild(layer, 'FanEmptyText').active = true;
    }
    this.renderWinnerTilesAtBottom(layer, winners, dialogWidth, dialogHeight);
  }

  private renderWinnerTilesAtBottom(
    layer: Node,
    winners: Array<{ hand: number[]; melds?: Array<{ type: string; tiles: number[] }> }>,
    dialogWidth: number,
    dialogHeight: number,
  ): void {
    if (winners.length === 0) return;
    const rows = winners.slice(0, 2);
    const panelWidth = dialogWidth * 0.68;
    const panelHeight = dialogHeight * 0.16;
    const panelY = -dialogHeight * 0.545;
    const panel = createImage(layer, 'WinnerHandPanel', 'textures/ui/room_panel', panelWidth, panelHeight, new Vec3(0, panelY, 0));
    panel.active = true;
    this.createText(layer, 'WinnerHandLabel', rows.length > 1 ? '胡牌牌组' : '胡牌牌型', new Vec3(-panelWidth * 0.4, panelY, 0), dialogHeight * 0.032, new Color(255, 232, 151, 255));
    ensureChild(layer, 'WinnerHandLabel').getComponent(UITransform)?.setContentSize(panelWidth * 0.14, panelHeight * 0.55);
    ensureChild(layer, 'WinnerHandLabel').active = true;

    const tileW = dialogHeight * (rows.length === 1 ? 0.055 : 0.046);
    const tileH = tileW * 1.36;
    const gap = tileW * 0.72;
    const columns = rows.length === 1 ? 15 : 16;
    const tilesCenterX = panelWidth * 0.07;

    rows.forEach((winner, winnerIndex) => {
      const tiles = [
        ...winner.hand.slice(0, 14),
        ...(winner.melds ?? []).slice(0, 4).flatMap((meld) => meld.tiles.slice(0, 4)),
      ].slice(0, 28);
      const rowCount = Math.ceil(tiles.length / columns);
      const winnerCenterY = panelY + (rows.length === 1 ? 0 : winnerIndex === 0 ? panelHeight * 0.23 : -panelHeight * 0.23);
      tiles.forEach((tile, index) => {
        const gridRow = Math.floor(index / columns);
        const column = index % columns;
        const countInRow = Math.min(columns, tiles.length - gridRow * columns);
        const span = Math.max(0, countInRow - 1) * gap + tileW;
        const x = tilesCenterX - span / 2 + tileW / 2 + column * gap;
        const y = winnerCenterY + ((rowCount - 1) / 2 - gridRow) * tileH * 0.72;
        const node = this.createTile(layer, `WinnerTile${winnerIndex}_${index}`, tile, new Vec3(x, y, 0), tileW, tileH);
        node.active = true;
      });
    });
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

  private toggleBgm(): void {
    bgmManager.setMuted(!bgmManager.isMuted());
    const canvas = ensureCanvas(this.node);
    const node = canvas.children.find((child) => child.name === 'BgmToggleButton');
    if (node) setButtonImage(node, this.bgmIcon());
  }

  private bgmIcon(): string {
    return bgmManager.isMuted() ? 'textures/ui/icon_music_off' : 'textures/ui/icon_music_on';
  }

  private async exitGame(): Promise<void> {
    if (this.exiting) return;
    const confirmed = await showWechatConfirm(
      '退出对局',
      '确定退出当前对局吗？退出后将回到输入房间号页面，无人留守的房间会被解散。',
      '退出',
      '继续游戏',
    );
    if (!confirmed) return;
    this.exiting = true;
    const leaveRequest = roomManager.leaveRoom();
    roomManager.clearLocalRoom();
    this.stopGameRuntime();
    loadScene('RoomEntry');
    void leaveRequest.catch((err) => console.warn('[GameController] leave room failed after local exit', err));
  }

  private backToRoom(): void {
    if (this.exiting) return;
    this.exiting = true;
    this.stopGameRuntime();
    const resultLayer = ensureCanvas(this.node).children.find((child) => child.name === 'ResultDialogLayer');
    if (resultLayer) resultLayer.active = false;
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

  private stopGameRuntime(): void {
    eventBus.off(GameEvents.GAME_VIEW_CHANGED, this.render, this);
    eventBus.off(GameEvents.DISCARD_REQUESTED, this.handleDiscard, this);
    eventBus.off(GameEvents.ACTION_SELECTED, this.handleActionSelected, this);
    this.unschedule?.(this.updateTurnPulse);
    this.clearOpeningAnimationTimers();
    gameManager.leaveGame();
  }

  private async continueGame(): Promise<void> {
    this.currentRound = Math.min((gameManager.currentView?.currentRound ?? this.currentRound) + 1, this.maxRoundCount());
    this.resultVisible = false;
    this.selectedHandIndex = null;
    this.lastTapTile = null;
    gameManager.beginOpeningSequence();
    try {
      const gameId = await roomManager.startGame();
      // Rebind after the backend allocates the next game so a late snapshot
      // from the completed game cannot become the new opening baseline.
      gameManager.beginOpeningSequence(gameId);
      const room = roomManager.currentRoom;
      const roomId = room?.roomId || gameManager.currentView?.roomId || mockGameView.roomId;
      const subscribeRoomIds = [roomId, room?.internalRoomId].filter((id): id is string => Boolean(id));
      await this.enterGame(roomId, gameId, subscribeRoomIds);
    } catch (err) {
      gameManager.cancelOpeningSequence();
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
    // Only surface the discard tile when a response action actually claims it.
    // Self-draw wins (WIN without a tile) must not reuse a stale lastDiscard,
    // e.g. after a kong draw when the previous discard is still on screen.
    const claimsDiscard = view.legalActions.some(
      (action) => RESPONSE_ACTION_TYPES.has(action.type) && action.tile !== undefined,
    );
    return claimsDiscard ? view.lastDiscard.tile : null;
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
    label.fontSize = fontSize * TEXT_SCALE;
    label.lineHeight = label.fontSize * 1.15;
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
    names[view.playerIndex] = authManager.user?.nickname || view.self.nickname || '我';
    return names;
  }

  private playerAvatarUrls(view: PlayerGameView): string[] {
    const urls = ['', '', '', ''];
    urls[view.playerIndex] = authManager.user?.avatarUrl || (view.self as { avatarUrl?: string }).avatarUrl || '';
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
    if (position === 'bottom') return { width: layout.w(21), height: layout.w(21) / PLAYER_PANEL_RATIO_SELF, position: layout.pos(-39, -25) };
    if (position === 'right') return { width: layout.w(14), height: layout.w(14) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(35, 2) };
    if (position === 'top') return { width: layout.w(15), height: layout.w(15) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(0, 29) };
    return { width: layout.w(14), height: layout.w(14) / PLAYER_PANEL_RATIO_OTHER, position: layout.pos(-35, 2) };
  }

  private discardAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    const width = position === 'bottom' || position === 'top' ? layout.w(18.5) : layout.w(13);
    const height = width / DISCARD_AREA_RATIO;
    if (position === 'bottom') return { width, height, position: layout.pos(0, -18), tileW: layout.w(2.2), tileH: layout.w(3.0) };
    if (position === 'right') return { width, height, position: layout.pos(22, 3), tileW: layout.w(1.8), tileH: layout.w(2.45) };
    if (position === 'top') return { width, height, position: layout.pos(0, 14.5), tileW: layout.w(2.05), tileH: layout.w(2.8) };
    return { width, height, position: layout.pos(-22, 3), tileW: layout.w(1.8), tileH: layout.w(2.45) };
  }

  private meldAreaConfig(layout: RuntimeLayout, position: LocalSeatPosition) {
    const width = position === 'bottom' ? layout.w(21) : layout.w(16);
    const height = width / MELD_AREA_RATIO;
    if (position === 'bottom') return { width, height, position: layout.pos(-16, -27), tileW: layout.w(2.4), tileH: layout.w(3.25) };
    if (position === 'right') return { width, height, position: layout.pos(29.5, -8), tileW: layout.w(1.8), tileH: layout.w(2.45) };
    if (position === 'top') return { width, height, position: layout.pos(-19, 23), tileW: layout.w(1.85), tileH: layout.w(2.5) };
    return { width, height, position: layout.pos(-29.5, -8), tileW: layout.w(1.8), tileH: layout.w(2.45) };
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
            position: layout.pos(4, -36),
            tileW: layout.w(5.0),
            tileH: layout.w(5.0) * 1.36,
            gap: layout.w(5.0) * 0.8,
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
    this.scheduleOpeningAnimationStep(token, OPENING_INTERACTION_LOCK_MS, () => {
      ['bottom', 'right', 'top', 'left'].forEach((position) => {
        const original = canvas.children.find((child) => child.name === (
          position === 'bottom' ? 'SelfHandArea' : `HandCount_${position}`
        ));
        if (original) original.active = true;
      });
      layer.active = false;
      gameManager.finishOpeningSequence(view.gameId);
    });
  }

  private hideOpeningInteractions(canvas: Node): void {
    ['ActionPanel', 'MeldActionChoices', 'KongTileChoice', 'KongMenu', 'ResponseHint'].forEach((name) => {
      const node = canvas.children.find((child) => child.name === name);
      if (node) node.active = false;
    });
    canvas.children.forEach((node) => {
      if (node.name.startsWith('Discard_') || node.name.startsWith('Meld_')) node.active = false;
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
