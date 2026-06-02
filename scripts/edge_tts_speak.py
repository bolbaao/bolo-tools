#!/usr/bin/env python3
"""edge-tts 语音合成，供 AI 剪口播调用。"""
from __future__ import annotations

import argparse
import asyncio
import sys


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True, help="待合成文本")
    parser.add_argument("--voice", default="zh-CN-XiaoxiaoNeural")
    parser.add_argument("--output", required=True, help="输出音频路径 (.mp3)")
    parser.add_argument("--rate", default="+0%", help="语速，如 +10% / -5%")
    args = parser.parse_args()

    text = args.text.strip()
    if not text:
        print("empty text", file=sys.stderr)
        return 2

    try:
        import edge_tts
    except ImportError:
        print("edge_tts not installed", file=sys.stderr)
        return 3

    communicate = edge_tts.Communicate(text, args.voice, rate=args.rate)
    await communicate.save(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
