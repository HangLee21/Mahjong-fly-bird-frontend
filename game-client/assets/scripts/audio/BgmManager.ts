import { AudioClip, AudioSource, director, game, Game, input, Input, Node, resources, sys } from 'cc';
import { AudioConfig, BgmTrack } from './AudioConfig';
import { GeneratedAudioUrls } from '../app/GeneratedAudioUrls';
import { ExperienceEnvironment } from '../app/ExperienceEnvironment';

interface WxInnerAudioContext {
  src: string;
  loop: boolean;
  volume: number;
  obeyMuteSwitch?: boolean;
  play(): void;
  pause(): void;
  stop(): void;
  destroy(): void;
  onError?(callback: (error: unknown) => void): void;
  onEnded?(callback: () => void): void;
  onCanplay?(callback: () => void): void;
  onPlay?(callback: () => void): void;
}

interface WxDownloadResult {
  statusCode?: number;
  tempFilePath?: string;
}

interface WxRequestOptions {
  url: string;
  method: string;
  data?: unknown;
  header?: Record<string, string>;
  fail?: () => void;
}

interface WxApi {
  createInnerAudioContext?(options?: { autoplay?: boolean }): WxInnerAudioContext;
  setInnerAudioOption?(options: { obeyMuteSwitch: boolean }): void;
  downloadFile?(options: {
    url: string;
    success: (result: WxDownloadResult) => void;
    fail: (error: unknown) => void;
  }): void;
  request?(options: WxRequestOptions): void;
}

const FADE_FRAME_MS = 32;
const WX_CONFIRM_DELAY_MS = 2500;

class BgmManager {
  private root: Node | null = null;
  private source: AudioSource | null = null;
  private wxContext: WxInnerAudioContext | null = null;
  private wxActive = false;
  private wxPlayingConfirmed = false;
  private wxErrored = false;
  private wxTrackUrl = '';
  private currentTrack: BgmTrack | null = null;
  private requestId = 0;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private wxRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private muted = false;
  private volumeScale = 1;
  private pausedByLifecycle = false;
  private gestureUnlocked = false;
  private readonly clips = new Map<BgmTrack, AudioClip>();
  private readonly downloadedUrls = new Map<string, string>();

  initialize(sceneRoot: Node): void {
    if (this.root) return;

    this.restorePreferences();
    const audioRoot = new Node('GlobalBgmRoot');
    const scene = sceneRoot.parent;
    if (scene) {
      scene.addChild(audioRoot);
      director.addPersistRootNode(audioRoot);
    } else {
      sceneRoot.addChild(audioRoot);
      console.warn('[BgmManager] scene root has no parent; BGM will not persist across scenes');
    }

    const source = audioRoot.addComponent(AudioSource);
    source.playOnAwake = false;
    source.volume = 0;
    this.root = audioRoot;
    this.source = source;
    game.on(Game.EVENT_HIDE, this.handleHide, this);
    game.on(Game.EVENT_SHOW, this.handleShow, this);
    input.on(Input.EventType.TOUCH_START, this.handleUserGesture, this);
    input.on(Input.EventType.MOUSE_DOWN, this.handleUserGesture, this);
    this.applyWxAudioOptions();
    this.log('info', `initialized muted=${this.muted} volumeScale=${this.volumeScale}`);

    if (AudioConfig.bgm.enabled && AudioConfig.bgm.autoPlay) {
      void this.play(AudioConfig.bgm.defaultTrack);
    }
  }

  async play(track: BgmTrack): Promise<void> {
    if (!AudioConfig.bgm.enabled) return;
    const requestId = ++this.requestId;
    const config = AudioConfig.tracks[track];
    const cached = this.clips.get(track);
    const clip = cached ?? await this.loadClip(config.resourcePath);
    if (!clip || requestId !== this.requestId) return;
    this.clips.set(track, clip);
    this.currentTrack = track;
    this.pausedByLifecycle = false;

    const url = GeneratedAudioUrls.bgm[track]
      || (clip as unknown as { nativeUrl?: string }).nativeUrl
      || '';
    const wxApi = this.wxApi();
    if (wxApi?.createInnerAudioContext && url) {
      // WeChat: drive BGM through wx InnerAudioContext with confirmed-playback
      // retries. The engine AudioSource cannot confirm whether audio actually
      // started, and Android WeChat is known to swallow the first play().
      this.stopFade();
      this.startWxBgm(track, url, config.loop);
      return;
    }

    const source = this.source;
    if (!source) return;
    this.wxActive = false;
    this.stopFade();
    source.stop();
    source.clip = clip;
    source.loop = config.loop;
    source.volume = 0;
    source.play();
    this.fadeTo(this.targetVolume(track), AudioConfig.bgm.fadeInSeconds);
    this.log('info', `play requested ${track} (engine AudioSource)`);
    setTimeout(() => {
      if (this.source !== source || this.currentTrack !== track) return;
      if (source.playing) this.log('info', `playback active ${track} (engine AudioSource)`);
      else this.log('warn', 'playback is waiting for the first user interaction');
    }, 120);
  }

  stop(): void {
    ++this.requestId;
    this.currentTrack = null;
    this.clearWxRetry();
    if (this.wxContext && this.wxActive) {
      this.wxContext.stop();
      this.wxActive = false;
      this.wxPlayingConfirmed = false;
      return;
    }
    const source = this.source;
    if (!source) return;
    this.fadeTo(0, AudioConfig.bgm.fadeOutSeconds, () => {
      source.stop();
      source.clip = null;
    });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    sys.localStorage.setItem(AudioConfig.bgm.storageKeys.muted, muted ? '1' : '0');
    this.refreshVolume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolumeScale(volume: number): void {
    this.volumeScale = this.clamp(volume);
    sys.localStorage.setItem(AudioConfig.bgm.storageKeys.volume, String(this.volumeScale));
    this.refreshVolume();
  }

  getVolumeScale(): number {
    return this.volumeScale;
  }

  resume(): void {
    if (this.wxContext && this.wxActive) {
      this.wxContext.play();
      return;
    }
    const source = this.source;
    if (!source?.clip || source.playing) return;
    source.play();
    this.fadeTo(this.currentTrack ? this.targetVolume(this.currentTrack) : 0, AudioConfig.bgm.fadeInSeconds);
  }

  unlockFromGesture(): void {
    if (!AudioConfig.bgm.enabled || this.muted) return;
    if (this.wxApi()?.createInnerAudioContext && this.wxActive) {
      const track = this.currentTrack;
      if (!track) return;
      const url = this.wxTrackUrl || GeneratedAudioUrls.bgm[track] || '';
      const loop = AudioConfig.tracks[track].loop;
      this.log('info', `gesture track=${track} confirmed=${this.wxPlayingConfirmed} errored=${this.wxErrored}`);
      if (this.wxErrored || !this.wxContext) {
        this.startWxBgm(track, url, loop);
        return;
      }
      if (!this.wxPlayingConfirmed) {
        // Android WeChat: a context created before the first interaction may
        // never emit sound. Recreate it inside the gesture with autoplay.
        this.destroyWxContext();
        this.startWxBgm(track, url, loop, true);
      }
      return;
    }

    const source = this.source;
    if (!source?.clip) {
      void this.play(AudioConfig.bgm.defaultTrack);
      return;
    }
    if (this.gestureUnlocked) {
      if (!source.playing) source.play();
      return;
    }
    this.gestureUnlocked = true;
    // The boot autoplay may have been silently suspended by the platform until
    // the first user interaction, so force a clean restart on the first gesture.
    source.stop();
    source.play();
    const track = this.currentTrack || AudioConfig.bgm.defaultTrack;
    this.currentTrack = track;
    this.fadeTo(this.targetVolume(track), 0.25);
    this.log('info', `playback unlocked by user interaction ${track}`);
  }

  private startWxBgm(track: BgmTrack, url: string, loop: boolean, autoplay = false): void {
    this.wxActive = true;
    this.wxPlayingConfirmed = false;
    this.wxErrored = false;
    this.wxTrackUrl = url;
    this.clearWxRetry();
    const context = this.wxContext ?? this.createWxContext(autoplay);
    if (!context) {
      this.log('error', 'failed to create wx inner audio context');
      return;
    }
    this.log('info', `startWxBgm ${track} autoplay=${autoplay} src=${url.slice(-40)}`);

    const playSrc = (src: string): void => {
      if (this.wxContext !== context || this.currentTrack !== track) return;
      context.loop = loop;
      context.obeyMuteSwitch = false;
      context.volume = this.targetVolume(track);
      context.src = src;
      context.play();
      this.log('info', `wx BGM play requested ${track} src=${src.startsWith('http') ? 'remote' : 'temp'}`);
      this.scheduleWxRetry(track, () => this.retryWxBgm(track, url, loop));
    };

    const cached = this.downloadedUrls.get(url);
    if (cached) {
      playSrc(cached);
      return;
    }
    const api = this.wxApi();
    if (api?.downloadFile && /^https?:\/\//.test(url)) {
      api.downloadFile({
        url,
        success: (result) => {
          if (this.currentTrack !== track) return;
          this.log('info', `BGM download OK status=${result.statusCode ?? 'unknown'} temp=${result.tempFilePath ? 'yes' : 'no'}`);
          if (result.tempFilePath) {
            this.downloadedUrls.set(url, result.tempFilePath);
            playSrc(result.tempFilePath);
            return;
          }
          playSrc(url);
        },
        fail: (error) => {
          this.log('warn', `BGM download failed, using direct URL: ${String(error)}`);
          playSrc(url);
        },
      });
      return;
    }
    playSrc(url);
  }

  private retryWxBgm(track: BgmTrack, url: string, loop: boolean): void {
    if (this.wxPlayingConfirmed || this.wxErrored || this.currentTrack !== track || !this.wxActive) return;
    const context = this.wxContext;
    if (!context) {
      this.startWxBgm(track, url, loop);
      return;
    }
    this.log('warn', `wx BGM not confirmed, replaying ${track}`);
    context.play();
    this.scheduleWxRetry(track, () => {
      if (this.wxPlayingConfirmed || this.wxErrored || this.currentTrack !== track || !this.wxActive) return;
      this.log('warn', `wx BGM still not confirmed, recreating context ${track}`);
      this.destroyWxContext();
      this.startWxBgm(track, url, loop);
    });
  }

  private createWxContext(autoplay = false): WxInnerAudioContext | null {
    const api = this.wxApi();
    if (!api?.createInnerAudioContext) return null;
    const context = api.createInnerAudioContext(autoplay ? { autoplay: true } : undefined);
    context.onCanplay?.(() => {
      this.wxPlayingConfirmed = true;
      this.clearWxRetry();
      this.log('info', 'wx BGM onCanplay');
      context.play();
    });
    context.onPlay?.(() => {
      this.wxPlayingConfirmed = true;
      this.clearWxRetry();
      this.log('info', 'wx BGM onPlay');
    });
    context.onError?.((error) => {
      this.wxErrored = true;
      this.clearWxRetry();
      this.log('error', `wx BGM inner audio error: ${String(error)}`);
      const url = this.wxTrackUrl;
      const track = this.currentTrack;
      this.destroyWxContext();
      if (track && url) {
        this.log('warn', 'recreating wx BGM after error');
        this.startWxBgm(track, url, AudioConfig.tracks[track].loop);
      }
    });
    context.onEnded?.(() => {
      if (this.wxContext === context) context.play();
    });
    this.wxContext = context;
    return context;
  }

  private destroyWxContext(): void {
    const context = this.wxContext;
    this.wxContext = null;
    this.wxActive = false;
    this.wxPlayingConfirmed = false;
    this.wxErrored = false;
    this.clearWxRetry();
    context?.destroy();
  }

  private scheduleWxRetry(track: BgmTrack, callback: () => void): void {
    this.clearWxRetry();
    this.wxRetryTimer = setTimeout(() => {
      this.wxRetryTimer = null;
      callback();
    }, WX_CONFIRM_DELAY_MS);
  }

  private clearWxRetry(): void {
    if (!this.wxRetryTimer) return;
    clearTimeout(this.wxRetryTimer);
    this.wxRetryTimer = null;
  }

  private wxApi(): WxApi | null {
    return (globalThis as { wx?: WxApi }).wx ?? null;
  }

  private applyWxAudioOptions(): void {
    // Best effort: BGM should keep playing even when the phone's silent switch
    // is on (WeChat's default may otherwise mute InnerAudioContext).
    this.wxApi()?.setInnerAudioOption?.({ obeyMuteSwitch: false });
  }

  private loadClip(path: string): Promise<AudioClip | null> {
    return new Promise((resolve) => {
      resources.load(path, AudioClip, (err, clip) => {
        if (err || !clip) {
          console.warn(`[BgmManager] failed to load BGM: ${path}`, err);
          resolve(null);
          return;
        }
        resolve(clip);
      });
    });
  }

  private refreshVolume(): void {
    const track = this.currentTrack;
    if (!track) return;
    if (this.wxContext && this.wxActive) {
      this.wxContext.volume = this.targetVolume(track);
      return;
    }
    this.fadeTo(this.targetVolume(track), 0.15);
  }

  private targetVolume(track: BgmTrack): number {
    if (this.muted) return 0;
    return this.clamp(AudioConfig.tracks[track].volume * this.volumeScale);
  }

  private fadeTo(target: number, durationSeconds: number, onComplete?: () => void): void {
    const source = this.source;
    if (!source) return;
    this.stopFade();

    const start = source.volume;
    const targetVolume = this.clamp(target);
    const durationMs = Math.max(0, durationSeconds * 1000);
    if (durationMs === 0 || Math.abs(start - targetVolume) < 0.001) {
      source.volume = targetVolume;
      onComplete?.();
      return;
    }

    const startedAt = Date.now();
    this.fadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      source.volume = start + (targetVolume - start) * progress;
      if (progress >= 1) {
        this.stopFade();
        onComplete?.();
      }
    }, FADE_FRAME_MS);
  }

  private stopFade(): void {
    if (!this.fadeTimer) return;
    clearInterval(this.fadeTimer);
    this.fadeTimer = null;
  }

  private restorePreferences(): void {
    this.muted = sys.localStorage.getItem(AudioConfig.bgm.storageKeys.muted) === '1';
    const storedValue = sys.localStorage.getItem(AudioConfig.bgm.storageKeys.volume);
    const storedVolume = storedValue === null ? Number.NaN : Number(storedValue);
    this.volumeScale = Number.isFinite(storedVolume) && storedVolume >= 0
      ? this.clamp(storedVolume)
      : 1;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    const prefixed = `[BgmManager] ${message}`;
    if (level === 'warn') console.warn(prefixed);
    else if (level === 'error') console.error(prefixed);
    else console.log(prefixed);
    this.postClientLog(level, prefixed);
  }

  private postClientLog(level: 'info' | 'warn' | 'error', message: string): void {
    const api = this.wxApi();
    if (!api?.request) return;
    try {
      api.request({
        url: `${ExperienceEnvironment.SERVER_ORIGIN}/api/debug/client-log`,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { level, msg: message },
        fail: () => undefined,
      });
    } catch {
      // Log relay must never break the game.
    }
  }

  private readonly handleHide = (): void => {
    this.pausedByLifecycle = true;
    if (this.wxContext && this.wxActive) {
      this.wxContext.pause();
      return;
    }
    const source = this.source;
    if (!source?.playing) return;
    this.stopFade();
    source.pause();
  };

  private readonly handleShow = (): void => {
    if (!this.pausedByLifecycle) return;
    this.pausedByLifecycle = false;
    this.resume();
  };

  private readonly handleUserGesture = (): void => {
    this.unlockFromGesture();
  };
}

export const bgmManager = new BgmManager();
