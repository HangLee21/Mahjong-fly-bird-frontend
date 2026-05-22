"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../config/constants");
const tile_utils_1 = require("../../utils/tile-utils");
Component({
    properties: {
        actions: { type: Array, value: [] },
        submitting: { type: Boolean, value: false },
        selectedTile: { type: Number, value: -1 },
    },
    data: {
        displayActions: [],
    },
    observers: {
        actions(actions) {
            this.setData({
                displayActions: (actions || [])
                    .map((action, index) => ({ action, index }))
                    .filter(({ action }) => action.type !== 'DISCARD')
                    .map(({ action, index }) => ({
                    ...action,
                    index,
                    label: `${constants_1.ACTION_LABELS[action.type] || action.type}${action.tile !== undefined ? ` ${(0, tile_utils_1.getTileLabel)(action.tile)}` : ''}`,
                })),
            });
        },
    },
    methods: {
        onAction(event) {
            const index = Number(event.currentTarget.dataset.index);
            const action = this.properties.actions[index];
            this.triggerEvent('submitAction', { action });
        },
    },
});
