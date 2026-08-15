import {
  meldTypeToVoiceKey,
  tileToVoiceKey,
  winVoiceKeys,
} from '../assets/scripts/audio/VoiceCatalog';
import type { ScoreResult } from '../assets/scripts/game/GameTypes';

test('maps tiles to voice keys for the 0-33 encoding', () => {
  expect(tileToVoiceKey(0)).toBe('yi_wan');
  expect(tileToVoiceKey(8)).toBe('jiu_wan');
  expect(tileToVoiceKey(9)).toBe('yi_tong');
  expect(tileToVoiceKey(17)).toBe('jiu_tong');
  expect(tileToVoiceKey(18)).toBe('yi_tiao');
  expect(tileToVoiceKey(26)).toBe('jiu_tiao');
  expect(tileToVoiceKey(27)).toBe('dong');
  expect(tileToVoiceKey(28)).toBe('nan');
  expect(tileToVoiceKey(29)).toBe('xi');
  expect(tileToVoiceKey(30)).toBe('bei');
  expect(tileToVoiceKey(31)).toBe('zhong');
  expect(tileToVoiceKey(32)).toBe('fa');
  expect(tileToVoiceKey(33)).toBe('bai');
  expect(tileToVoiceKey(34)).toBeNull();
  expect(tileToVoiceKey(-1)).toBeNull();
});

test('maps meld types to voice keys', () => {
  expect(meldTypeToVoiceKey('PONG')).toBe('peng');
  expect(meldTypeToVoiceKey('CHOW')).toBe('chi');
  expect(meldTypeToVoiceKey('KONG_EXPOSED')).toBe('gang');
  expect(meldTypeToVoiceKey('KONG_CONCEALED')).toBe('gang');
  expect(meldTypeToVoiceKey('KONG_ADDED')).toBe('gang');
});

function baseResult(overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    winnerIndexes: [0],
    loserIndexes: [1, 2, 3],
    dealer: 0,
    isSelfDraw: false,
    baseScore: 1,
    fanItems: [],
    scoreDelta: [3, -1, -1, -1],
    title: '点炮胡牌',
    ...overrides,
  };
}

test('win voices prefer kong flower, then rob kong, then draw/discard', () => {
  expect(
    winVoiceKeys(baseResult({ fanItems: [{ code: 'KONG_FLOWER', name: '杠上开花', points: 2 }] })),
  ).toEqual(['gang_shang_hua']);
  expect(
    winVoiceKeys(baseResult({ fanItems: [{ code: 'DOUBLE_KONG_FLOWER', name: '双杠上花', points: 4 }] })),
  ).toEqual(['gang_shang_hua']);
  expect(
    winVoiceKeys(baseResult({ fanItems: [{ code: 'ROB_KONG', name: '抢杠', points: 3 }] })),
  ).toEqual(['qiang_gang_hu']);
  expect(winVoiceKeys(baseResult({ isSelfDraw: true }))).toEqual(['zi_mo']);
  expect(winVoiceKeys(baseResult())).toEqual(['hu']);
});
