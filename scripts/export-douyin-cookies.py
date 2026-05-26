#!/usr/bin/env python3
"""从本机浏览器导出 douyin.com Cookie 到 cookies/douyin.txt（Netscape 格式）"""
import http.cookiejar
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "cookies", "douyin.txt")

DOMAINS = (".douyin.com", "douyin.com", "www.douyin.com", ".iesdouyin.com")

CHROME_BASE = os.path.expanduser(
    "~/Library/Application Support/Google/Chrome"
)


def preferred_browsers():
    env_browser = os.environ.get("DOUYIN_BROWSER") or os.environ.get(
        "YTDLP_COOKIES_FROM_BROWSER"
    )
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


def chrome_profiles():
    if not os.path.isdir(CHROME_BASE):
        return [None]
    profiles = []
    for name in os.listdir(CHROME_BASE):
        if os.path.isfile(os.path.join(CHROME_BASE, name, "Cookies")):
            profiles.append(name if name != "Default" else None)
    return profiles or [None]


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

    def collect(**kwargs):
        nonlocal count
        for domain in DOMAINS:
            try:
                for c in get_fn(domain_name=domain, **kwargs):
                    add_cookie(c)
            except Exception:
                pass
        if count == 0:
            try:
                for c in get_fn(**kwargs):
                    if c.domain and "douyin" in c.domain:
                        add_cookie(c)
            except Exception as e:
                return str(e)
        return None

    profiles = [None]
    if browser_name == "chrome":
        profiles = chrome_profiles()

    last_err = None
    for profile in profiles:
        kwargs = {"profile": profile} if profile else {}
        err = collect(**kwargs)
        if err:
            last_err = err
        if count > 0:
            jar.save(OUT, ignore_discard=True, ignore_expires=True)
            label = browser_name
            if profile:
                label += f" ({profile})"
            return count, label
        count = 0
        seen.clear()

    return 0, last_err


def export_via_ytdlp(browser_name):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cmd = [
        "yt-dlp",
        "--cookies-from-browser",
        browser_name,
        "--cookies",
        OUT,
        "--skip-download",
        "https://www.douyin.com/",
    ]
    try:
        subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    return os.path.isfile(OUT) and os.path.getsize(OUT) > 80


def main():
    browser_cookie3 = load_browser_cookie3()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    errors = []
    for name in preferred_browsers():
        count, label_or_err = export_from_browser(browser_cookie3, name)
        if count > 0:
            print(f"已从 {label_or_err} 导出 {count} 条 Cookie → {OUT}")
            return
        if isinstance(label_or_err, str) and label_or_err:
            errors.append(f"{name}: {label_or_err}")

        if export_via_ytdlp(name):
            print(f"已通过 yt-dlp 从 {name} 导出 Cookie → {OUT}")
            return

    print("未找到 douyin.com 的 Cookie。", file=sys.stderr)
    print(
        "请在 Safari 打开 https://www.douyin.com 登录；"
        "系统设置 → 隐私 → 完全磁盘访问权限 → 勾选终端/Cursor。",
        file=sys.stderr,
    )
    if errors:
        print("详情:", "; ".join(errors[:4]), file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
