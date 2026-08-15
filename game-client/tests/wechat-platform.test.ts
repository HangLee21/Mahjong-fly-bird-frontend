import {
  createWechatProfileButton,
  getWechatAppId,
  getWechatEnvironmentVersion,
  isWechatMiniGame,
  requestWechatLoginCode,
} from '../assets/scripts/platform/WechatPlatform';

type TestWechatApi = {
  login(options: {
    success?: (result: { code?: string; errMsg?: string }) => void;
    fail?: (result: { errMsg?: string }) => void;
  }): void;
  getAccountInfoSync?(): {
    miniProgram?: {
      appId?: string;
      envVersion?: 'develop' | 'trial' | 'release';
    };
  };
  getSystemInfoSync?(): { windowWidth: number; windowHeight: number };
  createUserInfoButton?(options: { style: Record<string, string | number> }): {
    onTap(callback: (result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void): void;
    destroy(): void;
  };
};

function setWechatApi(api?: TestWechatApi): void {
  (globalThis as { wx?: TestWechatApi }).wx = api;
}

describe('WechatPlatform', () => {
  afterEach(() => setWechatApi(undefined));

  it('reads the current mini-game identity', () => {
    setWechatApi({
      login: () => undefined,
      getAccountInfoSync: () => ({
        miniProgram: {
          appId: 'wx67f006b9a7827b2a',
          envVersion: 'trial',
        },
      }),
    });

    expect(isWechatMiniGame()).toBe(true);
    expect(getWechatAppId()).toBe('wx67f006b9a7827b2a');
    expect(getWechatEnvironmentVersion()).toBe('trial');
  });

  it('resolves a wx.login code', async () => {
    setWechatApi({
      login: ({ success }) => success?.({ code: 'wechat-code' }),
    });

    await expect(requestWechatLoginCode()).resolves.toBe('wechat-code');
  });

  it('rejects an unsuccessful wx.login call', async () => {
    setWechatApi({
      login: ({ fail }) => fail?.({ errMsg: 'login denied' }),
    });

    await expect(requestWechatLoginCode()).rejects.toThrow('login denied');
  });

  it('maps a native profile button tap to nickname and avatar', () => {
    let tap: ((result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void) | undefined;
    let style: Record<string, string | number> | undefined;
    setWechatApi({
      login: () => undefined,
      getSystemInfoSync: () => ({ windowWidth: 1000, windowHeight: 500 }),
      createUserInfoButton: (options) => {
        style = options.style;
        return {
          onTap: (callback) => { tap = callback; },
          destroy: () => undefined,
        };
      },
    });
    const onProfile = jest.fn();

    const button = createWechatProfileButton(
      { leftRatio: 0.38, topRatio: 0.565, widthRatio: 0.24, heightRatio: 0.14 },
      onProfile,
      jest.fn(),
    );
    tap?.({ userInfo: { nickName: '牌友', avatarUrl: 'https://example.com/avatar.png' } });

    expect(button).not.toBeNull();
    expect(style).toMatchObject({ left: 380, top: 282.5, width: 240, height: 70 });
    expect(onProfile).toHaveBeenCalledWith({ nickname: '牌友', avatarUrl: 'https://example.com/avatar.png' });
  });
});
