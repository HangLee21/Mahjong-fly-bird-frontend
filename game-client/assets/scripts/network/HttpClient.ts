import { AppConfig } from '../app/AppConfig';
import type { ApiResponse } from './Protocol';
import { Storage } from '../utils/Storage';
import { MockHttpClient } from '../mock/MockHttpClient';

interface HttpResult {
  status: number;
  ok: boolean;
  body: unknown;
}

export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

interface WxRequestApi {
  request(options: {
    url: string;
    method: 'GET' | 'POST';
    header?: Record<string, string>;
    data?: unknown;
    timeout?: number;
    success?: (result: { statusCode: number; data: unknown }) => void;
    fail?: (error: { errMsg?: string }) => void;
  }): void;
}

function responseMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return fallback;
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
      const fallback = path === '/auth/wechat-login' ? '微信登录失败' : '登录已过期';
      throw new HttpRequestError(responseMessage(response.body, fallback), response.status, response.body);
    }
    if (!response.ok) {
      throw new HttpRequestError(
        responseMessage(response.body, `服务器请求失败（HTTP ${response.status}）`),
        response.status,
        response.body,
      );
    }
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
      const text = await response.text();
      let body: unknown = text;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          // Keep the response text so gateway and proxy errors remain readable.
        }
      }
      return {
        status: response.status,
        ok: response.ok,
        body,
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
        timeout: 15000,
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
