import { AppConfig } from '../app/AppConfig';
import type { ApiResponse } from './Protocol';
import { Storage } from '../utils/Storage';
import { MockHttpClient } from '../mock/MockHttpClient';

interface HttpResult {
  status: number;
  ok: boolean;
  body: unknown;
}

interface WxRequestApi {
  request(options: {
    url: string;
    method: 'GET' | 'POST';
    header?: Record<string, string>;
    data?: unknown;
    success?: (result: { statusCode: number; data: unknown }) => void;
    fail?: (error: { errMsg?: string }) => void;
  }): void;
}

export class HttpClient {
  async request<T>(path: string, method: 'GET' | 'POST' = 'GET', data?: unknown): Promise<T> {
    const token = Storage.getToken();
    const headers = {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const response = await this.send(`${AppConfig.API_BASE_URL}${path}`, method, headers, data);
    if (response.status === 401) {
      Storage.clearSession();
      throw new Error('登录已过期');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = response.body as ApiResponse<T> | T;
    if (typeof body === 'object' && body !== null && 'code' in body) {
      const apiBody = body as ApiResponse<T>;
      if (apiBody.code !== 0) throw new Error(apiBody.message || '业务错误');
      return apiBody.data;
    }
    return body as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, 'GET');
  }

  post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, 'POST', data);
  }

  private async send(url: string, method: 'GET' | 'POST', headers: Record<string, string>, data?: unknown): Promise<HttpResult> {
    if (typeof fetch === 'function') {
      const response = await fetch(url, {
        method,
        headers,
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return {
        status: response.status,
        ok: response.ok,
        body: await response.json(),
      };
    }

    const wxApi = (globalThis as unknown as { wx?: WxRequestApi }).wx;
    if (!wxApi?.request) throw new Error('当前运行环境不支持 fetch 或 wx.request');

    return new Promise<HttpResult>((resolve, reject) => {
      wxApi.request({
        url,
        method,
        header: headers,
        data,
        success: (result) => {
          const status = result.statusCode;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            body: result.data,
          });
        },
        fail: (error) => reject(new Error(error.errMsg || 'wx.request failed')),
      });
    });
  }
}

export const httpClient = AppConfig.USE_MOCK_HTTP ? new MockHttpClient() : new HttpClient();
