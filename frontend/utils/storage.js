"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToken = getToken;
exports.setToken = setToken;
exports.clearToken = clearToken;
exports.getUser = getUser;
exports.setUser = setUser;
exports.clearUser = clearUser;
exports.getLastRoomId = getLastRoomId;
exports.setLastRoomId = setLastRoomId;
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const ROOM_KEY = 'last_room_id';
function getToken() {
    return wx.getStorageSync(TOKEN_KEY) || null;
}
function setToken(token) {
    wx.setStorageSync(TOKEN_KEY, token);
}
function clearToken() {
    wx.removeStorageSync(TOKEN_KEY);
}
function getUser() {
    return wx.getStorageSync(USER_KEY) || null;
}
function setUser(user) {
    wx.setStorageSync(USER_KEY, user);
}
function clearUser() {
    wx.removeStorageSync(USER_KEY);
}
function getLastRoomId() {
    return wx.getStorageSync(ROOM_KEY) || null;
}
function setLastRoomId(roomId) {
    wx.setStorageSync(ROOM_KEY, roomId);
}
