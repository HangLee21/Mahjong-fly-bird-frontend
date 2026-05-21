"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReplays = listReplays;
exports.getReplay = getReplay;
const env_1 = require("../config/env");
const http_1 = require("./http");
const mock_api_1 = require("./mock/mock-api");
async function listReplays() {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockListReplays)();
    return (0, http_1.request)({ url: '/replays' });
}
async function getReplay(gameId) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockGetReplay)();
    return (0, http_1.request)({ url: `/replays/${gameId}` });
}
