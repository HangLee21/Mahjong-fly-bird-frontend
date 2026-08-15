import type { ActionType, MeldType, ScoreResult, TileId } from '../game/GameTypes';

export type VoiceKey =
  | 'chi'
  | 'peng'
  | 'gang'
  | 'hu'
  | 'zi_mo'
  | 'gang_shang_hua'
  | 'qiang_gang_hu'
  | 'wu_ji'
  | 'guo'
  | 'ting'
  | 'yi_wan'
  | 'er_wan'
  | 'san_wan'
  | 'si_wan'
  | 'wu_wan'
  | 'liu_wan'
  | 'qi_wan'
  | 'ba_wan'
  | 'jiu_wan'
  | 'yi_tong'
  | 'er_tong'
  | 'san_tong'
  | 'si_tong'
  | 'wu_tong'
  | 'liu_tong'
  | 'qi_tong'
  | 'ba_tong'
  | 'jiu_tong'
  | 'yi_tiao'
  | 'er_tiao'
  | 'san_tiao'
  | 'si_tiao'
  | 'wu_tiao'
  | 'liu_tiao'
  | 'qi_tiao'
  | 'ba_tiao'
  | 'jiu_tiao'
  | 'dong'
  | 'nan'
  | 'xi'
  | 'bei'
  | 'zhong'
  | 'fa'
  | 'bai';

const ACTION_KEYS: VoiceKey[] = [
  'chi',
  'peng',
  'gang',
  'hu',
  'zi_mo',
  'gang_shang_hua',
  'qiang_gang_hu',
  'wu_ji',
  'guo',
  'ting',
];

const NUMERIC = [
  'yi',
  'er',
  'san',
  'si',
  'wu',
  'liu',
  'qi',
  'ba',
  'jiu',
] as const;

// TileId -> suit mapping matches the backend 0-33 encoding:
//   0-8   -> 1-9 万
//   9-17  -> 1-9 筒
//   18-26 -> 1-9 条（18 为小鸡/一条）
const TILE_SUITS = [
  'wan',
  'tong',
  'tiao',
] as const;

export const TILE_VOICE_KEYS: VoiceKey[] = TILE_SUITS.flatMap((suit) =>
  NUMERIC.map((num) => `${num}_${suit}` as VoiceKey),
);

const HONOR_VOICE_KEYS: VoiceKey[] = ['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai'];

export const VOICE_PATHS: Record<VoiceKey, string> = {
  ...Object.fromEntries(ACTION_KEYS.map((key) => [key, `audio/voice/${key}`])),
  ...Object.fromEntries(TILE_VOICE_KEYS.map((key) => [key, `audio/voice/${key}`])),
  ...Object.fromEntries(HONOR_VOICE_KEYS.map((key) => [key, `audio/voice/${key}`])),
} as Record<VoiceKey, string>;

export function tileToVoiceKey(tile: TileId): VoiceKey | null {
  if (tile >= 27 && tile <= 33) return HONOR_VOICE_KEYS[tile - 27];
  if (tile < 0 || tile >= 27) return null;
  const suitIndex = Math.floor(tile / 9);
  const numberIndex = tile % 9;
  return `${NUMERIC[numberIndex]}_${TILE_SUITS[suitIndex]}` as VoiceKey;
}

export function meldTypeToVoiceKey(type: MeldType): VoiceKey | null {
  if (type === 'PONG') return 'peng';
  if (type === 'CHOW') return 'chi';
  if (type === 'KONG_EXPOSED' || type === 'KONG_CONCEALED' || type === 'KONG_ADDED') {
    return 'gang';
  }
  return null;
}

export function actionTypeToMeldVoiceKey(type: ActionType): VoiceKey | null {
  if (type === 'PONG') return 'peng';
  if (type === 'CHOW_LEFT' || type === 'CHOW_MIDDLE' || type === 'CHOW_RIGHT') return 'chi';
  if (type === 'KONG_EXPOSED' || type === 'KONG_CONCEALED' || type === 'KONG_ADDED') return 'gang';
  return null;
}

export function winVoiceKeys(result: ScoreResult): VoiceKey[] {
  const fanCodes = new Set((result.fanItems || []).map((item) => item.code));
  if (fanCodes.has('DOUBLE_KONG_FLOWER') || fanCodes.has('KONG_FLOWER')) {
    return ['gang_shang_hua'];
  }
  if (fanCodes.has('ROB_KONG')) {
    return ['qiang_gang_hu'];
  }
  return result.isSelfDraw ? ['zi_mo'] : ['hu'];
}
