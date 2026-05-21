"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTileMeta = getTileMeta;
exports.getTileLabel = getTileLabel;
exports.getTileImage = getTileImage;
exports.isXiaoJi = isXiaoJi;
exports.sortTiles = sortTiles;
exports.getTileClass = getTileClass;
const constants_1 = require("../config/constants");
const SUITS = [
    { suit: 'wan', suffix: '万', offset: 0 },
    { suit: 'tong', suffix: '筒', offset: 9 },
    { suit: 'tiao', suffix: '条', offset: 18 },
];
const HONORS = ['东', '南', '西', '北', '中', '发', '白'];
function getTileMeta(tile) {
    if (tile >= 0 && tile < 27) {
        const group = SUITS[Math.floor(tile / 9)];
        const rank = tile - group.offset + 1;
        return {
            id: tile,
            label: `${rank}${group.suffix}`,
            suit: group.suit,
            rank,
            isXiaoJi: tile === constants_1.XIAO_JI_TILE_ID,
        };
    }
    const honorIndex = tile - 27;
    const label = HONORS[honorIndex] || `牌${tile}`;
    return {
        id: tile,
        label,
        suit: honorIndex < 4 ? 'wind' : 'dragon',
    };
}
function getTileLabel(tile) {
    return getTileMeta(tile).label;
}
function getTileImage(tile) {
    return `/assets/tiles/tile_${tile}.png`;
}
function isXiaoJi(tile) {
    return tile === constants_1.XIAO_JI_TILE_ID;
}
function sortTiles(tiles) {
    return [...tiles].sort((a, b) => a - b);
}
function getTileClass(tile) {
    const meta = getTileMeta(tile);
    return `tile-${meta.suit}${meta.isXiaoJi ? ' tile-xiaoji' : ''}`;
}
