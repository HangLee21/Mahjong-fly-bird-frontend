const clips = new Map<string, { duration: number }>([
  ['audio/voice/yi_wan', { duration: 0.8 }],
  ['audio/voice/er_wan', { duration: 0.8 }],
  ['audio/sfx/tile_discard', { duration: 0.25 }],
]);

jest.mock(
  'cc',
  () => ({
    AudioClip: class {},
    AudioSource: class {},
    Node: class {},
    resources: {
      load: (path: string, _type: unknown, callback: (error: Error | null, clip: unknown) => void) => {
        callback(null, clips.get(path) ?? { duration: 0.8 });
      },
    },
  }),
  { virtual: true },
);

import { GameAudio } from '../assets/scripts/audio/GameAudio';

function createSource() {
  return {
    clip: null as unknown,
    loop: false,
    volume: 1,
    playing: false,
    play: jest.fn(function play(this: { playing: boolean }) { this.playing = true; }),
    stop: jest.fn(function stop(this: { playing: boolean }) { this.playing = false; }),
    playOneShot: jest.fn(),
  };
}

describe('GameAudio', () => {
  it('replaces an active discard announcement instead of overlapping it', () => {
    jest.useFakeTimers();
    const soundSource = createSource();
    const voiceSource = createSource();
    const host = {
      getComponent: () => soundSource,
      getComponents: () => [soundSource, voiceSource],
      addComponent: () => voiceSource,
    };
    const audio = new GameAudio();
    audio.attach(host as never);

    audio.playVoice(['yi_wan'], 0.9, 'replace');
    audio.playVoice(['er_wan'], 0.9, 'replace');

    expect(voiceSource.stop).toHaveBeenCalledTimes(2);
    expect(voiceSource.play).toHaveBeenCalledTimes(2);
    expect((voiceSource.clip as { duration: number }).duration).toBe(0.8);
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('queues consecutive discard announcements without cutting off the first', () => {
    jest.useFakeTimers();
    const soundSource = createSource();
    const voiceSource = createSource();
    const host = {
      getComponent: () => soundSource,
      getComponents: () => [soundSource, voiceSource],
      addComponent: () => voiceSource,
    };
    const audio = new GameAudio();
    audio.attach(host as never);

    audio.playVoice(['yi_wan'], 0.9, 'append');
    audio.playVoice(['er_wan'], 0.9, 'append');

    expect(voiceSource.play).toHaveBeenCalledTimes(1);
    expect(voiceSource.stop).not.toHaveBeenCalled();
    jest.advanceTimersByTime(890);
    expect(voiceSource.play).toHaveBeenCalledTimes(2);
    expect((voiceSource.clip as { duration: number }).duration).toBe(0.8);
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('debounces duplicate discard impact sounds', () => {
    const soundSource = createSource();
    const voiceSource = createSource();
    const host = {
      getComponent: () => soundSource,
      getComponents: () => [soundSource, voiceSource],
      addComponent: () => voiceSource,
    };
    const audio = new GameAudio();
    audio.attach(host as never);

    audio.play('tileDiscard');
    audio.play('tileDiscard');

    expect(soundSource.playOneShot).toHaveBeenCalledTimes(1);
  });

  it('queues meld and following discard as complete announcements', () => {
    jest.useFakeTimers();
    const soundSource = createSource();
    const voiceSource = createSource();
    const host = {
      getComponent: () => soundSource,
      getComponents: () => [soundSource, voiceSource],
      addComponent: () => voiceSource,
    };
    const audio = new GameAudio();
    audio.attach(host as never);

    audio.announceVoice(['peng'], 'meld');
    audio.announceVoice(['liu_wan'], 'tileDiscard');

    expect(voiceSource.play).toHaveBeenCalledTimes(1);
    expect(soundSource.playOneShot).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(890);
    expect(voiceSource.play).toHaveBeenCalledTimes(2);
    expect(soundSource.playOneShot).toHaveBeenCalledTimes(2);
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
});
