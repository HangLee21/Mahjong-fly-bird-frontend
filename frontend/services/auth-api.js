"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wechatLogin = wechatLogin;
const env_1 = require("../config/env");
const http_1 = require("./http");
const mock_api_1 = require("./mock/mock-api");
async function wechatLogin(input) {
    if (env_1.ENV.USE_MOCK_API)
        return (0, mock_api_1.mockWechatLogin)();
    return (0, http_1.request)({ url: '/auth/wechat-login', method: 'POST', data: input, loading: true });
}
