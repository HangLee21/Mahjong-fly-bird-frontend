"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockReplay = exports.mockReplaySummary = exports.mockFinishedView = exports.mockGameView = exports.mockRoom = exports.mockLoginResult = void 0;
exports.mockLoginResult = {
    token: 'mock-token',
    user: {
        id: 'u_001',
        nickname: '玩家一',
    },
};
exports.mockRoom = {
    roomId: '886688',
    ownerId: 'u_001',
    status: 'WAITING',
    gameId: undefined,
    rules: {
        preset: 'qujing-fei-xiao-ji-v1.5',
        allowChow: true,
        fanCap: 3,
        publicKongTiles: 2,
        xiaoJiTile: '1-tiao',
        drawMode: 'fixed-wall-reserve',
        allowMultiWin: true,
    },
    seats: [
        { seatIndex: 0, user: exports.mockLoginResult.user, isReady: true, isOwner: true },
        { seatIndex: 1, user: { id: 'ai_1', nickname: 'AI 东山' }, isAI: true, isReady: true },
        { seatIndex: 2, user: { id: 'ai_2', nickname: 'AI 南盘' }, isAI: true, isReady: true },
        { seatIndex: 3, user: { id: 'ai_3', nickname: 'AI 西桥' }, isAI: true, isReady: true },
    ],
};
exports.mockGameView = {
    roomId: exports.mockRoom.roomId,
    gameId: 'game_mock_001',
    playerIndex: 0,
    status: 'PLAYING',
    stepIndex: 18,
    dealer: 0,
    currentPlayer: 0,
    scores: [0, 0, 0, 0],
    wallTilesRemaining: 72,
    publicKongTiles: [13, 31],
    xiaoJiActiveAsWild: true,
    restrictions: ['同巡振听与拒碰由后端判定', '小鸡作为万能牌时仅可用于杠与和牌'],
    self: {
        hand: [0, 1, 2, 4, 4, 7, 9, 12, 18, 18, 24, 27, 31, 31],
        melds: [],
        discards: [3, 8, 28],
    },
    opponents: [
        {
            seatIndex: 1,
            handCount: 13,
            melds: [{ type: 'PONG', tiles: [29, 29, 29], fromPlayer: 2, stepIndex: 9 }],
            discards: [1, 11, 32],
            status: 'WAITING',
            isAI: true,
            nickname: 'AI 东山',
        },
        {
            seatIndex: 2,
            handCount: 13,
            melds: [],
            discards: [19, 20, 33],
            status: 'WAITING',
            isAI: true,
            nickname: 'AI 南盘',
        },
        {
            seatIndex: 3,
            handCount: 13,
            melds: [],
            discards: [6, 14, 21],
            status: 'WAITING',
            isAI: true,
            nickname: 'AI 西桥',
        },
    ],
    lastDiscard: { tile: 21, fromPlayer: 3 },
    legalActions: [
        { type: 'DISCARD', tile: 0, actionId: 101 },
        { type: 'DISCARD', tile: 1, actionId: 102 },
        { type: 'DISCARD', tile: 18, actionId: 103 },
        { type: 'KONG_CONCEALED', tile: 31, actionId: 201 },
        { type: 'PASS', actionId: 1 },
    ],
};
exports.mockFinishedView = {
    ...exports.mockGameView,
    status: 'FINISHED',
    result: {
        winnerIndexes: [0],
        loserIndexes: [1, 2, 3],
        dealer: 0,
        isSelfDraw: true,
        baseScore: 1,
        cappedFan: 3,
        fanItems: [
            { code: 'WU_JI', name: '无鸡', fan: 1, points: 2 },
            { code: 'MEN_QING_ZI_MO', name: '门清自摸', fan: 1, points: 2 },
            { code: 'GANG_SHANG_HUA', name: '杠上开花', fan: 1, points: 2 },
        ],
        scoreDelta: [24, -8, -8, -8],
        title: '自摸胡牌',
        description: '三番封顶，后端结算为准',
    },
};
exports.mockReplaySummary = {
    gameId: exports.mockFinishedView.gameId,
    roomId: exports.mockFinishedView.roomId,
    finishedAt: Date.now(),
    title: '曲靖飞小鸡 Mock 对局',
    result: exports.mockFinishedView.result,
};
exports.mockReplay = {
    ...exports.mockReplaySummary,
    steps: [
        { stepIndex: 1, view: { ...exports.mockGameView, stepIndex: 1 }, events: [] },
        {
            stepIndex: 18,
            view: exports.mockFinishedView,
            events: [{ id: 'evt_1', type: 'WIN', message: '玩家一杠上开花', stepIndex: 18, ts: Date.now() }],
        },
    ],
};
