import {
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
});
