const values = new Map<string, string>();

jest.mock(
  'cc',
  () => ({
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

import { AUTH_SESSION_VERSION, Storage } from '../assets/scripts/utils/Storage';

describe('auth storage version', () => {
  beforeEach(() => values.clear());

  it('invalidates credentials written by an older client build', () => {
    values.set('auth_token', 'old-token');
    values.set('auth_user', JSON.stringify({ id: 'old-user', nickname: 'Old' }));
    values.set('auth_session_version', 'previous-version');

    expect(Storage.getToken()).toBeNull();
    expect(values.has('auth_token')).toBe(false);
    expect(values.has('auth_user')).toBe(false);
  });

  it('marks a fresh login with the current auth version', () => {
    Storage.setToken('fresh-token');

    expect(values.get('auth_session_version')).toBe(AUTH_SESSION_VERSION);
    expect(Storage.getToken()).toBe('fresh-token');
  });

  it('also invalidates legacy credentials with no version marker', () => {
    values.set('auth_token', 'legacy-token');

    expect(Storage.getToken()).toBeNull();
  });
});
