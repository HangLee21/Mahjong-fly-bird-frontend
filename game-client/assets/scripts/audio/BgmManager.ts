import { AudioClip, AudioSource, director, game, Game, input, Input, Node, resources, sys } from 'cc';
import { AudioConfig, BgmTrack } from './AudioConfig';

const FADE_FRAME_MS = 32;

class BgmManager {
  private root: Node | null = null;
  private source: AudioSource | null = null;
  private currentTrack: BgmTrack | null = null;
  private requestId = 0;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private muted = false;
  private volumeScale = 1;
  private pausedByLifecycle = false;

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
    const source = this.source;
    if (!AudioConfig.bgm.enabled || !source) return;
    if (this.currentTrack === track && source.playing) {
      this.fadeTo(this.targetVolume(track), AudioConfig.bgm.fadeInSeconds);
      return;
    }

    const requestId = ++this.requestId;
    const config = AudioConfig.tracks[track];
    const clip = await this.loadClip(config.resourcePath);
    if (!clip || requestId !== this.requestId || this.source !== source) return;

    this.stopFade();
    source.stop();
    source.clip = clip;
    source.loop = config.loop;
    source.volume = 0;
    source.play();
    this.currentTrack = track;
    this.pausedByLifecycle = false;
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
    const source = this.source;
    if (!source) return;
    ++this.requestId;
    this.fadeTo(0, AudioConfig.bgm.fadeOutSeconds, () => {
      source.stop();
      source.clip = null;
      this.currentTrack = null;
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
    const source = this.source;
    if (!source?.clip || source.playing) return;
    source.play();
    this.fadeTo(this.currentTrack ? this.targetVolume(this.currentTrack) : 0, AudioConfig.bgm.fadeInSeconds);
  }

  unlockFromGesture(): void {
    if (!AudioConfig.bgm.enabled || this.muted) return;
    const source = this.source;
    if (!source?.clip) {
      void this.play(AudioConfig.bgm.defaultTrack);
      return;
    }
    if (source.playing) return;
    source.play();
    const track = this.currentTrack || AudioConfig.bgm.defaultTrack;
    this.currentTrack = track;
    this.fadeTo(this.targetVolume(track), 0.25);
    console.log(`[BgmManager] playback unlocked by user interaction: ${track}`);
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
    if (!this.currentTrack) return;
    this.fadeTo(this.targetVolume(this.currentTrack), 0.15);
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
    const source = this.source;
    if (!source?.playing) return;
    this.stopFade();
    source.pause();
    this.pausedByLifecycle = true;
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
