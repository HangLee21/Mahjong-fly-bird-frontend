import { ApiRoutes } from '../network/ApiRoutes';
import { httpClient } from '../network/HttpClient';
import type { LoginResult } from './AuthTypes';

export class AuthApi {
  wechatLogin(input: { code: string; nickname?: string; avatarUrl?: string }): Promise<LoginResult> {
    return httpClient.post<LoginResult>(ApiRoutes.wechatLogin, input);
  }
}

export const authApi = new AuthApi();
