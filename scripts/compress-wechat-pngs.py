#!/usr/bin/env python3
"""Batch-compress the WeChat remote-bundle PNG sources.

Resizes oversized textures (LANCZOS, capped at --max-dim) and quantizes with
pngquant while preserving the alpha channel. Falls back to a lossless
Pillow re-encode when pngquant fails. Files are replaced in place; the
originals are recoverable from git.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image


def collect_pngs(root):
    out = []
    for dirpath, _dirs, names in os.walk(root):
        for name in sorted(names):
            if name.lower().endswith(".png"):
                out.append(os.path.join(dirpath, name))
    return out


def pill_fallback(path, work, tmpdir):
    """Lossless re-encode as a fallback when pngquant cannot process a file."""
    out = os.path.join(tmpdir, os.path.basename(path) + ".fallback.png")
    with Image.open(work) as im:
        im.save(out, optimize=True, compress_level=9)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--root",
        default=r"E:\Mahjong-fly-bird-frontend\game-client\assets\resources",
    )
    ap.add_argument("--max-dim", type=int, default=2048)
    ap.add_argument(
        "--pngquant",
        default=r"E:\Mahjong-fly-bird-frontend\.tmp\pngquant\pngquant\pngquant.exe",
    )
    ap.add_argument("--quality", default="70-95")
    args = ap.parse_args()

    pngs = collect_pngs(args.root)
    total_before = sum(os.path.getsize(p) for p in pngs)
    resized = quantized = fallback = failed = 0
    rows = []
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(args.root))))
    tmp_base = os.path.join(repo_root, ".tmp", "png-work")
    os.makedirs(tmp_base, exist_ok=True)
    tmpdir = tempfile.mkdtemp(prefix="png-compress-", dir=tmp_base)

    for path in pngs:
        before = os.path.getsize(path)
        work = path
        try:
            with Image.open(path) as im:
                width, height = im.size
                longest = max(width, height)
                if longest > args.max_dim:
                    scale = args.max_dim / longest
                    new_w = max(1, round(width * scale))
                    new_h = max(1, round(height * scale))
                    resized_img = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    work = os.path.join(tmpdir, os.path.basename(path) + ".resized.png")
                    resized_img.save(work)
                    resized_img.close()
                    resized += 1

            out = os.path.join(tmpdir, os.path.basename(path) + ".out.png")
            cmd = [
                args.pngquant,
                "--quality=" + args.quality,
                "--speed=3",
                "--force",
                "--strip",
                "--output",
                out,
                work,
            ]
            result = subprocess.run(cmd, capture_output=True)
            if result.returncode != 0 or not os.path.exists(out) or os.path.getsize(out) == 0:
                out = pill_fallback(path, work, tmpdir)
                fallback += 1

            after = os.path.getsize(out)
            if after < before:
                os.replace(out, path)
                quantized += 1
            else:
                os.remove(out)
            if work != path and os.path.exists(work):
                os.remove(work)
            rows.append((path, before, min(after, before)))
        except Exception as exc:  # noqa: BLE001 - keep the batch going
            failed += 1
            print(f"ERROR {path}: {exc}", file=sys.stderr)
            if work != path and os.path.exists(work):
                try:
                    os.remove(work)
                except OSError:
                    pass

    total_after = sum(os.path.getsize(p) for p in pngs)
    print(f"PNGs processed: {len(pngs)}")
    print(f"resized: {resized} | quantized: {quantized} | pill-fallback: {fallback} | failed: {failed}")
    print(
        f"Total: {total_before / 1e6:.2f} MB -> {total_after / 1e6:.2f} MB "
        f"({100 * (1 - total_after / total_before):.1f}% saved)"
    )
    if rows:
        rows.sort(key=lambda r: r[1] - r[2], reverse=True)
        print("\ntop 15 savings:")
        for path, b, a in rows[:15]:
            rel = os.path.relpath(path, args.root)
            print(f"  {rel}: {b / 1e6:6.2f} -> {a / 1e6:6.2f} MB")
    shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()
