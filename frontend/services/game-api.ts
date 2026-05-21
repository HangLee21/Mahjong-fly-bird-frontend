import { ENV } from '../config/env';
import { request } from './http';
import { mockGetGameView, mockSubmitAction } from './mock/mock-api';
import type { ActionResult, ClientAction, PlayerGameView } from '../types/game.types';

export async function getGameView(gameId: string): Promise<PlayerGameView> {
  if (ENV.USE_MOCK_API) return mockGetGameView();
  return request<PlayerGameView>({ url: `/games/${gameId}/view` });
}

export async function submitAction(gameId: string, action: ClientAction): Promise<ActionResult> {
  if (ENV.USE_MOCK_API) return mockSubmitAction(gameId, action);
  return request<ActionResult>({ url: `/games/${gameId}/actions`, method: 'POST', data: action });
}
