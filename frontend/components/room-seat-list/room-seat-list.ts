Component({
  properties: {
    seats: { type: Array, value: [] },
    canAddAi: { type: Boolean, value: false },
  },
  methods: {
    onAddAi(event: WechatMiniprogram.BaseEvent) {
      this.triggerEvent('addAi', { seatIndex: Number(event.currentTarget.dataset.index) });
    },
  },
});
