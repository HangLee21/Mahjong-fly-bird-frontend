"use strict";
Component({
    properties: {
        tiles: { type: Array, value: [] },
        legalTiles: { type: Array, value: [] },
        selectedTile: { type: Number, value: -1 },
        disabled: { type: Boolean, value: false },
    },
    data: {
        displayTiles: [],
    },
    observers: {
        'tiles, legalTiles, selectedTile'(tiles, legalTiles, selectedTile) {
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
        onTapTile(event) {
            this.triggerEvent('selectTile', event.detail);
        },
    },
});
