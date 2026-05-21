"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomStore = void 0;
const room_api_1 = require("../services/room-api");
const event_bus_1 = require("../utils/event-bus");
const storage_1 = require("../utils/storage");
class RoomStore {
    constructor() {
        this.room = null;
    }
    async create() {
        const result = await (0, room_api_1.createRoom)({});
        this.setRoom(result.room);
        return result.room;
    }
    async join(roomId) {
        const room = await (0, room_api_1.joinRoom)(roomId);
        this.setRoom(room);
        return room;
    }
    async refresh(roomId) {
        const room = await (0, room_api_1.getRoom)(roomId);
        this.setRoom(room);
        return room;
    }
    async addAi(seatIndex) {
        if (!this.room)
            throw new Error('请先进入房间');
        const room = await (0, room_api_1.addAi)(this.room.roomId, seatIndex);
        this.setRoom(room);
        return room;
    }
    async start() {
        if (!this.room)
            throw new Error('请先进入房间');
        const result = await (0, room_api_1.startGame)(this.room.roomId);
        this.setRoom({ ...this.room, status: 'PLAYING', gameId: result.gameId });
        return result.gameId;
    }
    setRoom(room) {
        this.room = room;
        (0, storage_1.setLastRoomId)(room.roomId);
        event_bus_1.eventBus.emit('room:update', room);
    }
}
exports.roomStore = new RoomStore();
