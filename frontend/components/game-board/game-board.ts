Component({
  properties: {
    view: { type: Object },
    legalDiscardTiles: { type: Array, value: [] },
    selectedTile: { type: Number, value: -1 },
    submitting: { type: Boolean, value: false },
  },
  data: {
    tableOpponents: [] as Array<Record<string, unknown>>,
  },
  observers: {
    view(view: { playerIndex?: number; opponents?: Array<{ seatIndex: number }> } | null) {
      if (!view?.opponents) {
        this.setData({ tableOpponents: [] });
        return;
      }
      const positionByRelative: Record<number, string> = {
        1: 'right',
        2: 'top',
        3: 'left',
      };
      this.setData({
        tableOpponents: view.opponents.map((player) => {
          const relative = ((player.seatIndex - (view.playerIndex || 0)) + 4) % 4;
          return {
            ...player,
            tablePosition: positionByRelative[relative] || 'top',
          };
        }),
      });
    },
  },
  methods: {
    onSelectTile(event: WechatMiniprogram.CustomEvent<{ tile: number }>) {
      this.triggerEvent('selectTile', event.detail);
    },
    onSubmitAction(event: WechatMiniprogram.CustomEvent<{ action: unknown }>) {
      this.triggerEvent('submitAction', event.detail);
    },
  },
});
