"use strict";
Component({
    properties: {
        view: { type: Object },
        legalDiscardTiles: { type: Array, value: [] },
        selectedTile: { type: Number, value: -1 },
        submitting: { type: Boolean, value: false },
    },
    data: {
        tableOpponents: [],
    },
    observers: {
        view(view) {
            if (!view?.opponents) {
                this.setData({ tableOpponents: [] });
                return;
            }
            const positionByRelative = {
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
        onSelectTile(event) {
            this.triggerEvent('selectTile', event.detail);
        },
        onSubmitAction(event) {
            this.triggerEvent('submitAction', event.detail);
        },
    },
});
