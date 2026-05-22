import { getTileImage, getTileLabel } from '../../utils/tile-utils';
import type { GameAction, PlayerGameView, PlayerPublicView } from '../../types/game.types';
import type { TileId } from '../../types/tile.types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  tile: TileId;
  legal: boolean;
}

interface Point {
  x: number;
  y: number;
}

Component({
  properties: {
    view: { type: Object },
    legalDiscardTiles: { type: Array, value: [] },
    selectedTile: { type: Number, value: -1 },
    submitting: { type: Boolean, value: false },
  },
  data: {
    canvasWidth: 0,
    canvasHeight: 0,
  },
  lifetimes: {
    attached() {
      const info = wx.getSystemInfoSync();
      this.setData(
        {
          canvasWidth: info.windowWidth,
          canvasHeight: info.windowHeight,
        },
        () => this.drawTable(),
      );
    },
  },
  observers: {
    'view, legalDiscardTiles, selectedTile, submitting'() {
      this.drawTableSoon();
    },
  },
  methods: {
    drawTableSoon() {
      setTimeout(() => this.drawTable(), 0);
    },

    drawTable() {
      const view = this.properties.view as PlayerGameView | undefined;
      const width = this.data.canvasWidth;
      const height = this.data.canvasHeight;
      if (!view || !width || !height) return;

      const ctx = wx.createCanvasContext('gameTableCanvas', this);
      const legalTiles = new Set((this.properties.legalDiscardTiles as TileId[]) || []);
      const selectedTile = this.properties.selectedTile as TileId;
      const handRects: Rect[] = [];
      (this as unknown as { handRects: Rect[] }).handRects = handRects;

      this.drawBackground(ctx, width, height);
      this.drawTopBar(ctx, view);
      this.drawTableSurface(ctx, width, height);
      this.drawCenter(ctx, view, width, height);
      this.drawOpponents(ctx, view, width, height);
      this.drawDiscards(ctx, view, width, height);
      this.drawSelfHud(ctx, view, height);
      this.drawHand(ctx, view.self.hand, legalTiles, selectedTile, width, height, handRects);

      ctx.draw(false);
    },

    drawBackground(ctx: WechatMiniprogram.CanvasContext, width: number, height: number) {
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#0b5264');
      bg.addColorStop(0.46, '#12919b');
      bg.addColorStop(1, '#062b43');
      ctx.setFillStyle(bg);
      ctx.fillRect(0, 0, width, height);

      ctx.setFillStyle('rgba(0, 0, 0, 0.22)');
      ctx.fillRect(0, 0, 58, height);
      ctx.fillRect(width - 58, 0, 58, height);
      ctx.setStrokeStyle('rgba(231, 190, 79, 0.42)');
      ctx.setLineWidth(2);
      ctx.beginPath();
      ctx.moveTo(58, 0);
      ctx.lineTo(112, height);
      ctx.moveTo(width - 58, 0);
      ctx.lineTo(width - 112, height);
      ctx.stroke();
    },

    drawTopBar(ctx: WechatMiniprogram.CanvasContext, view: PlayerGameView) {
      this.roundRect(ctx, 12, 10, 226, 34, 17, 'rgba(3, 29, 36, 0.72)');
      ctx.setFillStyle('#f8edc8');
      ctx.setFontSize(15);
      ctx.setTextBaseline('middle');
      ctx.fillText(`第 ${view.stepIndex} 手`, 28, 27);
      ctx.fillText(`余牌 ${view.wallTilesRemaining}`, 102, 27);
      ctx.fillText(view.xiaoJiActiveAsWild ? '小鸡万能' : '小鸡1条', 168, 27);
    },

    drawTableSurface(ctx: WechatMiniprogram.CanvasContext, width: number, height: number) {
      const x = width * 0.18;
      const y = height * 0.13;
      const w = width * 0.64;
      const h = height * 0.58;
      this.roundRect(ctx, x, y, w, h, 18, 'rgba(2, 56, 73, 0.46)', 'rgba(248, 237, 200, 0.18)');
      this.roundRect(ctx, x + 22, y + 22, w - 44, h - 44, 14, 'rgba(0,0,0,0)', 'rgba(248, 237, 200, 0.13)');
      ctx.setFillStyle('rgba(2, 30, 40, 0.14)');
      ctx.fillRect(x + w * 0.18, y + 18, w * 0.64, 4);
      ctx.fillRect(x + w * 0.18, y + h - 22, w * 0.64, 4);
      ctx.fillRect(x + 18, y + h * 0.22, 4, h * 0.56);
      ctx.fillRect(x + w - 22, y + h * 0.22, 4, h * 0.56);
    },

    drawCenter(ctx: WechatMiniprogram.CanvasContext, view: PlayerGameView, width: number, height: number) {
      const cx = width / 2;
      const cy = height * 0.42;
      ctx.beginPath();
      ctx.arc(cx, cy, 62, 0, Math.PI * 2);
      ctx.setFillStyle('rgba(4, 25, 37, 0.88)');
      ctx.fill();
      ctx.setLineWidth(5);
      ctx.setStrokeStyle('rgba(217, 164, 65, 0.86)');
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.setFillStyle('#1c9ed0');
      ctx.fill();
      ctx.setFillStyle('#eaf8ff');
      ctx.setFontSize(29);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(String(view.currentPlayer), cx, cy);

      ctx.setFontSize(12);
      ctx.setFillStyle('rgba(249, 237, 208, 0.82)');
      ctx.fillText(`庄 ${view.dealer}  牌山 ${view.wallTilesRemaining}`, cx, cy + 50);

      const kongX = cx - (view.publicKongTiles.length * 28) / 2;
      ctx.setFontSize(12);
      ctx.fillText('公开杠牌', cx, cy - 66);
      view.publicKongTiles.forEach((tile, index) => this.drawTile(ctx, tile, kongX + index * 32, cy - 56, 25, 36));
      ctx.setTextAlign('left');
    },

    drawOpponents(ctx: WechatMiniprogram.CanvasContext, view: PlayerGameView, width: number, height: number) {
      view.opponents.forEach((player) => {
        const relative = ((player.seatIndex - view.playerIndex) + 4) % 4;
        if (relative === 2) this.drawTopOpponent(ctx, player, view, width);
        if (relative === 3) this.drawSideOpponent(ctx, player, view, 28, height * 0.27, 'left');
        if (relative === 1) this.drawSideOpponent(ctx, player, view, width - 52, height * 0.27, 'right');
      });
    },

    drawTopOpponent(ctx: WechatMiniprogram.CanvasContext, player: PlayerPublicView, view: PlayerGameView, width: number) {
      const x = width / 2 - 115;
      const y = 18;
      this.drawPlayerPill(ctx, x - 150, y + 6, player, view.currentPlayer === player.seatIndex, view.dealer === player.seatIndex);
      for (let i = 0; i < Math.min(player.handCount, 13); i += 1) {
        this.drawTileBack(ctx, x + i * 17, y, 25, 36);
      }
      this.drawMelds(ctx, player.melds?.flatMap((meld) => meld.tiles) || [], x, y + 42, 24, 34);
    },

    drawSideOpponent(
      ctx: WechatMiniprogram.CanvasContext,
      player: PlayerPublicView,
      view: PlayerGameView,
      x: number,
      y: number,
      side: 'left' | 'right',
    ) {
      const pillX = side === 'left' ? x + 12 : x - 126;
      this.drawPlayerPill(ctx, pillX, y - 50, player, view.currentPlayer === player.seatIndex, view.dealer === player.seatIndex);
      const max = Math.min(player.handCount, 13);
      for (let i = 0; i < max; i += 1) {
        this.drawTileBack(ctx, x, y + i * 15, 25, 36);
      }
      const meldTiles = player.melds?.flatMap((meld) => meld.tiles) || [];
      this.drawMelds(ctx, meldTiles, side === 'left' ? x + 36 : x - 34, y + 8, 22, 31, true);
    },

    drawPlayerPill(
      ctx: WechatMiniprogram.CanvasContext,
      x: number,
      y: number,
      player: PlayerPublicView,
      active: boolean,
      dealer: boolean,
    ) {
      this.roundRect(ctx, x, y, 128, 34, 17, active ? 'rgba(10, 57, 64, 0.9)' : 'rgba(4, 30, 35, 0.68)');
      ctx.beginPath();
      ctx.arc(x + 18, y + 17, 14, 0, Math.PI * 2);
      ctx.setFillStyle('#b7d7d3');
      ctx.fill();
      ctx.setFillStyle('#12372a');
      ctx.setFontSize(10);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(player.isAI ? 'AI' : String(player.seatIndex), x + 18, y + 17);
      ctx.setTextAlign('left');
      ctx.setFillStyle('#f9edd0');
      ctx.setFontSize(13);
      ctx.fillText(player.nickname || `座位 ${player.seatIndex}`, x + 38, y + 13);
      ctx.setFillStyle('rgba(249, 237, 208, 0.76)');
      ctx.setFontSize(10);
      ctx.fillText(`${player.handCount} 张`, x + 38, y + 26);
      if (dealer) {
        ctx.beginPath();
        ctx.arc(x + 118, y + 6, 12, 0, Math.PI * 2);
        ctx.setFillStyle('#d9a441');
        ctx.fill();
        ctx.setFillStyle('#fff6d7');
        ctx.setFontSize(12);
        ctx.setTextAlign('center');
        ctx.fillText('庄', x + 118, y + 6);
        ctx.setTextAlign('left');
      }
    },

    drawDiscards(ctx: WechatMiniprogram.CanvasContext, view: PlayerGameView, width: number, height: number) {
      const centerX = width / 2;
      const centerY = height * 0.43;
      this.drawMelds(ctx, view.self.discards.slice(-8), centerX - 138, centerY + 76, 24, 34);
      view.opponents.forEach((player) => {
        const relative = ((player.seatIndex - view.playerIndex) + 4) % 4;
        if (relative === 2) this.drawMelds(ctx, player.discards.slice(-8), centerX - 96, centerY - 116, 23, 32);
        if (relative === 3) this.drawMelds(ctx, player.discards.slice(-6), centerX - 190, centerY - 60, 22, 31, true);
        if (relative === 1) this.drawMelds(ctx, player.discards.slice(-6), centerX + 168, centerY - 60, 22, 31, true);
      });
    },

    drawSelfHud(ctx: WechatMiniprogram.CanvasContext, view: PlayerGameView, height: number) {
      this.roundRect(ctx, 18, height - 78, 78, 50, 25, 'rgba(4, 30, 35, 0.72)');
      ctx.beginPath();
      ctx.arc(43, height - 53, 18, 0, Math.PI * 2);
      ctx.setFillStyle('#d9a441');
      ctx.fill();
      ctx.setFillStyle('#12372a');
      ctx.setFontSize(13);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText('我', 43, height - 53);
      ctx.setTextAlign('left');
      ctx.setFillStyle('#f9edd0');
      ctx.setFontSize(11);
      ctx.fillText(`座位 ${view.playerIndex}`, 66, height - 58);
      ctx.fillText(`${view.scores[view.playerIndex]} 分`, 66, height - 42);
    },

    drawHand(
      ctx: WechatMiniprogram.CanvasContext,
      hand: TileId[],
      legalTiles: Set<TileId>,
      selectedTile: TileId,
      width: number,
      height: number,
      handRects: Rect[],
    ) {
      const gap = 4;
      const maxTileWidth = 42;
      const available = width - 132;
      const tileW = Math.min(maxTileWidth, Math.floor((available - gap * (hand.length - 1)) / Math.max(hand.length, 1)));
      const tileH = Math.floor(tileW * 1.44);
      const totalW = hand.length * tileW + (hand.length - 1) * gap;
      const startX = Math.max(108, (width - totalW) / 2);
      const y = height - tileH - 8;

      hand.forEach((tile, index) => {
        const x = startX + index * (tileW + gap);
        const legal = legalTiles.has(tile);
        const selected = selectedTile === tile;
        const drawY = selected ? y - 10 : y;
        handRects.push({ x, y: drawY, w: tileW, h: tileH, tile, legal });
        ctx.setGlobalAlpha(legal ? 1 : 0.45);
        this.drawTile(ctx, tile, x, drawY, tileW, tileH);
        ctx.setGlobalAlpha(1);
        if (selected) {
          this.roundRect(ctx, x - 2, drawY - 2, tileW + 4, tileH + 4, 6, 'rgba(0,0,0,0)', '#f7d76d');
        }
      });
    },

    drawMelds(
      ctx: WechatMiniprogram.CanvasContext,
      tiles: TileId[],
      x: number,
      y: number,
      tileW: number,
      tileH: number,
      vertical = false,
    ) {
      tiles.forEach((tile, index) => {
        const dx = vertical ? x : x + index * (tileW + 4);
        const dy = vertical ? y + index * Math.floor(tileH * 0.72) : y;
        this.drawTile(ctx, tile, dx, dy, tileW, tileH);
      });
    },

    drawTile(ctx: WechatMiniprogram.CanvasContext, tile: TileId, x: number, y: number, w: number, h: number) {
      this.roundRect(ctx, x, y, w, h, 5, '#fffaf0', 'rgba(91, 72, 42, 0.36)');
      ctx.drawImage(getTileImage(tile), x + 3, y + 3, w - 6, h - 6);
      if (tile === 18) {
        this.roundRect(ctx, x + w - 17, y + h - 10, 16, 9, 3, 'rgba(255, 246, 218, 0.92)');
        ctx.setFillStyle('#b36b16');
        ctx.setFontSize(7);
        ctx.fillText('小鸡', x + w - 16, y + h - 5);
      }
    },

    drawTileBack(ctx: WechatMiniprogram.CanvasContext, x: number, y: number, w: number, h: number) {
      this.roundRect(ctx, x, y, w, h, 5, '#23605b', 'rgba(23, 69, 65, 0.9)');
      ctx.drawImage('/assets/tiles/tile_back.png', x + 3, y + 3, w - 6, h - 6);
    },

    roundRect(
      ctx: WechatMiniprogram.CanvasContext,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill?: string,
      stroke?: string,
    ) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (fill && fill !== 'rgba(0,0,0,0)') {
        ctx.setFillStyle(fill);
        ctx.fill();
      }
      if (stroke) {
        ctx.setStrokeStyle(stroke);
        ctx.setLineWidth(1);
        ctx.stroke();
      }
    },

    onCanvasTap(event: WechatMiniprogram.CustomEvent<Point>) {
      const detail = event.detail;
      const handRects = ((this as unknown as { handRects?: Rect[] }).handRects || []) as Rect[];
      const hit = handRects.find((rect) => {
        return detail.x >= rect.x && detail.x <= rect.x + rect.w && detail.y >= rect.y && detail.y <= rect.y + rect.h;
      });
      if (!hit) return;
      if (!hit.legal) {
        wx.showToast({ title: `${getTileLabel(hit.tile)} 当前不能出`, icon: 'none' });
        return;
      }
      this.triggerEvent('selectTile', { tile: hit.tile });
    },

    onSubmitAction(event: WechatMiniprogram.CustomEvent<{ action: GameAction }>) {
      this.triggerEvent('submitAction', event.detail);
    },
  },
});
