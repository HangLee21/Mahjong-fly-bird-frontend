import { AudioClip, AudioSource, Node, resources } from 'cc';
import { VOICE_PATHS, type VoiceKey } from './VoiceCatalog';

export type GameSound =
  | 'button'
  | 'meld'
  | 'roundStart'
  | 'tileDiscard'
  | 'tileSelect'
  | 'win'
  | 'winOthers';

export interface VoiceSettings {
  enabled: boolean;
  /** 出牌时播报牌面（如“六万”）。 */
  announceDiscards: boolean;
  /** 吃碰杠时播报动作词。 */
  announceMelds: boolean;
  /** 胡牌时播报胡/自摸/杠上花。 */
  announceWins: boolean;
  volume: number;
  /** 语音队列上限，超过后丢弃最旧的播报，避免追不上牌局节奏。 */
  maxQueueLength: number;
  /** 两条语音之间的间隔毫秒数。 */
  gapMs: number;
}

export type VoiceQueueMode = 'append' | 'replace';

export const DefaultVoiceSettings: VoiceSettings = {
  enabled: true,
  announceDiscards: true,
  announceMelds: true,
  announceWins: true,
  volume: 0.9,
  maxQueueLength: 12,
  gapMs: 40,
};

const SOUND_PATHS: Record<GameSound, string> = {
  button: 'audio/sfx/ui_click',
  meld: 'audio/sfx/meld',
  roundStart: 'audio/sfx/round_start',
  tileDiscard: 'audio/sfx/tile_discard',
  tileSelect: 'audio/sfx/tile_select',
  win: 'audio/sfx/win',
  winOthers: 'audio/sfx/win_others',
};

export class GameAudio {
  private source: AudioSource | null = null;
  private readonly clips = new Map<string, AudioClip>();
  private readonly pending = new Set<string>();
  private voiceSource: AudioSource | null = null;
  private readonly voiceQueue: Array<{ path: string; volume: number; beforeSound?: GameSound }> = [];
  private voicePlaying = false;
  private voiceGeneration = 0;
  private readonly lastSoundAt = new Map<GameSound, number>();
  settings: VoiceSettings = { ...DefaultVoiceSettings };

  attach(host: Node): void {
    this.source = host.getComponent(AudioSource) || host.addComponent(AudioSource);
    this.source.volume = 1;
    const voiceSource = host.getComponents(AudioSource).find((item) => item !== this.source)
      || host.addComponent(AudioSource);
    voiceSource.volume = this.settings.volume;
    this.voiceSource = voiceSource;
    this.preloadVoices();
  }

  private preloadVoices(): void {
    [...new Set(Object.values(VOICE_PATHS))].forEach((path) => {
      if (this.clips.has(path) || this.pending.has(path)) return;
      this.pending.add(path);
      resources.load(path, AudioClip, (err, clip) => {
        this.pending.delete(path);
        if (!err && clip) this.clips.set(path, clip);
        else console.warn(`[GameAudio] failed to preload voice: ${path}`, err);
        this.drainVoiceQueue();
      });
    });
  }

  detach(): void {
    this.source?.stop();
    this.voiceSource?.stop();
    this.source = null;
    this.voiceSource = null;
    this.voiceGeneration += 1;
    this.voiceQueue.length = 0;
    this.voicePlaying = false;
  }

  play(sound: GameSound, volume = 0.65): void {
    const source = this.source;
    if (!source) return;

    const now = Date.now();
    const cooldownMs = sound === 'tileDiscard' ? 260 : sound === 'meld' ? 180 : 0;
    const lastPlayedAt = this.lastSoundAt.get(sound) ?? 0;
    if (cooldownMs > 0 && now - lastPlayedAt < cooldownMs) return;
    this.lastSoundAt.set(sound, now);

    const path = SOUND_PATHS[sound];
    const cached = this.clips.get(path);
    if (cached) {
      source.playOneShot(cached, volume);
      return;
    }
    if (this.pending.has(path)) return;
    this.pending.add(path);

    resources.load(path, AudioClip, (err, clip) => {
      this.pending.delete(path);
      if (err || !clip) {
        console.warn(`[GameAudio] failed to load sound: ${path}`, err);
        return;
      }
      this.clips.set(path, clip);
      if (this.source === source) source.playOneShot(clip, volume);
    });
  }

  /** 按顺序播报一组语音（如 碰 + 六万），避免互相打断。 */
  playVoice(keys: VoiceKey[], volume = this.settings.volume, mode: VoiceQueueMode = 'append'): void {
    this.enqueueVoice(keys, volume, mode);
  }

  /** Keeps an action/impact sound and its spoken announcement in one queue slot. */
  announceVoice(
    keys: VoiceKey[],
    beforeSound: GameSound,
    volume = this.settings.volume,
    mode: VoiceQueueMode = 'append',
  ): void {
    this.enqueueVoice(keys, volume, mode, beforeSound);
  }

  private enqueueVoice(
    keys: VoiceKey[],
    volume: number,
    mode: VoiceQueueMode,
    beforeSound?: GameSound,
  ): void {
    if (!this.settings.enabled || !this.voiceSource) return;
    const requests = keys
      .filter((key) => VOICE_PATHS[key] !== undefined)
      .map((key, index) => ({
        path: VOICE_PATHS[key],
        volume,
        beforeSound: index === 0 ? beforeSound : undefined,
      }));
    if (requests.length === 0) return;

    if (mode === 'replace') {
      this.voiceGeneration += 1;
      this.voiceSource.stop();
      this.voiceQueue.length = 0;
      this.voicePlaying = false;
    }

    if (this.voiceQueue.length + requests.length > this.settings.maxQueueLength) {
      const overflow = this.voiceQueue.length + requests.length - this.settings.maxQueueLength;
      this.voiceQueue.splice(0, Math.min(overflow, this.voiceQueue.length));
      const remainingSlots = this.settings.maxQueueLength - this.voiceQueue.length;
      requests.splice(0, Math.max(0, requests.length - remainingSlots));
    }
    this.voiceQueue.push(...requests);
    this.drainVoiceQueue();
  }

  private drainVoiceQueue(): void {
    if (this.voicePlaying || this.voiceQueue.length === 0) return;
    const source = this.voiceSource;
    if (!source) {
      this.voiceQueue.length = 0;
      return;
    }
    const generation = this.voiceGeneration;

    const request = this.voiceQueue[0];
    if (this.pending.has(request.path)) {
      // 该语音正在加载，等加载回调继续排空队列，不丢请求。
      setTimeout(() => {
        if (this.voiceGeneration === generation) this.drainVoiceQueue();
      }, 60);
      return;
    }

    const cached = this.clips.get(request.path);
    if (cached) {
      this.voiceQueue.shift();
      this.playVoiceCached(source, generation, request, cached);
      return;
    }
    this.pending.add(request.path);
    resources.load(request.path, AudioClip, (err, clip) => {
      this.pending.delete(request.path);
      if (this.voiceSource !== source || this.voiceGeneration !== generation) {
        if (!err && clip) this.clips.set(request.path, clip);
        this.drainVoiceQueue();
        return;
      }
      if (err || !clip) {
        this.voiceQueue.shift();
        console.warn(`[GameAudio] failed to load voice: ${request.path}`, err);
        this.drainVoiceQueue();
        return;
      }
      this.clips.set(request.path, clip);
      this.drainVoiceQueue();
    });
  }

  private playVoiceCached(
    source: AudioSource,
    generation: number,
    request: { path: string; volume: number; beforeSound?: GameSound },
    clip: AudioClip,
  ): void {
    if (this.voiceSource !== source || this.voiceGeneration !== generation) return;
    this.voicePlaying = true;
    if (request.beforeSound) this.play(request.beforeSound);
    source.clip = clip;
    source.volume = request.volume;
    source.loop = false;
    source.play();
    // WeChat may expose duration=0 briefly for a freshly downloaded remote
    // clip. Reserve a full short-announcement window so the next voice never
    // truncates the current one on first play.
    const durationMs = Math.max(850, (clip.duration || 0) * 1000);
    setTimeout(() => {
      if (this.voiceGeneration !== generation) return;
      this.voicePlaying = false;
      this.drainVoiceQueue();
    }, durationMs + this.settings.gapMs);
  }
}

export const gameAudio = new GameAudio();
