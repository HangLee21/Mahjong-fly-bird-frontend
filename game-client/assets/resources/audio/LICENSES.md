# Audio licenses

The sound effects in `sfx/` are selected from Kenney asset packs and are
licensed under Creative Commons Zero (CC0 1.0).

| Local file | Source pack | Original file |
| --- | --- | --- |
| `ui_click.mp3` | UI Audio | `click1.ogg` |
| `tile_select.mp3` | Casino Audio | `card-slide-1.ogg` |
| `tile_discard.mp3` | Casino Audio | `card-place-1.ogg` |
| `meld.mp3` | Casino Audio | `chips-collide-2.ogg` |
| `round_start.mp3` | Casino Audio | `card-shuffle.ogg` |
| `win.mp3` | Music Jingles | `jingles_PIZZI07.ogg` |

Sources:

- https://kenney.nl/assets/ui-audio
- https://kenney.nl/assets/casino-audio
- https://kenney.nl/assets/music-jingles
- https://creativecommons.org/publicdomain/zero/1.0/

The original OGG files were transcoded to mono MP3 for broader WeChat
mini-game device compatibility. Kenney attribution is optional, but this file
is retained for provenance.

## Background music

| Local file | Title | Author | License |
| --- | --- | --- | --- |
| `bgm/table_ambient.mp3` | Happy Lullaby (song17) | The Cynic Project / cynicmusic | CC0 1.0 |

Source:

- https://opengameart.org/content/happy-lullaby-song17

The track is a small, calm, loop-friendly placeholder for the table ambience.
It may be replaced later without code changes by keeping the same resource
path, or by changing `AudioConfig.tracks.tableAmbient.resourcePath`.
