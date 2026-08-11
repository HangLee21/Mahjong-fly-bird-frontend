import { AudioClip, AudioSource, director, game, Game, input, Input, Node, resources, sys } from 'cc';
import { AudioConfig, BgmTrack } from './AudioConfig';
import { GeneratedAudioUrls } from '../app/GeneratedAudioUrls';

interface WxInnerAudioContext {
  src: string;
  loop: boolean;
  volume: number;
  play(): void;
  pause(): void;
  stop(): void;
  destroy(): void;
  onError?(callback: (error: unknown) => void): void;
  onEnded?(callback: () => void): void;
}

interface WxDownloadResult {
  statusCode?: number;
  tempFilePath?: string;
}

interface WxApi {
  createInnerAudioContext?(): WxInnerAudioContext;
  downloadFile?(options: {
    url: string;
    success: (result: WxDownloadResult) => void;
    fail: (error: unknown) => void;
  }): void;
}

const FADE_FRAME_MS = 32;

class BgmManager {
  private root: Node | null = null;
  private source: AudioSource | null = null;
  private wxContext: WxInnerAudioContext | null = null;
  private currentTrack: BgmTrack | null = null;
  private requestId = 0;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
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
    console.log(`[BgmManager] initialized, muted=${this.muted}, volumeScale=${this.volumeScale}`);

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

    const wxContext = this.wxContext ?? this.tryCreateWxContext();
    const url = GeneratedAudioUrls.bgm[track]
      || (clip as unknown as { nativeUrl?: string }).nativeUrl
      || '';
    if (wxContext && url) {
      this.playWxTrack(wxContext, url, config.loop, track);
      return;
    }

    const source = this.source;
    if (!source) return;
    this.stopFade();
    source.stop();
    source.clip = clip;
    source.loop = config.loop;
    source.volume = 0;
    source.play();
    this.fadeTo(this.targetVolume(track), AudioConfig.bgm.fadeInSeconds);
    console.log(`[BgmManager] play requested: ${track}, targetVolume=${this.targetVolume(track)}`);
    setTimeout(() => {
      if (this.source !== source || this.currentTrack !== track) return;
      if (source.playing) {
        console.log(`[BgmManager] playback active: ${track}`);
      } else {
        console.warn('[BgmManager] playback is waiting for the first user interaction');
      }
    }, 120);
  }

  stop(): void {
    ++this.requestId;
    this.currentTrack = null;
    if (this.wxContext) {
      this.wxContext.stop();
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
    if (this.wxContext) {
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
    if (this.wxContext) {
      if (!this.gestureUnlocked) {
        this.gestureUnlocked = true;
        this.wxContext.play();
        console.log('[BgmManager] wx BGM unlocked by user interaction');
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
    console.log(`[BgmManager] playback unlocked by user interaction: ${track}`);
  }

  private tryCreateWxContext(): WxInnerAudioContext | null {
    const api = this.wxApi();
    if (!api?.createInnerAudioContext) return null;
    const context = api.createInnerAudioContext();
    context.onError?.((error) => console.warn('[BgmManager] inner audio error', error));
    context.onEnded?.(() => {
      if (this.wxContext === context) context.play();
    });
    this.wxContext = context;
    return context;
  }

  private wxApi(): WxApi | null {
    return (globalThis as { wx?: WxApi }).wx ?? null;
  }

  private playWxTrack(context: WxInnerAudioContext, url: string, loop: boolean, track: BgmTrack): void {
    const setAndPlay = (src: string): void => {
      if (this.wxContext !== context) return;
      context.loop = loop;
      context.src = src;
      context.volume = this.targetVolume(track);
      context.play();
      console.log(`[BgmManager] wx BGM started: ${track} (${src})`);
    };

    // Download to a local temp file first, mirroring how the engine plays
    // remote sound effects reliably; fall back to the direct URL on failure.
    const cached = this.downloadedUrls.get(url);
    if (cached) {
      setAndPlay(cached);
      return;
    }
    if (/^https?:\/\//.test(url)) {
      const api = this.wxApi();
      if (api?.downloadFile) {
        api.downloadFile({
          url,
          success: (result) => {
            if (result.tempFilePath) {
              this.downloadedUrls.set(url, result.tempFilePath);
              setAndPlay(result.tempFilePath);
              return;
            }
            setAndPlay(url);
          },
          fail: (error) => {
            console.warn('[BgmManager] download failed, using direct URL', error);
            setAndPlay(url);
          },
        });
        return;
      }
    }
    setAndPlay(url);
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
    if (this.wxContext) {
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

  private readonly handleHide = (): void => {
    this.pausedByLifecycle = true;
    if (this.wxContext) {
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
