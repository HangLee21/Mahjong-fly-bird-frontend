"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const replay_api_1 = require("../../services/replay-api");
const format_1 = require("../../utils/format");
const error_1 = require("../../utils/error");
Page({
    data: {
        items: [],
    },
    formatTime: format_1.formatTime,
    async onShow() {
        try {
            this.setData({ items: await (0, replay_api_1.listReplays)() });
        }
        catch (error) {
            (0, error_1.showError)(error, '加载牌谱失败');
        }
    },
    onOpen(event) {
        wx.navigateTo({ url: `/pages/replay/replay?gameId=${event.currentTarget.dataset.id}` });
    },
});
