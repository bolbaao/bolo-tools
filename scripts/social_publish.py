#!/usr/bin/env python3
"""
实验性：通过 Playwright + Cookie 向创作者中心提交视频（需本机已登录）。

用法:
  python3 scripts/social_publish.py --job-dir data/social-publish/jobs/<id> --platform douyin

依赖:
  python3 -m pip install --user playwright
  playwright install chromium
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_netscape_cookies(path: Path, context, domain_hint: str):
    if not path.is_file():
        return False
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    batch = []
    for line in lines:
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        domain, _flag, p, secure, expires, name, value = parts[:7]
        if domain_hint not in domain:
            continue
        batch.append(
            {
                "name": name,
                "value": value,
                "domain": domain.lstrip("."),
                "path": p or "/",
                "secure": secure.upper() == "TRUE",
            }
        )
    if batch:
        context.add_cookies(batch)
    return len(batch) > 0


def parse_caption(raw: str) -> dict:
    if not raw:
        return {"title": "", "description": ""}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"title": "", "description": raw}


def publish_douyin(_page, job_dir: Path, _caption: dict) -> str:
    """已迁移至 scripts/douyin_publish.py（全自动）。"""
    script = ROOT / "scripts" / "douyin_publish.py"
    if not script.is_file():
        raise RuntimeError("未找到 scripts/douyin_publish.py")
    r = subprocess.run(
        [sys.executable, str(script), "--job-dir", str(job_dir)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=int(__import__("os").environ.get("DOUYIN_PUBLISH_TIMEOUT_MS", "900000")) // 1000 or 900,
    )
    line = (r.stdout or "").strip().split("\n")[-1] if r.stdout else ""
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        raise RuntimeError((r.stderr or r.stdout or "douyin_publish 失败")[:500])
    if not data.get("ok"):
        raise RuntimeError(data.get("error") or "抖音发布失败")
    return data.get("message") or "抖音发布完成"


def publish_weixin_channels(page, job_dir: Path, caption: dict) -> str:
    video = None
    for name in ("video.mp4", "video.mov", "video.webm"):
        p = job_dir / name
        if p.is_file():
            video = p
            break
    if not video:
        raise RuntimeError("任务目录中未找到视频文件")

    page.goto("https://channels.weixin.qq.com/platform/post/create", wait_until="domcontentloaded", timeout=120000)
    page.wait_for_timeout(2500)
    file_input = page.locator('input[type="file"]').first
    file_input.set_input_files(str(video))
    page.wait_for_timeout(4000)

    desc = caption.get("description") or caption.get("title") or ""
    for sel in ('div[contenteditable="true"]', "textarea"):
        loc = page.locator(sel).first
        if loc.count():
            loc.fill(desc[:1000])
            break
    return "已上传视频并填入描述，请在浏览器中检查并点击发表"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-dir", required=True)
    parser.add_argument("--platform", required=True)
    args = parser.parse_args()

    job_dir = Path(args.job_dir)
    if not job_dir.is_absolute():
        job_dir = ROOT / job_dir
    job_file = job_dir / "job.json"
    if not job_file.is_file():
        print(json.dumps({"ok": False, "error": "job.json 不存在"}), file=sys.stderr)
        sys.exit(1)

    job = json.loads(job_file.read_text(encoding="utf-8"))
    platform = args.platform
    cap_raw = (job.get("captions") or {}).get(platform, "")
    caption = parse_caption(cap_raw)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "未安装 playwright：python3 -m pip install --user playwright && playwright install chromium",
                }
            )
        )
        sys.exit(1)

    headed = __import__("os").environ.get("SOCIAL_PUBLISH_HEADED", "1") == "1"
    cookie_map = {
        "douyin": (ROOT / "cookies" / "douyin.txt", "douyin"),
        "weixin-channels": (ROOT / "cookies" / "yuanbao.txt", "qq.com"),
    }
    if platform not in cookie_map:
        print(json.dumps({"ok": False, "error": f"暂不支持自动发布：{platform}"}))
        sys.exit(1)

    cookie_path, domain_hint = cookie_map[platform]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        context = browser.new_context()
        load_netscape_cookies(cookie_path, context, domain_hint)
        page = context.new_page()
        if platform == "douyin":
            msg = publish_douyin(page, job_dir, caption)
        else:
            msg = publish_weixin_channels(page, job_dir, caption)
        browser.close()

    print(json.dumps({"ok": True, "message": msg}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:500]}, ensure_ascii=False))
        sys.exit(1)
