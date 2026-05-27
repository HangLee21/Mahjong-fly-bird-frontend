import { ApiRoutes } from '../network/ApiRoutes';
import { httpClient } from '../network/HttpClient';
import type { ReplayListItem, ReplayRecord } from './ReplayTypes';

export class ReplayApi {
  list(): Promise<ReplayListItem[]> {
    return httpClient.get(ApiRoutes.replays);
  }

  get(gameId: string): Promise<ReplayRecord> {
    return httpClient.get(ApiRoutes.replay(gameId));
  }
}

export const replayApi = new ReplayApi();
