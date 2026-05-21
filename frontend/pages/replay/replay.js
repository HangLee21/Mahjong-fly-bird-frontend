"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const replay_api_1 = require("../../services/replay-api");
const error_1 = require("../../utils/error");
Page({
    data: {
        replay: null,
        index: 0,
        view: null,
    },
    async onLoad(query) {
        try {
            if (!query.gameId)
                return;
            const replay = await (0, replay_api_1.getReplay)(query.gameId);
            this.setData({ replay, view: replay.steps[0]?.view || null });
        }
        catch (error) {
            (0, error_1.showError)(error, '加载回放失败');
        }
    },
    onPrev() {
        const index = Math.max(0, this.data.index - 1);
        this.setData({ index, view: this.data.replay?.steps[index]?.view || null });
    },
    onNext() {
        const max = (this.data.replay?.steps.length || 1) - 1;
        const index = Math.min(max, this.data.index + 1);
        this.setData({ index, view: this.data.replay?.steps[index]?.view || null });
    },
});
