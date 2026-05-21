"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showError = showError;
exports.assertNever = assertNever;
function showError(error, fallback = '操作失败') {
    const message = error instanceof Error ? error.message : fallback;
    wx.showToast({ title: message || fallback, icon: 'none' });
}
function assertNever(value) {
    throw new Error(`Unhandled value: ${String(value)}`);
}
