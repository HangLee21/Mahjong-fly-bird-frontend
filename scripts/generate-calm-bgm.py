#!/usr/bin/env python3
"""Generate soft, seamless ambient BGM loops for the lobby and table scenes.

The output is intentionally quiet and harmonically slow (four long sustained
chords per minute), with a gentle bell arpeggio and a low-passed air bed. The
files are fully synthesised here, so they carry no third-party audio license.
"""

from __future__ import annotations

from pathlib import Path

import lameenc
import numpy as np
from scipy.signal import butter, lfilter


SAMPLE_RATE = 44100
LOOP_SECONDS = 60.0
CHANNELS = 1
SEGMENT_SECONDS = 15.0
FADE_SECONDS = 1.5
TARGET_PEAK = 0.55
MP3_BITRATE = 160
LOOP_FUNDAMENTAL = 1.0 / LOOP_SECONDS


def note_hz(midi: int) -> float:
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def periodic_hz(midi: int) -> float:
    """Round a note to the nearest exact multiple of the loop fundamental.

    This keeps sustained pads/bass strictly periodic across the 60s loop, so
    the wrap point is identical without relying on a crossfade. The detune is
    at most 0.0083 Hz, which is inaudible for an ambient bed.
    """
    target = note_hz(midi)
    return round(target / LOOP_FUNDAMENTAL) * LOOP_FUNDAMENTAL


def build_envelope(total: int, attack: int, release: int) -> np.ndarray:
    env = np.ones(total, dtype=np.float64)
    if attack > 0:
        env[:attack] = np.linspace(0.0, 1.0, attack)
    if release > 0:
        env[-release:] = np.linspace(1.0, 0.0, release)
    return env


def pad_segment(
    midi: int,
    start_seconds: float,
    seconds: float,
    attack: float,
    release: float,
) -> np.ndarray:
    n = int(round(seconds * SAMPLE_RATE))
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    global_t = start_seconds + t
    attack_n = int(round(attack * SAMPLE_RATE))
    release_n = int(round(release * SAMPLE_RATE))
    env = build_envelope(n, attack_n, release_n)
    partials = (
        (1.0, 1.00),
        (2.0, 0.42),
        (3.0, 0.22),
        (4.0, 0.10),
        (5.0, 0.05),
    )
    out = np.zeros(n, dtype=np.float64)
    for multiple, amp in partials:
        freq = periodic_hz(midi) * multiple
        out += amp * np.sin(2.0 * np.pi * freq * global_t)
    return out * env


def bell(
    start: float,
    midi: int,
    amp: float,
) -> tuple[int, np.ndarray]:
    dur = 5.0
    n = int(round(dur * SAMPLE_RATE))
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    out = np.zeros(n, dtype=np.float64)
    partials = ((1.0, 1.0, 1.6), (2.0, 0.35, 2.4), (3.0, 0.16, 3.4))
    for multiple, partial_amp, decay in partials:
        freq = note_hz(midi) * multiple
        out += partial_amp * np.sin(2.0 * np.pi * freq * t) * np.exp(-t / decay)
    env = np.minimum(1.0, t / 0.02) * np.exp(-t / 1.8)
    out *= env * amp
    start_i = int(round(start * SAMPLE_RATE))
    return start_i, out


def air_bed(seconds: float, cutoff: float) -> np.ndarray:
    n = int(round(seconds * SAMPLE_RATE))
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    rng = np.random.default_rng(20260815)
    noise = rng.standard_normal(n)
    b, a = butter(2, cutoff / (0.5 * SAMPLE_RATE), btype="low")
    filtered = lfilter(b, a, noise)
    lfo = 0.75 + 0.25 * np.sin(2.0 * np.pi * 0.05 * t)
    fade = build_envelope(n, int(round(1.0 * SAMPLE_RATE)), int(round(1.0 * SAMPLE_RATE)))
    return filtered * lfo * fade * 0.05


def render_loop(chords: list[list[int]], bells: list[tuple[float, int, float]]) -> np.ndarray:
    total = int(round(LOOP_SECONDS * SAMPLE_RATE))
    out = np.zeros(total, dtype=np.float64)
    seg_n = int(round(SEGMENT_SECONDS * SAMPLE_RATE))
    fade_n = int(round(FADE_SECONDS * SAMPLE_RATE))

    for index, chord in enumerate(chords):
        seg = np.zeros(seg_n, dtype=np.float64)
        for midi in chord:
            seg += pad_segment(
                midi,
                index * SEGMENT_SECONDS,
                SEGMENT_SECONDS,
                FADE_SECONDS,
                FADE_SECONDS,
            )
        seg *= 0.5 / len(chord)
        start = index * seg_n - fade_n
        if start < 0:
            start += total
        for i in range(seg_n):
            out[(start + i) % total] += seg[i]

    bass = np.zeros(total, dtype=np.float64)
    for index, chord in enumerate(chords):
        seg = np.zeros(seg_n, dtype=np.float64)
        root = chord[0]
        global_t = index * SEGMENT_SECONDS + np.arange(seg_n, dtype=np.float64) / SAMPLE_RATE
        env = build_envelope(seg_n, fade_n, fade_n)
        seg += 0.32 * np.sin(2.0 * np.pi * periodic_hz(root - 12) * global_t) * env
        start = index * seg_n - fade_n
        if start < 0:
            start += total
        for i in range(seg_n):
            bass[(start + i) % total] += seg[i]

    out += bass
    for start, midi, amp in bells:
        start_i, tone = bell(start, midi, amp)
        stop_i = min(total, start_i + len(tone))
        out[start_i:stop_i] += tone[: stop_i - start_i]

    out += air_bed(LOOP_SECONDS, cutoff=720.0)
    return out


def make_seamless(samples: np.ndarray, crossfade_seconds: float) -> np.ndarray:
    """Blend the loop tail into its head and mirror the same window to the tail.

    This makes the last N samples identical to the first N samples, so the
    loop-wrap point is mathematically continuous for every layer (including
    the non-periodic air bed).
    """
    total = len(samples)
    n = int(round(crossfade_seconds * SAMPLE_RATE))
    n = min(n, total // 2)
    if n <= 0:
        return samples
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float64)
    head = samples[:n]
    tail = samples[-n:]
    blended = head * (1.0 - ramp) + tail * ramp
    samples = samples.copy()
    samples[:n] = blended
    samples[-n:] = blended
    return samples


def encode_mp3(samples: np.ndarray, out_path: Path) -> None:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(MP3_BITRATE)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(CHANNELS)
    encoder.set_quality(2)
    data = encoder.encode(pcm) + encoder.flush()
    out_path.write_bytes(data)


def normalize_peak(samples: np.ndarray, target: float) -> np.ndarray:
    peak = float(np.max(np.abs(samples)))
    if peak <= 0:
        return samples
    return samples * (target / peak)


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    out_dir = repo / "game-client" / "assets" / "resources" / "audio" / "bgm"
    out_dir.mkdir(parents=True, exist_ok=True)

    lobby_chords = [
        [57, 60, 64, 67, 71],  # Am9
        [53, 57, 60, 64, 69],  # Fmaj7
        [60, 64, 67, 71, 74],  # Cmaj7
        [55, 59, 62, 65, 67],  # G6
    ]
    lobby_bells = [
        (0.5, 76, 0.18), (4.0, 81, 0.13), (8.0, 79, 0.15),
        (16.0, 76, 0.15), (20.0, 84, 0.11), (26.0, 81, 0.12),
        (31.0, 76, 0.14), (36.0, 83, 0.12), (41.0, 79, 0.13),
        (46.0, 76, 0.15), (51.0, 81, 0.12), (56.0, 77, 0.13),
    ]

    table_chords = [
        [53, 57, 60, 64, 69],  # Fmaj7
        [57, 60, 64, 67, 72],  # Am7
        [50, 53, 57, 60, 65],  # Dm7
        [55, 59, 62, 65, 71],  # Gsus/6
    ]
    table_bells = [
        (1.0, 79, 0.14), (5.0, 76, 0.12), (9.0, 81, 0.13),
        (16.0, 79, 0.13), (21.0, 83, 0.11), (27.0, 76, 0.12),
        (32.0, 81, 0.13), (37.0, 79, 0.12), (43.0, 84, 0.10),
        (48.0, 76, 0.13), (53.0, 81, 0.12), (58.0, 77, 0.12),
    ]

    tracks = {
        "lobby_ambient": make_seamless(render_loop(lobby_chords, lobby_bells), 3.0),
        "table_ambient": make_seamless(render_loop(table_chords, table_bells), 3.0),
    }
    for name, samples in tracks.items():
        samples = normalize_peak(samples, TARGET_PEAK)
        encode_mp3(samples, out_dir / f"{name}.mp3")
        rms = float(np.sqrt(np.mean(samples**2)))
        print(f"{name}.mp3 written: peak={float(np.max(np.abs(samples))):.3f} rms={rms:.3f}")


if __name__ == "__main__":
    main()
