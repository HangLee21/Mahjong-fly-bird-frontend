import { AppConfig } from '../assets/scripts/app/AppConfig';

describe('WeChat experience configuration', () => {
  it('uses the production HTTPS endpoints without bundle subpaths', () => {
    expect(AppConfig.WECHAT_APP_ID).toBe('wx67f006b9a7827b2a');
    expect(AppConfig.API_BASE_URL).toBe('https://flybirdmahjong.fun/api');
    expect(AppConfig.WS_BASE_URL).toBe('wss://flybirdmahjong.fun/ws');
    expect(AppConfig.REMOTE_ASSET_SERVER_ADDRESS).toBe('https://flybirdmahjong.fun/game-assets/');
    expect(AppConfig.REMOTE_ASSET_SERVER_ADDRESS).not.toContain('/remote/resources');
  });

  it('keeps production network mocks disabled', () => {
    expect(AppConfig.USE_MOCK_HTTP).toBe(false);
    expect(AppConfig.USE_MOCK_WS).toBe(false);
  });
});
