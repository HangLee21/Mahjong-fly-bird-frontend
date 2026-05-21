"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.leaveRoom = leaveRoom;
exports.addAi = addAi;
exports.startGame = startGame;
exports.getRoom = getRoom;
const env_1 = require("../config/env");
const http_1 = require("./http");
const mock_api_1 = require("./mock/mock-api");
async function createRoom(input) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockCreateRoom)(input);
    return (0, http_1.request)({ url: '/rooms', method: 'POST', data: input, loading: true });
}
async function joinRoom(roomId, seatIndex) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockJoinRoom)();
    return (0, http_1.request)({ url: `/rooms/${roomId}/join`, method: 'POST', data: { seatIndex }, loading: true });
}
async function leaveRoom(roomId) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockLeaveRoom)();
    return (0, http_1.request)({ url: `/rooms/${roomId}/leave`, method: 'POST' });
}
async function addAi(roomId, seatIndex, model) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockAddAi)(roomId, seatIndex);
    return (0, http_1.request)({ url: `/rooms/${roomId}/add-ai`, method: 'POST', data: { seatIndex, model }, loading: true });
}
async function startGame(roomId) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockStartGame)();
    return (0, http_1.request)({ url: `/rooms/${roomId}/start`, method: 'POST', loading: true });
}
async function getRoom(roomId) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockGetRoom)();
    return (0, http_1.request)({ url: `/rooms/${roomId}` });
}
