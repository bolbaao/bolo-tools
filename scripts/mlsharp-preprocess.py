#!/usr/bin/env python3
"""3D 工坊 · 生成前图像预处理（提升输入清晰度与推理分辨率匹配）"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

PRESETS = {
    "standard": {"long_edge": 1536, "sharpen": 0.0, "internal": 1536},
    "high": {"long_edge": 2048, "sharpen": 0.35, "internal": 2048},
    "ultra": {"long_edge": 2048, "sharpen": 0.65, "internal": 2048},
}


def preprocess(src: Path, dst: Path, quality: str) -> dict:
    preset = PRESETS.get(quality, PRESETS["standard"])
    long_edge = preset["long_edge"]
    sharpen = preset["sharpen"]

    img = Image.open(src).convert("RGB")
    w, h = img.size
    scale = long_edge / max(w, h)
    if scale > 1.02 or scale < 0.98:
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        img = img.resize((nw, nh), Image.Resampling.LANCZOS)

    if sharpen > 0:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=int(80 + sharpen * 120), threshold=2))
        img = ImageEnhance.Sharpness(img).enhance(1.0 + sharpen * 0.35)
        img = ImageEnhance.Contrast(img).enhance(1.0 + sharpen * 0.08)

    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, quality=95, subsampling=0)
    return {
        "quality": quality,
        "input_size": [w, h],
        "output_size": list(img.size),
        "internal_size": preset["internal"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--quality", choices=tuple(PRESETS), default="standard")
    args = parser.parse_args()
    meta = preprocess(Path(args.input), Path(args.output), args.quality)
    print(
        f"preprocessed {meta['input_size'][0]}x{meta['input_size'][1]} "
        f"-> {meta['output_size'][0]}x{meta['output_size'][1]} "
        f"(internal={meta['internal_size']}, quality={meta['quality']})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
