import { ExperienceEnvironment } from './ExperienceEnvironment';

const isWechatMiniGame = typeof (globalThis as { wx?: unknown }).wx !== 'undefined';
const serverOrigin = ExperienceEnvironment.SERVER_ORIGIN.replace(/\/+$/, '');

export const AppConfig = {
  WECHAT_APP_ID: ExperienceEnvironment.WECHAT_APP_ID,
  SERVER_ORIGIN: serverOrigin,
  API_BASE_URL: `${serverOrigin}/api`,
  WS_BASE_URL: `${serverOrigin.replace(/^http/, 'ws')}/ws`,
  REMOTE_ASSET_SERVER_ADDRESS: `${serverOrigin}/game-assets/`,
  USE_MOCK_HTTP: false,
  USE_MOCK_WS: false,
  WS_HEARTBEAT_INTERVAL_MS: 20000,
  WS_RECONNECT_MAX_DELAY_MS: 10000,
  RULE_PRESET: 'qujing-fei-xiaoji-v1.5',
};

export function assertExperienceConfig(): void {
  if (!isWechatMiniGame) return;
  if (ExperienceEnvironment.SERVER_ORIGIN.includes('example.com')) {
    throw new Error('体验版服务器域名尚未配置，请修改 ExperienceEnvironment.ts 中的 SERVER_ORIGIN');
  }
  if (!ExperienceEnvironment.SERVER_ORIGIN.startsWith('https://')) {
    throw new Error('体验版服务器必须使用 HTTPS，WebSocket 将自动使用 WSS');
  }
}
