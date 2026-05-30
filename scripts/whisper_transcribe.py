#!/usr/bin/env python3
"""本地语音转写（faster-whisper），供字幕工坊调用。"""
from __future__ import annotations

import argparse
import sys


def format_srt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds % 1) * 1000))
    if ms >= 1000:
        ms = 0
        s += 1
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_vtt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds % 1) * 1000))
    if ms >= 1000:
        ms = 0
        s += 1
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def segments_to_srt(segments) -> str:
    blocks = []
    for i, seg in enumerate(segments, 1):
        text = normalize_segment_text(seg.text)
        if not text:
            continue
        blocks.append(
            f"{i}\n{format_srt_ts(seg.start)} --> {format_srt_ts(seg.end)}\n{text}\n"
        )
    return "\n".join(blocks)


def segments_to_vtt(segments) -> str:
    lines = ["WEBVTT", ""]
    for i, seg in enumerate(segments, 1):
        text = normalize_segment_text(seg.text)
        if not text:
            continue
        lines.append(str(i))
        lines.append(f"{format_vtt_ts(seg.start)} --> {format_vtt_ts(seg.end)}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def segments_to_text(segments) -> str:
    return "\n".join(
        normalize_segment_text(seg.text) for seg in segments if seg.text.strip()
    )


def to_simplified(text: str) -> str:
    if not text or not any("\u4e00" <= c <= "\u9fff" for c in text):
        return text
    try:
        import zhconv

        return zhconv.convert(text, "zh-cn")
    except ImportError:
        return text


def normalize_segment_text(text: str) -> str:
    return to_simplified(text.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper")
    parser.add_argument("audio", help="Path to wav/mp3 audio file")
    parser.add_argument(
        "--format",
        choices=("srt", "vtt", "text"),
        default="srt",
        help="Output format",
    )
    parser.add_argument(
        "--model",
        default="base",
        help="Whisper model size (tiny/base/small/medium/large-v3)",
    )
    parser.add_argument(
        "--language",
        default="auto",
        help="Spoken language code, or auto",
    )
    parser.add_argument(
        "--model-path",
        default="",
        help="Local model directory (contains model.bin)",
    )
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "未安装 faster-whisper。请运行: python3 -m pip install --user faster-whisper",
            file=sys.stderr,
        )
        return 2

    lang = None if args.language in ("auto", "") else args.language
    model_ref = args.model_path.strip() if args.model_path.strip() else args.model
    transcribe_kw: dict = {"vad_filter": True}
    if lang:
        transcribe_kw["language"] = lang
        if lang in ("zh", "yue"):
            transcribe_kw["initial_prompt"] = "以下是简体中文内容。"

    try:
        model = WhisperModel(model_ref, device="auto", compute_type="default")
        segments, _info = model.transcribe(args.audio, **transcribe_kw)
        collected = list(segments)
    except Exception as exc:  # noqa: BLE001
        print(f"转写失败: {exc}", file=sys.stderr)
        return 1

    if args.format == "srt":
        sys.stdout.write(segments_to_srt(collected))
    elif args.format == "vtt":
        sys.stdout.write(segments_to_vtt(collected))
    else:
        sys.stdout.write(segments_to_text(collected))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
