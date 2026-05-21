import { ENV } from '../config/env';
import { request } from './http';
import { mockGetReplay, mockListReplays } from './mock/mock-api';
import type { ReplayDetail, ReplaySummary } from '../types/replay.types';

export async function listReplays(): Promise<ReplaySummary[]> {
  if (ENV.USE_MOCK_API) return mockListReplays();
  return request<ReplaySummary[]>({ url: '/replays' });
}

export async function getReplay(gameId: string): Promise<ReplayDetail> {
  if (ENV.USE_MOCK_API) return mockGetReplay();
  return request<ReplayDetail>({ url: `/replays/${gameId}` });
}
