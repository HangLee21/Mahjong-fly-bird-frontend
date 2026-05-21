import { ENV } from '../config/env';
import { request } from './http';
import { mockWechatLogin } from './mock/mock-api';
import type { LoginResult } from '../types/auth.types';

export async function wechatLogin(input: { code: string; nickname?: string; avatarUrl?: string }): Promise<LoginResult> {
  if (ENV.USE_MOCK_API) return mockWechatLogin();
  return request<LoginResult>({ url: '/auth/wechat-login', method: 'POST', data: input, loading: true });
}
