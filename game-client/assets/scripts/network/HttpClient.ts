import { AppConfig } from '../app/AppConfig';
import type { ApiResponse } from './Protocol';
import { Storage } from '../utils/Storage';

export class HttpClient {
  async request<T>(path: string, method: 'GET' | 'POST' = 'GET', data?: unknown): Promise<T> {
    const token = Storage.getToken();
    const response = await fetch(`${AppConfig.API_BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (response.status === 401) {
      Storage.clearSession();
      throw new Error('登录已过期');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as ApiResponse<T> | T;
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
}

export const httpClient = new HttpClient();
