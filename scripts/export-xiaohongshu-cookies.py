#!/usr/bin/env python3
"""从本机浏览器导出 xiaohongshu.com Cookie 到 cookies/xiaohongshu.txt（Netscape 格式）"""
import http.cookiejar
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "cookies", "xiaohongshu.txt")

DOMAINS = (
    ".xiaohongshu.com",
    "xiaohongshu.com",
    "www.xiaohongshu.com",
    "edith.xiaohongshu.com",
)


def preferred_browsers():
    env_browser = os.environ.get("XHS_BROWSER") or os.environ.get("XHS_COOKIES_FROM_BROWSER")
    if env_browser:
        rest = ("safari", "chrome", "chromium", "brave", "edge", "firefox")
        ordered = [env_browser]
        for b in rest:
            if b != env_browser:
                ordered.append(b)
        return tuple(ordered)
    return ("safari", "chrome", "chromium", "brave", "edge", "firefox")


def load_browser_cookie3():
    try:
        import browser_cookie3
        return browser_cookie3
    except ImportError:
        print("正在安装 browser-cookie3…", file=sys.stderr)
        os.system(f"{sys.executable} -m pip install -q browser-cookie3")
        import browser_cookie3
        return browser_cookie3


def export_from_browser(browser_cookie3, browser_name):
    get_fn = getattr(browser_cookie3, browser_name, None)
    if get_fn is None:
        return 0, f"不支持 {browser_name}"

    jar = http.cookiejar.MozillaCookieJar(OUT)
    seen = set()
    count = 0

    def add_cookie(c):
        nonlocal count
        key = (c.domain, c.name, c.path)
        if key in seen:
            return
        seen.add(key)
        jar.set_cookie(c)
        count += 1

    for domain in DOMAINS:
        try:
            for cookie in get_fn(domain_name=domain):
                add_cookie(cookie)
        except Exception:
            pass

    if count:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        jar.save(ignore_discard=True, ignore_expires=True)
    return count, None


def main():
    browser_cookie3 = load_browser_cookie3()
    last_err = None
    for browser in preferred_browsers():
        count, err = export_from_browser(browser_cookie3, browser)
        if count:
            print(f"已从 {browser} 导出 {count} 条 Cookie → {OUT}")
            return 0
        last_err = err or f"{browser} 无小红书 Cookie"
    print(f"❌ 导出失败：{last_err}。请先在浏览器登录 xiaohongshu.com", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
