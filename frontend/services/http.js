"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = request;
const env_1 = require("../config/env");
const storage_1 = require("../utils/storage");
const api_types_1 = require("../types/api.types");
async function request(options) {
    const token = (0, storage_1.getToken)();
    if (options.loading)
        wx.showLoading({ title: '加载中' });
    return new Promise((resolve, reject) => {
        wx.request({
            url: `${env_1.ENV.API_BASE_URL}${options.url}`,
            method: options.method || 'GET',
            data: options.data,
            timeout: options.timeout || env_1.ENV.REQUEST_TIMEOUT_MS,
            header: {
                'content-type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.header || {}),
            },
            success(res) {
                if (res.statusCode === 401) {
                    (0, storage_1.clearToken)();
                    wx.reLaunch({ url: '/pages/login/login' });
                    reject(new api_types_1.ApiError('UNAUTHORIZED', '登录已过期', 401));
                    return;
                }
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new api_types_1.ApiError(res.statusCode, `请求失败 ${res.statusCode}`, res.statusCode));
                    return;
                }
                const body = res.data;
                if (typeof body === 'object' && body !== null && 'code' in body && body.code !== 0) {
                    reject(new api_types_1.ApiError(body.code, body.message || '业务错误', res.statusCode));
                    return;
                }
                resolve('data' in body && 'code' in body ? body.data : res.data);
            },
            fail(err) {
                reject(new api_types_1.ApiError('NETWORK_ERROR', err.errMsg || '网络异常'));
            },
            complete() {
                if (options.loading)
                    wx.hideLoading();
            },
        });
    });
}
