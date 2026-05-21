"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameView = getGameView;
exports.submitAction = submitAction;
const env_1 = require("../config/env");
const http_1 = require("./http");
const mock_api_1 = require("./mock/mock-api");
async function getGameView(gameId) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockGetGameView)();
    return (0, http_1.request)({ url: `/games/${gameId}/view` });
}
async function submitAction(gameId, action) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockSubmitAction)(gameId, action);
    return (0, http_1.request)({ url: `/games/${gameId}/actions`, method: 'POST', data: action });
}
