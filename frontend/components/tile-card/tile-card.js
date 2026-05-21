"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tile_utils_1 = require("../../utils/tile-utils");
Component({
    properties: {
        tile: { type: Number, value: -1 },
        back: { type: Boolean, value: false },
        selected: { type: Boolean, value: false },
        disabled: { type: Boolean, value: false },
        small: { type: Boolean, value: false },
        latest: { type: Boolean, value: false },
    },
    data: {
        label: '',
        image: '',
        tileClass: '',
        isXiaoJi: false,
    },
    observers: {
        tile(tile) {
            this.setData({
                label: tile >= 0 ? (0, tile_utils_1.getTileLabel)(tile) : '',
                image: tile >= 0 ? (0, tile_utils_1.getTileImage)(tile) : '/assets/tiles/tile_back.png',
                tileClass: tile >= 0 ? (0, tile_utils_1.getTileClass)(tile) : '',
                isXiaoJi: tile >= 0 && (0, tile_utils_1.isXiaoJi)(tile),
            });
        },
    },
    methods: {
        onTap() {
            if (this.properties.disabled || this.properties.back)
                return;
            this.triggerEvent('tapTile', { tile: this.properties.tile });
        },
    },
});
