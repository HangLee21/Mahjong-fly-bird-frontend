export type BgmTrack = 'tableAmbient';

export interface BgmTrackConfig {
  resourcePath: string;
  loop: boolean;
  volume: number;
}

export const AudioConfig = {
  bgm: {
    enabled: true,
    autoPlay: true,
    defaultTrack: 'tableAmbient' as BgmTrack,
    fadeInSeconds: 0.8,
    fadeOutSeconds: 0.35,
    storageKeys: {
      muted: 'audio_bgm_muted',
      volume: 'audio_bgm_volume',
    },
  },
  tracks: {
    tableAmbient: {
      resourcePath: 'audio/bgm/table_ambient',
      loop: true,
      volume: 0.28,
    },
  } satisfies Record<BgmTrack, BgmTrackConfig>,
};
