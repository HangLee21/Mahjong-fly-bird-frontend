const values = new Map<string, string>();
const loadScene = jest.fn((_name: string, callback?: () => void) => callback?.());

jest.mock(
  'cc',
  () => ({
    director: { loadScene },
    EventTarget: class {
      emit(): void {}
    },
    sys: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  }),
  { virtual: true },
);

import { WsClient } from '../assets/scripts/network/WsClient';
import { AUTH_SESSION_VERSION } from '../assets/scripts/utils/Storage';

describe('WsClient authentication revocation', () => {
  beforeEach(() => {
    values.clear();
    loadScene.mockClear();
  });

  it('clears the session and returns to Login after an unauthorized server message', () => {
    values.set('auth_token', 'revoked-token');
    values.set('auth_user', JSON.stringify({ id: 'user-1', nickname: 'Player' }));
    values.set('auth_session_version', AUTH_SESSION_VERSION);
    const client = new WsClient();

    (client as unknown as { handleMessage(data: string): void }).handleMessage(
      JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED', message: 'Invalid token.' }),
    );

    expect(values.has('auth_token')).toBe(false);
    expect(values.has('auth_user')).toBe(false);
    expect(loadScene).toHaveBeenCalledWith('Login', expect.any(Function));
  });
});
