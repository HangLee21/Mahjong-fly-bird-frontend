import { getTileImage, getTileLabel } from '../../utils/tile-utils';
import type { GameAction, PlayerGameView, PlayerPublicView } from '../../types/game.types';
import type { TileId } from '../../types/tile.types';

type CanvasNode = WechatMiniprogram.Canvas & {
  createImage: () => { src: string; onload?: () => void; onerror?: () => void };
};
type Canvas2DContext = Record<string, any>;

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

interface TableMetrics {
  width: number;
  height: number;
  safeTop: number;
  handTileW: number;
  handTileH: number;
}

Component({
  properties: {
    view: { type: Object },
    legalDiscardTiles: { type: Array, value: [] },
    selectedTile: { type: Number, value: -1 },
    submitting: { type: Boolean, value: false },
  },
  lifetimes: {
    ready() {
      this.initCanvas();
    },
    detached() {
      const state = this as unknown as { resizeTimer?: number };
      if (state.resizeTimer) clearTimeout(state.resizeTimer);
    },
  },
  observers: {
    'view, legalDiscardTiles, selectedTile, submitting'() {
      this.drawTableSoon();
    },
  },
  methods: {
    initCanvas() {
      wx.createSelectorQuery()
        .in(this)
        .select('#gameTableCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const result = res?.[0] as { node?: CanvasNode; width?: number; height?: number } | undefined;
          if (!result?.node || !result.width || !result.height) return;
          const dpr = wx.getSystemInfoSync().pixelRatio || 1;
          const canvas = result.node;
          canvas.width = Math.floor(result.width * dpr);
          canvas.height = Math.floor(result.height * dpr);
          const ctx = canvas.getContext('2d') as Canvas2DContext;
          ctx.scale(dpr, dpr);
          Object.assign(this, {
            canvas,
            ctx,
            canvasWidth: result.width,
            canvasHeight: result.height,
            imageCache: new Map<string, unknown>(),
            handRects: [],
          });
          this.drawTable();
        });
    },

    drawTableSoon() {
      setTimeout(() => {
        const state = this as unknown as { ctx?: Canvas2DContext };
        if (!state.ctx) this.initCanvas();
        else this.drawTable();
      }, 0);
    },

    getMetrics(): TableMetrics | null {
      const state = this as unknown as { canvasWidth?: number; canvasHeight?: number };
      if (!state.canvasWidth || !state.canvasHeight) return null;
      const width = state.canvasWidth;
      const height = state.canvasHeight;
      const handTileH = Math.max(44, Math.min(72, height * 0.18));
      return {
        width,
        height,
        safeTop: 8,
        handTileH,
        handTileW: handTileH * 0.7,
      };
    },

    drawTable() {
      const state = this as unknown as { ctx?: Canvas2DContext; handRects?: Rect[] };
      const ctx = state.ctx;
      const view = this.properties.view as PlayerGameView | undefined;
      const metrics = this.getMetrics();
      if (!ctx || !view || !metrics) return;

      const legalTiles = new Set((this.properties.legalDiscardTiles as TileId[]) || []);
      const selectedTile = this.properties.selectedTile as TileId;
      const handRects: Rect[] = [];
      state.handRects = handRects;

      ctx.clearRect(0, 0, metrics.width, metrics.height);
      this.drawBackground(ctx, metrics);
      this.drawTableSurface(ctx, metrics);
      this.drawCenter(ctx, view, metrics);
      this.drawOpponents(ctx, view, metrics);
      this.drawDiscards(ctx, view, metrics);
      this.drawTopBar(ctx, view, metrics);
      this.drawSelfHud(ctx, view, metrics);
      this.drawHand(ctx, view.self.hand, legalTiles, selectedTile, metrics, handRects);
    },

    drawBackground(ctx: Canvas2DContext, metrics: TableMetrics) {
      const { width, height } = metrics;
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#0a4258');
      bg.addColorStop(0.48, '#1397a5');
      bg.addColorStop(1, '#06263c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width * 0.1, 0);
      ctx.lineTo(width * 0.15, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(width * 0.9, 0);
      ctx.lineTo(width * 0.85, height);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(217,164,65,0.38)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, 0);
      ctx.lineTo(width * 0.15, height);
      ctx.moveTo(width * 0.9, 0);
      ctx.lineTo(width * 0.85, height);
      ctx.stroke();
    },

    drawTableSurface(ctx: Canvas2DContext, metrics: TableMetrics) {
      const { width, height } = metrics;
      const x = width * 0.18;
      const y = height * 0.12;
      const w = width * 0.64;
      const h = height * 0.58;
      this.roundRect(ctx, x, y, w, h, 18, 'rgba(3,62,80,0.48)', 'rgba(245,226,164,0.2)');
      this.roundRect(ctx, x + 22, y + 18, w - 44, h - 36, 14, 'rgba(0,0,0,0)', 'rgba(245,226,164,0.14)');
      ctx.fillStyle = 'rgba(4,32,44,0.18)';
      ctx.fillRect(x + w * 0.18, y + 20, w * 0.64, 3);
      ctx.fillRect(x + w * 0.18, y + h - 23, w * 0.64, 3);
      ctx.fillRect(x + 20, y + h * 0.24, 3, h * 0.52);
      ctx.fillRect(x + w - 23, y + h * 0.24, 3, h * 0.52);
    },

    drawTopBar(ctx: Canvas2DContext, view: PlayerGameView, metrics: TableMetrics) {
      const text = `第 ${view.stepIndex} 手   余牌 ${view.wallTilesRemaining}   ${view.xiaoJiActiveAsWild ? '小鸡万能' : '小鸡1条'}`;
      this.roundRect(ctx, 12, 10, 220, 30, 15, 'rgba(4,30,35,0.72)');
      ctx.fillStyle = '#f8edc8';
      ctx.font = '700 14px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(text, 24, 25);
    },

    drawCenter(ctx: Canvas2DContext, view: PlayerGameView, metrics: TableMetrics) {
      const cx = metrics.width / 2;
      const cy = metrics.height * 0.42;
      const outerR = Math.min(metrics.height * 0.18, 62);
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(4,25,37,0.9)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(217,164,65,0.9)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, outerR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#1c9ed0';
      ctx.fill();
      ctx.fillStyle = '#eaf8ff';
      ctx.font = '800 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(view.currentPlayer), cx, cy);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(249,237,208,0.84)';
      ctx.fillText(`庄 ${view.dealer}  牌山 ${view.wallTilesRemaining}`, cx, cy + outerR * 0.82);
      ctx.fillText('公开杠牌', cx, cy - outerR - 12);
      const start = cx - (view.publicKongTiles.length * 28) / 2;
      view.publicKongTiles.forEach((tile, index) => this.drawTile(ctx, tile, start + index * 32, cy - outerR - 4, 25, 36));
    },

    drawOpponents(ctx: Canvas2DContext, view: PlayerGameView, metrics: TableMetrics) {
      view.opponents.forEach((player) => {
        const relative = ((player.seatIndex - view.playerIndex) + 4) % 4;
        if (relative === 2) this.drawTopOpponent(ctx, player, view, metrics);
        if (relative === 3) this.drawSideOpponent(ctx, player, view, metrics, 'left');
        if (relative === 1) this.drawSideOpponent(ctx, player, view, metrics, 'right');
      });
    },

    drawTopOpponent(ctx: Canvas2DContext, player: PlayerPublicView, view: PlayerGameView, metrics: TableMetrics) {
      const tileW = 25;
      const tileH = 36;
      const count = Math.min(player.handCount, 13);
      const x = metrics.width / 2 - (count * 17 + tileW) / 2;
      const y = 14;
      this.drawPlayerPill(ctx, x - 138, y + 4, player, view.currentPlayer === player.seatIndex, view.dealer === player.seatIndex);
      for (let i = 0; i < count; i += 1) this.drawTileBack(ctx, x + i * 17, y, tileW, tileH);
      this.drawTiles(ctx, player.melds?.flatMap((meld) => meld.tiles) || [], x, y + 42, 24, 34);
    },

    drawSideOpponent(ctx: Canvas2DContext, player: PlayerPublicView, view: PlayerGameView, metrics: TableMetrics, side: 'left' | 'right') {
      const x = side === 'left' ? metrics.width * 0.08 : metrics.width * 0.92 - 25;
      const y = metrics.height * 0.22;
      this.drawPlayerPill(
        ctx,
        side === 'left' ? x + 34 : x - 126,
        y - 46,
        player,
        view.currentPlayer === player.seatIndex,
        view.dealer === player.seatIndex,
      );
      const count = Math.min(player.handCount, 13);
      for (let i = 0; i < count; i += 1) this.drawTileBack(ctx, x, y + i * 14, 25, 36);
      this.drawTiles(ctx, player.melds?.flatMap((meld) => meld.tiles) || [], side === 'left' ? x + 34 : x - 34, y + 8, 22, 31, true);
    },

    drawDiscards(ctx: Canvas2DContext, view: PlayerGameView, metrics: TableMetrics) {
      const cx = metrics.width / 2;
      const cy = metrics.height * 0.42;
      this.drawTiles(ctx, view.self.discards.slice(-8), cx - 136, cy + 76, 24, 34);
      view.opponents.forEach((player) => {
        const relative = ((player.seatIndex - view.playerIndex) + 4) % 4;
        if (relative === 2) this.drawTiles(ctx, player.discards.slice(-8), cx - 96, cy - 118, 23, 32);
        if (relative === 3) this.drawTiles(ctx, player.discards.slice(-6), cx - 190, cy - 58, 22, 31, true);
        if (relative === 1) this.drawTiles(ctx, player.discards.slice(-6), cx + 168, cy - 58, 22, 31, true);
      });
    },

    drawSelfHud(ctx: Canvas2DContext, view: PlayerGameView, metrics: TableMetrics) {
      const y = metrics.height - 62;
      this.roundRect(ctx, 16, y, 78, 48, 24, 'rgba(4,30,35,0.72)');
      ctx.beginPath();
      ctx.arc(40, y + 24, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#d9a441';
      ctx.fill();
      ctx.fillStyle = '#12372a';
      ctx.font = '800 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('我', 40, y + 24);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f9edd0';
      ctx.font = '11px sans-serif';
      ctx.fillText(`座位 ${view.playerIndex}`, 62, y + 19);
      ctx.fillText(`${view.scores[view.playerIndex]} 分`, 62, y + 34);
    },

    drawHand(
      ctx: Canvas2DContext,
      hand: TileId[],
      legalTiles: Set<TileId>,
      selectedTile: TileId,
      metrics: TableMetrics,
      handRects: Rect[],
    ) {
      const gap = 4;
      const available = metrics.width - 132;
      const tileW = Math.min(metrics.handTileW, Math.floor((available - gap * Math.max(hand.length - 1, 0)) / Math.max(hand.length, 1)));
      const tileH = tileW * 1.44;
      const total = hand.length * tileW + Math.max(hand.length - 1, 0) * gap;
      const startX = Math.max(104, (metrics.width - total) / 2);
      const y = metrics.height - tileH - 8;
      hand.forEach((tile, index) => {
        const x = startX + index * (tileW + gap);
        const selected = selectedTile === tile;
        const legal = legalTiles.has(tile);
        const drawY = selected ? y - 10 : y;
        handRects.push({ x, y: drawY, w: tileW, h: tileH, tile, legal });
        ctx.globalAlpha = legal ? 1 : 0.45;
        this.drawTile(ctx, tile, x, drawY, tileW, tileH);
        ctx.globalAlpha = 1;
        if (selected) this.roundRect(ctx, x - 2, drawY - 2, tileW + 4, tileH + 4, 6, 'rgba(0,0,0,0)', '#f7d76d');
      });
    },

    drawPlayerPill(ctx: Canvas2DContext, x: number, y: number, player: PlayerPublicView, active: boolean, dealer: boolean) {
      this.roundRect(ctx, x, y, 126, 32, 16, active ? 'rgba(8,67,74,0.9)' : 'rgba(4,30,35,0.68)');
      ctx.beginPath();
      ctx.arc(x + 17, y + 16, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#b7d7d3';
      ctx.fill();
      ctx.fillStyle = '#12372a';
      ctx.font = '800 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.isAI ? 'AI' : String(player.seatIndex), x + 17, y + 16);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f9edd0';
      ctx.font = '700 12px sans-serif';
      ctx.fillText(player.nickname || `座位 ${player.seatIndex}`, x + 36, y + 13);
      ctx.fillStyle = 'rgba(249,237,208,0.76)';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${player.handCount} 张`, x + 36, y + 25);
      if (dealer) {
        ctx.beginPath();
        ctx.arc(x + 116, y + 7, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#d9a441';
        ctx.fill();
        ctx.fillStyle = '#fff6d7';
        ctx.font = '800 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('庄', x + 116, y + 7);
        ctx.textAlign = 'left';
      }
    },

    drawTiles(ctx: Canvas2DContext, tiles: TileId[], x: number, y: number, tileW: number, tileH: number, vertical = false) {
      tiles.forEach((tile, index) => {
        this.drawTile(ctx, tile, vertical ? x : x + index * (tileW + 4), vertical ? y + index * Math.floor(tileH * 0.72) : y, tileW, tileH);
      });
    },

    drawTile(ctx: Canvas2DContext, tile: TileId, x: number, y: number, w: number, h: number) {
      this.roundRect(ctx, x, y, w, h, 5, '#fffaf0', 'rgba(91,72,42,0.36)');
      const img = this.getImage(getTileImage(tile));
      if (img) ctx.drawImage(img, x + 3, y + 3, w - 6, h - 6);
      else this.drawTileFallback(ctx, tile, x, y, w, h);
      if (tile === 18) {
        this.roundRect(ctx, x + w - 18, y + h - 10, 17, 9, 3, 'rgba(255,246,218,0.92)');
        ctx.fillStyle = '#b36b16';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('小鸡', x + w - 17, y + h - 4);
      }
    },

    drawTileFallback(ctx: Canvas2DContext, tile: TileId, x: number, y: number, w: number, h: number) {
      ctx.fillStyle = '#17231d';
      ctx.font = `700 ${Math.max(10, w * 0.34)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(getTileLabel(tile), x + w / 2, y + h / 2);
    },

    drawTileBack(ctx: Canvas2DContext, x: number, y: number, w: number, h: number) {
      this.roundRect(ctx, x, y, w, h, 5, '#23605b', 'rgba(23,69,65,0.9)');
      const img = this.getImage('/assets/tiles/tile_back.png');
      if (img) ctx.drawImage(img, x + 3, y + 3, w - 6, h - 6);
    },

    getImage(src: string): unknown | null {
      const state = this as unknown as {
        canvas?: CanvasNode;
        imageCache?: Map<string, unknown>;
        loadingImages?: Set<string>;
      };
      if (!state.canvas) return null;
      if (!state.imageCache) state.imageCache = new Map<string, unknown>();
      if (!state.loadingImages) state.loadingImages = new Set<string>();
      const cached = state.imageCache.get(src);
      if (cached) return cached;
      if (state.loadingImages.has(src)) return null;
      state.loadingImages.add(src);
      const image = state.canvas.createImage();
      image.onload = () => {
        state.imageCache?.set(src, image);
        state.loadingImages?.delete(src);
        this.drawTableSoon();
      };
      image.onerror = () => state.loadingImages?.delete(src);
      image.src = src;
      return null;
    },

    roundRect(ctx: Canvas2DContext, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (fill && fill !== 'rgba(0,0,0,0)') {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },

    onCanvasTap(event: WechatMiniprogram.CustomEvent<Point>) {
      const detail = event.detail;
      const handRects = ((this as unknown as { handRects?: Rect[] }).handRects || []) as Rect[];
      const hit = handRects.find((rect) => detail.x >= rect.x && detail.x <= rect.x + rect.w && detail.y >= rect.y && detail.y <= rect.y + rect.h);
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
