#!/usr/bin/env python3
"""仅检测创作者中心是否已登录（不发布）。"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault(
    "PLAYWRIGHT_BROWSERS_PATH",
    str(ROOT / ".local" / "ms-playwright"),
)
sys.path.insert(0, str(ROOT / "scripts"))

from douyin_publish import (  # noqa: E402
    STORAGE_PATH,
    UPLOAD_URL,
    DESKTOP_UA,
    is_login_page,
    load_netscape_cookies,
    resolve_cookie_file,
)


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(json.dumps({"ok": False, "error": "未安装 playwright"}))
        return 1

    cookie_file = resolve_cookie_file()
    if not cookie_file and not STORAGE_PATH.is_file():
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "无 cookies/douyin.txt，请运行 ./scripts/setup-douyin-cookies.sh",
                },
                ensure_ascii=False,
            )
        )
        return 1

    headed = os.environ.get("SOCIAL_PUBLISH_HEADED", "0") == "1"
    try:
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(headless=not headed)
            except Exception as e1:
                try:
                    browser = p.chromium.launch(channel="chrome", headless=not headed)
                except Exception:
                    print(
                        json.dumps(
                            {
                                "ok": False,
                                "error": (
                                    f"无法启动浏览器：{e1}。"
                                    "请运行: PLAYWRIGHT_BROWSERS_PATH=.local/ms-playwright "
                                    "python3 -m playwright install chromium"
                                ),
                            },
                            ensure_ascii=False,
                        )
                    )
                    return 1

            opts = {
                "viewport": {"width": 1280, "height": 800},
                "user_agent": DESKTOP_UA,
                "locale": "zh-CN",
            }
            if STORAGE_PATH.is_file():
                opts["storage_state"] = str(STORAGE_PATH)
            context = browser.new_context(**opts)
            if cookie_file:
                batch = load_netscape_cookies(cookie_file)
                if batch:
                    context.add_cookies(batch)
            page = context.new_page()
            page.goto(UPLOAD_URL, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(2500)
            if is_login_page(page):
                browser.close()
                print(
                    json.dumps(
                        {
                            "ok": False,
                            "error": "创作者中心未登录，请刷新 Cookie 或 SOCIAL_PUBLISH_HEADED=1 登录",
                        },
                        ensure_ascii=False,
                    )
                )
                return 1
            title = page.title()
            browser.close()
            print(
                json.dumps(
                    {"ok": True, "message": f"已登录，当前页: {title or 'upload'}"},
                    ensure_ascii=False,
                )
            )
            return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:500]}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
