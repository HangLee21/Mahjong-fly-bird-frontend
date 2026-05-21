"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockWechatLogin = mockWechatLogin;
exports.mockCreateRoom = mockCreateRoom;
exports.mockJoinRoom = mockJoinRoom;
exports.mockLeaveRoom = mockLeaveRoom;
exports.mockAddAi = mockAddAi;
exports.mockStartGame = mockStartGame;
exports.mockGetRoom = mockGetRoom;
exports.mockGetGameView = mockGetGameView;
exports.mockSubmitAction = mockSubmitAction;
exports.mockListReplays = mockListReplays;
exports.mockGetReplay = mockGetReplay;
const data_1 = require("./data");
let room = { ...data_1.mockRoom };
let latestView = { ...data_1.mockGameView };
async function mockWechatLogin() {
    return data_1.mockLoginResult;
}
async function mockCreateRoom(_input) {
    room = { ...data_1.mockRoom, status: 'WAITING', gameId: undefined };
    return { room };
}
async function mockJoinRoom() {
    return room;
}
async function mockLeaveRoom() {
    return undefined;
}
async function mockAddAi(_roomId, seatIndex) {
    room = {
        ...room,
        seats: room.seats.map((seat) => seat.seatIndex === seatIndex
            ? { ...seat, user: { id: `ai_${seatIndex}`, nickname: `AI ${seatIndex}` }, isAI: true, isReady: true }
            : seat),
    };
    return room;
}
async function mockStartGame() {
    room = { ...room, status: 'PLAYING', gameId: data_1.mockGameView.gameId };
    latestView = { ...data_1.mockGameView, status: 'PLAYING' };
    return { roomId: room.roomId, gameId: data_1.mockGameView.gameId };
}
async function mockGetRoom() {
    return room;
}
async function mockGetGameView() {
    return latestView;
}
async function mockSubmitAction(_gameId, action) {
    if (action.type === 'DISCARD') {
        latestView = {
            ...data_1.mockFinishedView,
            self: {
                ...data_1.mockFinishedView.self,
                discards: [...data_1.mockFinishedView.self.discards, action.tile || 18],
            },
        };
    }
    return { accepted: true, view: latestView };
}
async function mockListReplays() {
    return [data_1.mockReplaySummary];
}
async function mockGetReplay() {
    return data_1.mockReplay;
}
