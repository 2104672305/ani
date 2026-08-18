#!/usr/bin/env python3
"""
从 Bangumi API 获取用户收藏数据，生成 bangumi.json，并可选下载封面到本地。

用法:
    python fetch_bangumi.py                 # 使用 config.json 中的用户名
    python fetch_bangumi.py <username>      # 指定用户名
    python fetch_bangumi.py <username> --no-covers   # 不下载封面

生成的 bangumi.json 供 index.html 加载。前端是纯静态的，无需后端。
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

API_BASE = "https://api.bgm.tv"
PAGE_SIZE = 50
COVERS_DIR = "covers"
USER_AGENT = "BangumiAniList/1.0 (https://github.com/bestWuTong/Bangumi_AniList)"

# 可选的本地代理。如果你的网络需要代理才能访问 api.bgm.tv，请取消注释并填写。
# 也可以通过环境变量设置：PROXY=http://127.0.0.1:7897 python fetch_bangumi.py
PROXY = os.environ.get("PROXY", "")


def build_opener():
    if PROXY:
        proxy_handler = urllib.request.ProxyHandler({
            "http": PROXY,
            "https": PROXY,
        })
        return urllib.request.build_opener(proxy_handler)
    return urllib.request.build_opener()


OPENER = build_opener()


def fetch_json(url, retries=3):
    """带重试的 JSON 请求"""
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            })
            with OPENER.open(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            print(f"    请求失败 (第{attempt+1}次): {e}")
            time.sleep(2 * (attempt + 1))
    raise last_err


def fetch_user_info(username):
    print(f"  - 获取用户信息: {username}")
    try:
        return fetch_json(f"{API_BASE}/v0/users/{username}")
    except Exception as e:
        print(f"    获取用户信息失败: {e}")
        return None


def fetch_all_collections(username):
    collections = []
    offset = 0
    total = None

    while total is None or offset < total:
        url = f"{API_BASE}/v0/users/{username}/collections?limit={PAGE_SIZE}&offset={offset}&subject_type=2"
        try:
            data = fetch_json(url)
        except Exception as e:
            print(f"  获取收藏失败 (offset={offset}): {e}")
            break

        if total is None:
            total = data.get("total", 0)
            print(f"  - 共 {total} 条收藏")

        items = data.get("data", [])
        if not items:
            break

        collections.extend(items)
        offset += PAGE_SIZE
        print(f"    已获取 {len(collections)}/{total}")

        if offset < total:
            time.sleep(0.3)

    return collections


def normalize_image_url(url):
    """把图片 URL 中的尺寸参数规范化，便于本地缓存命名"""
    if not url:
        return ""
    # 提取最后一段文件名，如 495291_9WuBW.jpg
    m = re.search(r'([^/]+\.(?:jpg|png|webp|jpeg|gif))$', url)
    return m.group(1) if m else ""


def download_covers(collections):
    """下载封面到本地 covers/ 目录，并改写 images 路径"""
    if not os.path.isdir(COVERS_DIR):
        os.makedirs(COVERS_DIR, exist_ok=True)

    os.makedirs(COVERS_DIR, exist_ok=True)
    downloaded = 0
    failed = 0

    for i, col in enumerate(collections):
        subject = col.get("subject", {})
        images = subject.get("images", {})
        img_url = images.get("common") or images.get("large") or ""
        if not img_url:
            continue

        filename = normalize_image_url(img_url)
        if not filename:
            continue

        local_path = os.path.join(COVERS_DIR, filename)

        if os.path.exists(local_path) and os.path.getsize(local_path) > 1000:
            images["common"] = f"covers/{filename}"
            images["large"] = f"covers/{filename}"
            continue

        try:
            req = urllib.request.Request(img_url, headers={"User-Agent": USER_AGENT})
            with OPENER.open(req, timeout=20) as resp:
                data = resp.read()
            with open(local_path, "wb") as f:
                f.write(data)
            images["common"] = f"covers/{filename}"
            images["large"] = f"covers/{filename}"
            downloaded += 1
            if downloaded % 20 == 0:
                print(f"    已下载 {downloaded} 张封面...")
        except Exception as e:
            failed += 1
            # 保留原始 URL
            print(f"    封面下载失败: {filename}: {e}")

        time.sleep(0.05)

    print(f"  - 封面下载完成: 新增 {downloaded} 张, 失败 {failed} 张")


def main():
    # 读取 config
    config = {}
    try:
        with open("config.json", "r", encoding="utf-8") as f:
            config = json.load(f)
    except FileNotFoundError:
        pass

    # 参数解析
    username = config.get("bangumi", {}).get("username", "")
    download = True
    args = sys.argv[1:]
    if args:
        for a in args:
            if a == "--no-covers":
                download = False
            elif not a.startswith("--"):
                username = a

    if not username:
        print("错误: 请指定用户名")
        print("用法: python fetch_bangumi.py [username] [--no-covers]")
        sys.exit(1)

    print(f"开始获取用户 {username} 的收藏数据...")

    # 用户信息
    user_info = fetch_user_info(username)

    # 所有收藏
    collections = fetch_all_collections(username)
    if not collections:
        print("未获取到任何收藏数据")
        sys.exit(1)

    # 下载封面
    if download:
        print("  - 下载封面到本地...")
        download_covers(collections)

    # 构建输出
    result = {
        "username": username,
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "total": len(collections),
        "collections": collections,
    }

    with open("bangumi.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"完成! 已保存 {len(collections)} 条数据到 bangumi.json")


if __name__ == "__main__":
    main()