#!/usr/bin/env python3
"""批量生成麻将报牌语音（edge-tts）。

生成"吃/碰/杠/胡"等动作词，以及 1-9 筒/条/万 全部牌面报牌词，
输出 mp3 到 game-client/assets/resources/audio/voice/，
同时生成 voice_manifest.json 供前端映射使用。

用法：
    python scripts/generate-mahjong-voices.py                     # 默认晓晓女声
    python scripts/generate-mahjong-voices.py --voice zh-CN-YunxiNeural --rate +15%
    python scripts/generate-mahjong-voices.py --sample            # 只生成少量样例试听
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

# 动作/特殊报牌词
ACTIONS: list[tuple[str, str]] = [
    ("chi", "吃"),
    ("peng", "碰"),
    ("gang", "杠"),
    ("hu", "胡"),
    ("zi_mo", "自摸"),
    ("gang_shang_hua", "杠上花"),
    ("qiang_gang_hu", "抢杠胡"),
    ("wu_ji", "无鸡"),
    ("guo", "过"),
    ("ting", "听牌"),
]

# 牌面报牌词：一筒...九筒 / 一条...九条 / 一万...九万
TILE_NUMS: list[tuple[str, str]] = [
    ("yi", "一"),
    ("er", "二"),
    ("san", "三"),
    ("si", "四"),
    ("wu", "五"),
    ("liu", "六"),
    ("qi", "七"),
    ("ba", "八"),
    ("jiu", "九"),
]
TILE_SUITS: list[tuple[str, str]] = [
    ("tong", "筒"),
    ("tiao", "条"),
    ("wan", "万"),
]

HONOR_TILES: list[tuple[str, str]] = [
    ("dong", "\u4e1c"),
    ("nan", "\u5357"),
    ("xi", "\u897f"),
    ("bei", "\u5317"),
    ("zhong", "\u7ea2\u4e2d"),
    ("fa", "\u53d1\u8d22"),
    ("bai", "\u767d\u677f"),
]


def build_wordlist() -> list[tuple[str, str]]:
    words: list[tuple[str, str]] = list(ACTIONS)
    for num_key, num_text in TILE_NUMS:
        for suit_key, suit_text in TILE_SUITS:
            words.append((f"{num_key}_{suit_key}", f"{num_text}{suit_text}"))
    words.extend(HONOR_TILES)
    return words


def synthesize(
    text: str,
    out_path: Path,
    voice: str,
    rate: str,
    retries: int = 3,
) -> bool:
    """调用 edge-tts 生成单个 mp3，失败自动重试。"""
    cmd = [
        sys.executable,
        "-m",
        "edge_tts",
        "--voice",
        voice,
        "--rate",
        rate,
        "--text",
        text,
        "--write-media",
        str(out_path),
    ]
    for attempt in range(1, retries + 1):
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=60)
            if out_path.exists() and out_path.stat().st_size > 0:
                return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass
        time.sleep(0.8 * attempt)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="批量生成麻将报牌语音")
    parser.add_argument(
        "--voice",
        default="zh-CN-XiaoxiaoNeural",
        help="edge-tts 中文语音，默认 zh-CN-XiaoxiaoNeural（晓晓）",
    )
    parser.add_argument(
        "--rate",
        default="+10%",
        help="语速调整，默认 +10% 让报牌更干脆",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "game-client/assets/resources/audio/voice",
        help="输出目录，默认 game-client/assets/resources/audio/voice",
    )
    parser.add_argument(
        "--sample",
        action="store_true",
        help="只生成样例（吃/碰/杠/胡 + 每花色一张牌）用于试听",
    )
    args = parser.parse_args()

    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    words = build_wordlist()
    if args.sample:
        sample_keys = {
            "chi",
            "peng",
            "gang",
            "hu",
            "zi_mo",
            "yi_tong",
            "yi_tiao",
            "yi_wan",
            "wu_tong",
            "jiu_wan",
        }
        words = [w for w in words if w[0] in sample_keys]

    manifest: list[dict[str, str]] = []
    failed: list[tuple[str, str]] = []

    for key, text in words:
        file_name = f"{key}.mp3"
        out_path = out_dir / file_name
        if synthesize(text, out_path, args.voice, args.rate):
            manifest.append(
                {
                    "key": key,
                    "text": text,
                    "file": file_name,
                    "voice": args.voice,
                    "rate": args.rate,
                }
            )
            print(f"OK   {text:>4} -> {file_name}")
        else:
            failed.append((key, text))
            print(f"FAIL {text:>4} -> {file_name}", file=sys.stderr)
        time.sleep(0.15)

    manifest_path = out_dir / "voice_manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "voice": args.voice,
                "rate": args.rate,
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "count": len(manifest),
                "items": manifest,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"\n生成完成：{len(manifest)}/{len(words)} 个文件 -> {out_dir}")
    print(f"清单：{manifest_path}")
    if failed:
        print(f"失败 {len(failed)} 个：{[text for _, text in failed]}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
