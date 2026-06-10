#!/usr/bin/env python3
"""
抖音创作者中心 · 全自动发布（上传 → 填标题/描述/话题 → 点击发布）。

用法:
  python3 scripts/douyin_publish.py --job-dir data/social-publish/jobs/<id>

环境变量:
  SOCIAL_PUBLISH_HEADED=1          有界面浏览器（首次登录 / 验证码）
  DOUYIN_PUBLISH_AUTO_CONFIRM=1  自动点「发布/确认发布」（默认开启）
  DOUYIN_PUBLISH_REFRESH_COOKIES=1 发布前从浏览器刷新 cookies/douyin.txt
  YTDLP_COOKIES / DOUYIN_COOKIES   Cookie 文件路径
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault(
    "PLAYWRIGHT_BROWSERS_PATH",
    str(ROOT / ".local" / "ms-playwright"),
)
STORAGE_PATH = ROOT / "data" / "social-publish" / "douyin-storage.json"
UPLOAD_URL = "https://creator.douyin.com/creator-micro/content/upload"
DESKTOP_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def emit(result: dict):
    print(json.dumps(result, ensure_ascii=False), flush=True)


def resolve_cookie_file() -> Path | None:
    for key in ("YTDLP_COOKIES", "DOUYIN_COOKIES"):
        raw = os.environ.get(key, "").strip()
        if raw:
            p = Path(raw)
            if not p.is_absolute():
                p = ROOT / p
            if p.is_file():
                return p
    default = ROOT / "cookies" / "douyin.txt"
    return default if default.is_file() else None


def refresh_cookies() -> bool:
    script = ROOT / "scripts" / "export-douyin-cookies.py"
    if not script.is_file():
        return False
    env = {**os.environ}
    env.setdefault("DOUYIN_BROWSER", os.environ.get("YTDLP_COOKIES_FROM_BROWSER", "safari"))
    r = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return r.returncode == 0 and resolve_cookie_file() is not None


def load_netscape_cookies(path: Path) -> list[dict]:
    batch = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        domain, _flag, p, secure, _expires, name, value = parts[:7]
        if "douyin" not in domain:
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
    return batch


def find_video(job_dir: Path) -> Path:
    job_file = job_dir / "job.json"
    if job_file.is_file():
        job = json.loads(job_file.read_text(encoding="utf-8"))
        video_name = job.get("videoFile")
        if video_name:
            candidate = job_dir / video_name
            if candidate.is_file():
                return candidate
    for name in sorted(job_dir.iterdir()):
        if name.is_file() and name.suffix.lower() in (".mp4", ".mov", ".webm", ".mkv"):
            return name
    raise RuntimeError("任务目录中未找到视频文件（mp4/mov/webm/mkv）")


def find_cover(job_dir: Path) -> Path | None:
    job_file = job_dir / "job.json"
    if job_file.is_file():
        job = json.loads(job_file.read_text(encoding="utf-8"))
        cover_name = job.get("coverFile")
        if cover_name:
            candidate = job_dir / cover_name
            if candidate.is_file():
                return candidate
    for name in sorted(job_dir.iterdir()):
        if name.is_file() and name.name.startswith("cover") and name.suffix.lower() in (
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        ):
            return name
    return None


def upload_cover(page, cover: Path) -> bool:
    """上传自定义封面（失败时不阻断发布流程）。"""
    opened = False
    for pat in (
        re.compile(r"设置封面"),
        re.compile(r"更换封面"),
        re.compile(r"上传封面"),
        re.compile(r"编辑封面"),
        re.compile(r"选封面"),
    ):
        btn = page.get_by_text(pat)
        if btn.count() == 0:
            btn = page.get_by_role("button", name=pat)
        if btn.count() == 0:
            continue
        try:
            btn.first.click(timeout=5000)
            page.wait_for_timeout(1200)
            opened = True
            break
        except Exception:
            continue

    inputs = page.locator('input[type="file"]')
    for i in range(inputs.count()):
        inp = inputs.nth(i)
        try:
            accept = (inp.get_attribute("accept") or "").lower()
            if "video" in accept:
                continue
            if accept and "image" not in accept and not opened:
                continue
            inp.set_input_files(str(cover.resolve()))
            page.wait_for_timeout(1500)
            for confirm_pat in (
                re.compile(r"^确定$"),
                re.compile(r"^完成$"),
                re.compile(r"确认"),
                re.compile(r"保存"),
            ):
                confirm = page.get_by_role("button", name=confirm_pat)
                if confirm.count() == 0:
                    confirm = page.get_by_text(confirm_pat)
                if confirm.count() == 0:
                    continue
                try:
                    confirm.first.click(timeout=4000)
                    page.wait_for_timeout(1000)
                    return True
                except Exception:
                    continue
            return True
        except Exception:
            continue
    return False


def parse_caption(raw: str) -> dict:
    if not raw:
        return {"title": "", "description": ""}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"title": "", "description": raw}


def is_login_page(page) -> bool:
    url = page.url or ""
    if "login" in url or "passport" in url:
        return True
    if page.get_by_text(re.compile("扫码登录|手机号登录|登录抖音")).count() > 0:
        return True
    return False


def wait_logged_in(page, headed: bool, timeout_sec: int = 180) -> None:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if not is_login_page(page):
            return
        if headed:
            page.wait_for_timeout(2000)
            continue
        raise RuntimeError(
            "创作者中心未登录。请在 Safari/Chrome 登录 douyin.com 与 creator.douyin.com 后运行 "
            "./scripts/setup-douyin-cookies.sh，或设置 SOCIAL_PUBLISH_HEADED=1 首次扫码登录"
        )
    raise RuntimeError("等待登录超时，请检查 Cookie 或开启 SOCIAL_PUBLISH_HEADED=1 手动登录")


def wait_upload_ready(page, timeout_sec: int = 900) -> None:
    """等待视频上传/转码完成，标题区可编辑。"""
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if page.get_by_text(re.compile("上传成功|上传完成")).count() > 0:
            page.wait_for_timeout(1500)
            return
        if page.get_by_text("重新上传").count() > 0:
            page.wait_for_timeout(1500)
            return
        uploading = page.get_by_text(re.compile("上传中|转码中|处理中")).count() > 0
        title_loc = page.locator(
            'input[placeholder*="标题"], textarea[placeholder*="标题"], '
            '[class*="title"] input, [data-placeholder*="标题"]'
        )
        if title_loc.count() > 0 and not uploading:
            try:
                if title_loc.first.is_enabled():
                    return
            except Exception:
                pass
        page.wait_for_timeout(2500)
    raise RuntimeError("视频上传超时，请缩小文件或增大 DOUYIN_PUBLISH_UPLOAD_TIMEOUT_SEC")


def fill_first(page, selectors: str, text: str) -> bool:
    for sel in selectors.split(","):
        sel = sel.strip()
        if not sel:
            continue
        loc = page.locator(sel).first
        if loc.count() == 0:
            continue
        try:
            loc.click(timeout=3000)
            loc.fill(text, timeout=8000)
            return True
        except Exception:
            try:
                loc.press_sequentially(text, delay=10)
                return True
            except Exception:
                continue
    return False


def fill_description(page, text: str) -> bool:
    if fill_first(
        page,
        'div[contenteditable="true"], [contenteditable="true"], '
        'textarea[placeholder*="描述"], textarea[placeholder*="作品"], '
        'textarea[placeholder*="添加"]',
        text,
    ):
        return True
    editable = page.locator('[contenteditable="true"]').first
    if editable.count():
        editable.click()
        page.keyboard.press("Meta+A")
        page.keyboard.type(text[:1000], delay=5)
        return True
    return False


def fill_tags(page, tags: str) -> None:
    raw = tags.strip()
    if not raw:
        return
    tags_list = re.split(r"[\s,#，、]+", raw)
    tags_list = [t.lstrip("#") for t in tags_list if t.strip()][:5]
    for tag in tags_list:
        for sel in (
            'input[placeholder*="话题"]',
            'input[placeholder*="标签"]',
            '[class*="topic"] input',
        ):
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            try:
                loc.click()
                loc.fill(f"#{tag}")
                page.keyboard.press("Enter")
                page.wait_for_timeout(600)
                break
            except Exception:
                continue


def click_publish(page) -> None:
    auto_confirm = os.environ.get("DOUYIN_PUBLISH_AUTO_CONFIRM", "1") == "1"
    if not auto_confirm:
        return

    publish_patterns = [
        re.compile(r"^发布$"),
        re.compile(r"立即发布"),
        re.compile(r"确认发布"),
    ]
    clicked = False
    for pat in publish_patterns:
        btn = page.get_by_role("button", name=pat)
        if btn.count() == 0:
            btn = page.get_by_text(pat)
        if btn.count() == 0:
            continue
        try:
            btn.first.click(timeout=8000)
            clicked = True
            page.wait_for_timeout(2000)
        except Exception:
            continue

    if not clicked:
        for text in ("发布", "立即发布"):
            loc = page.locator(f'button:has-text("{text}")').first
            if loc.count():
                loc.click(timeout=8000)
                clicked = True
                page.wait_for_timeout(2000)
                break

    if not clicked:
        raise RuntimeError("未找到「发布」按钮，页面结构可能已变更")

    for pat in (re.compile(r"确认发布"), re.compile(r"^发布$"), re.compile(r"确定")):
        confirm = page.get_by_role("button", name=pat)
        if confirm.count() == 0:
            confirm = page.get_by_text(pat)
        if confirm.count() == 0:
            continue
        try:
            confirm.first.click(timeout=5000)
            page.wait_for_timeout(2500)
            return
        except Exception:
            continue


def wait_publish_success(page, timeout_sec: int = 120) -> str:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        for pat in (
            "发布成功",
            "已发布",
            "发布完成",
            "作品发布成功",
            "内容已发布",
        ):
            if page.get_by_text(pat).count() > 0:
                return f"抖音发布成功（{pat}）"
        if "content/manage" in (page.url or "") or "作品管理" in (page.content() or ""):
            return "抖音已提交发布，请在作品管理中确认状态"
        page.wait_for_timeout(2000)
    return "已点击发布，未检测到成功提示（可能仍在审核，请到创作者中心确认）"


def publish(job_dir: Path, dry_run: bool = False) -> dict:
    if os.environ.get("DOUYIN_PUBLISH_REFRESH_COOKIES", "1") == "1":
        refresh_cookies()

    cookie_file = resolve_cookie_file()
    if not cookie_file and not STORAGE_PATH.is_file():
        return {
            "ok": False,
            "error": "未找到 cookies/douyin.txt。请运行 ./scripts/setup-douyin-cookies.sh",
        }

    job = json.loads((job_dir / "job.json").read_text(encoding="utf-8"))
    cap_raw = (job.get("captions") or {}).get("douyin", "")
    caption = parse_caption(cap_raw)
    if not caption.get("title") and job.get("title"):
        caption["title"] = job["title"]
    if not caption.get("description") and job.get("description"):
        caption["description"] = job["description"]
    tags = job.get("tags") or ""

    video = find_video(job_dir)
    cover = find_cover(job_dir)
    headed = os.environ.get("SOCIAL_PUBLISH_HEADED", "1") == "1"
    upload_timeout = int(os.environ.get("DOUYIN_PUBLISH_UPLOAD_TIMEOUT_SEC", "900"))

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {
            "ok": False,
            "error": "未安装 playwright：python3 -m pip install --user playwright && playwright install chromium",
        }

    STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)

    def launch_browser(pw):
        launch_opts = {
            "headless": not headed,
            "args": ["--disable-blink-features=AutomationControlled"],
        }
        try:
            return pw.chromium.launch(**launch_opts)
        except Exception:
            return pw.chromium.launch(channel="chrome", **launch_opts)

    with sync_playwright() as p:
        browser = launch_browser(p)
        context_opts = {
            "viewport": {"width": 1440, "height": 900},
            "user_agent": DESKTOP_UA,
            "locale": "zh-CN",
        }
        if STORAGE_PATH.is_file():
            context_opts["storage_state"] = str(STORAGE_PATH)
        context = browser.new_context(**context_opts)
        if cookie_file:
            batch = load_netscape_cookies(cookie_file)
            if batch:
                context.add_cookies(batch)
        page = context.new_page()
        page.set_default_timeout(120000)

        try:
            page.goto(UPLOAD_URL, wait_until="domcontentloaded", timeout=120000)
            page.wait_for_timeout(2000)
            wait_logged_in(page, headed=headed)

            file_input = page.locator('input[type="file"]').first
            if file_input.count() == 0:
                raise RuntimeError("未找到上传控件，请确认创作者中心页面可访问")
            file_input.set_input_files(str(video.resolve()))
            wait_upload_ready(page, timeout_sec=upload_timeout)

            cover_note = ""
            if cover:
                if upload_cover(page, cover):
                    cover_note = "，已设置封面"
                else:
                    cover_note = "，封面未能自动设置（请在创作者中心手动选择）"

            title = (caption.get("title") or "作品")[:30]
            desc = (caption.get("description") or "")[:1000]
            fill_first(
                page,
                'input[placeholder*="标题"], textarea[placeholder*="标题"], '
                '[class*="title"] input',
                title,
            )
            fill_description(page, desc)
            fill_tags(page, tags)

            page.wait_for_timeout(1000)
            if dry_run:
                msg = f"dry-run：已上传并填表{cover_note}，未点击发布"
            else:
                click_publish(page)
                msg = wait_publish_success(page) + cover_note

            if headed or not STORAGE_PATH.is_file():
                context.storage_state(path=str(STORAGE_PATH))

            screenshot = job_dir / "douyin-publish-result.png"
            try:
                page.screenshot(path=str(screenshot), full_page=False)
            except Exception:
                pass

            return {"ok": True, "message": msg, "url": page.url}
        except Exception as e:
            err_shot = job_dir / "douyin-publish-error.png"
            try:
                page.screenshot(path=str(err_shot), full_page=True)
            except Exception:
                pass
            raise e
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-dir", required=True)
    parser.add_argument("--dry-run", action="store_true", help="上传并填表，不点击发布")
    args = parser.parse_args()

    job_dir = Path(args.job_dir)
    if not job_dir.is_absolute():
        job_dir = ROOT / job_dir
    if not (job_dir / "job.json").is_file():
        emit({"ok": False, "error": "job.json 不存在"})
        sys.exit(1)

    try:
        result = publish(job_dir, dry_run=args.dry_run)
        emit(result)
        sys.exit(0 if result.get("ok") else 1)
    except Exception as e:
        emit({"ok": False, "error": str(e)[:800]})
        sys.exit(1)


if __name__ == "__main__":
    main()
