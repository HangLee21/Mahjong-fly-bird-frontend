Component({
  properties: {
    tiles: { type: Array, value: [] },
    legalTiles: { type: Array, value: [] },
    selectedTile: { type: Number, value: -1 },
    disabled: { type: Boolean, value: false },
  },
  data: {
    displayTiles: [] as Array<{ id: number; legal: boolean; selected: boolean }>,
  },
  observers: {
    'tiles, legalTiles, selectedTile'(tiles: number[], legalTiles: number[], selectedTile: number | null) {
      this.setData({
        displayTiles: (tiles || []).map((id) => ({
          id,
          legal: (legalTiles || []).includes(id),
          selected: selectedTile === id,
        })),
      });
    },
  },
  methods: {
    onTapTile(event: WechatMiniprogram.CustomEvent<{ tile: number }>) {
      this.triggerEvent('selectTile', event.detail);
    },
  },
});
