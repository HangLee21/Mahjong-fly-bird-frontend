import { ENV } from '../config/env';
import { clearToken, getToken } from '../utils/storage';
import { ApiError, ApiResponse, RequestOptions } from '../types/api.types';

export async function request<T>(options: RequestOptions): Promise<T> {
  const token = getToken();
  if (options.loading) wx.showLoading({ title: '加载中' });

  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: `${ENV.API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data as WechatMiniprogram.IAnyObject | string | ArrayBuffer | undefined,
      timeout: options.timeout || ENV.REQUEST_TIMEOUT_MS,
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {}),
      },
      success(res) {
        if (res.statusCode === 401) {
          clearToken();
          wx.reLaunch({ url: '/pages/login/login' });
          reject(new ApiError('UNAUTHORIZED', '登录已过期', 401));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new ApiError(res.statusCode, `请求失败 ${res.statusCode}`, res.statusCode));
          return;
        }
        const body = res.data as ApiResponse<T>;
        if (typeof body === 'object' && body !== null && 'code' in body && body.code !== 0) {
          reject(new ApiError(body.code, body.message || '业务错误', res.statusCode));
          return;
        }
        resolve('data' in body && 'code' in body ? body.data : (res.data as T));
      },
      fail(err) {
        reject(new ApiError('NETWORK_ERROR', err.errMsg || '网络异常'));
      },
      complete() {
        if (options.loading) wx.hideLoading();
      },
    });
  });
}
