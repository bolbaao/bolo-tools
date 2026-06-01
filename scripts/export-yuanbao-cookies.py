#!/usr/bin/env python3
"""从本机浏览器导出腾讯元宝 Cookie（Cookie 请求头字符串）"""
import http.cookiejar
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "cookies", "yuanbao.txt")
DOMAINS = (
    "yuanbao.tencent.com",
    ".yuanbao.tencent.com",
    "tencent.com",
    ".tencent.com",
)


def preferred_browsers():
    env_browser = os.environ.get("YUANBAO_COOKIES_FROM_BROWSER") or os.environ.get(
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


def cookie_header_from_browser(browser_cookie3, browser_name):
    get_fn = getattr(browser_cookie3, browser_name, None)
    if get_fn is None:
        return None, f"不支持 {browser_name}"

    pairs = []
    seen = set()

    def add_cookie(c):
        if not c.name or c.value is None:
            return
        key = (c.domain, c.name, c.path)
        if key in seen:
            return
        if c.domain and "yuanbao" not in c.domain and "tencent.com" not in c.domain:
            return
        seen.add(key)
        pairs.append(f"{c.name}={c.value}")

    for domain in DOMAINS:
        try:
            for c in get_fn(domain_name=domain):
                add_cookie(c)
        except Exception:
            pass

    if not pairs:
        try:
            for c in get_fn():
                if c.domain and "yuanbao" in c.domain:
                    add_cookie(c)
        except Exception as e:
            return None, str(e)

    if not pairs:
        return None, None

    return "; ".join(pairs), browser_name


def main():
    browser_cookie3 = load_browser_cookie3()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    errors = []

    for name in preferred_browsers():
        header, label_or_err = cookie_header_from_browser(browser_cookie3, name)
        if header:
            with open(OUT, "w", encoding="utf-8") as f:
                f.write(header.strip())
                f.write("\n")
            print(header)
            print(f"# 已从 {label_or_err} 导出 → {OUT}", file=sys.stderr)
            return

        if label_or_err:
            errors.append(f"{name}: {label_or_err}")

    print("未找到 yuanbao.tencent.com 的 Cookie。", file=sys.stderr)
    print(
        "请先在浏览器打开 https://yuanbao.tencent.com 并登录；"
        "系统设置 → 隐私 → 完全磁盘访问权限 → 勾选终端/Cursor。",
        file=sys.stderr,
    )
    print(
        "或手动复制 Cookie：开发者工具 → Network → 任意 yuanbao 请求 → Request Headers → Cookie",
        file=sys.stderr,
    )
    if errors:
        print("详情:", "; ".join(errors[:4]), file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
