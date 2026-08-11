import { AudioClip, AudioSource, Node, resources } from 'cc';

export type GameSound =
  | 'button'
  | 'meld'
  | 'roundStart'
  | 'tileDiscard'
  | 'tileSelect'
  | 'win'
  | 'winOthers';

const SOUND_PATHS: Record<GameSound, string> = {
  button: 'audio/sfx/ui_click',
  meld: 'audio/sfx/meld',
  roundStart: 'audio/sfx/round_start',
  tileDiscard: 'audio/sfx/tile_discard',
  tileSelect: 'audio/sfx/tile_select',
  win: 'audio/sfx/win',
  winOthers: 'audio/sfx/win_others',
};

class GameAudio {
  private source: AudioSource | null = null;
  private readonly clips = new Map<string, AudioClip>();
  private readonly pending = new Set<string>();

  attach(host: Node): void {
    this.source = host.getComponent(AudioSource) || host.addComponent(AudioSource);
    this.source.volume = 1;
  }

  detach(): void {
    this.source = null;
  }

  play(sound: GameSound, volume = 0.65): void {
    const source = this.source;
    if (!source) return;

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
}

export const gameAudio = new GameAudio();
