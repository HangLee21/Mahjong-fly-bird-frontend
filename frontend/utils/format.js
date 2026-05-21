"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatScore = formatScore;
exports.formatTime = formatTime;
function formatScore(value) {
    return value > 0 ? `+${value}` : String(value);
}
function formatTime(ts) {
    const date = new Date(ts);
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
