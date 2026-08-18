#!/usr/bin/env python3
"""从原始 HTML 文件中提取番剧数据，生成 bangumi.json，使用本地封面路径。"""
import re, json, time, os

HTML_FILE = r"..\無同的追番列表.html"
COVERS_DIR = "covers"

STATUS_MAP = {"想看": "wish", "看过": "collect", "在看": "doing", "搁置": "on_hold", "抛弃": "dropped"}

def extract_subject_id(s):
    m = re.search(r'(\d+)_', s)
    return int(m.group(1)) if m else None

def main():
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        html = f.read()

    cards = re.findall(r'<div class="anime-card"[^>]*>(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)
    collections = []
    seen_ids = set()

    # 获取本地封面文件列表
    local_covers = set()
    if os.path.isdir(COVERS_DIR):
        local_covers = set(os.listdir(COVERS_DIR))

    for card in cards:
        title_m = re.search(r'<div class="anime-card-title">(.*?)</div>', card, re.DOTALL)
        if not title_m: continue
        title = title_m.group(1).strip().replace("&#39;", "'").replace("&amp;", "&")

        score = 0
        score_m = re.search(r'</svg>\s*(\d+\.?\d*)\s*</div>', card)
        if score_m: score = float(score_m.group(1))

        status_m = re.search(r'<span class="anime-card-status status-(\d+)">(.*?)</span>', card)
        if not status_m: continue
        status = STATUS_MAP.get(status_m.group(2), "collect")

        img_m = re.search(r'<img class="anime-cover" src="([^"]+)"', card)
        img_src = img_m.group(1) if img_m else ""
        img_filename = re.sub(r'^.*[/\\]', '', img_src)

        cdn_url = ""
        onerror_m = re.search(r"onerror=\"([^\"]+)\"", card)
        if onerror_m:
            cdn_m = re.search(r"src='(https://bgmimg\.anibt\.net/[^']+)'", onerror_m.group(1))
            if cdn_m: cdn_url = cdn_m.group(1)

        subject_id = extract_subject_id(img_filename)
        if not subject_id or subject_id in seen_ids: continue
        seen_ids.add(subject_id)

        # 封面：优先本地，其次 CDN
        images = {}
        if img_filename in local_covers:
            images["common"] = f"covers/{img_filename}"
            images["large"] = f"covers/{img_filename}"
        elif cdn_url:
            images["common"] = cdn_url
            images["large"] = cdn_url.replace("/pic/cover/c/", "/pic/cover/l/")

        collections.append({
            "subject_id": subject_id,
            "subject_type": 2,
            "status": {"id": {"wish":1,"collect":2,"doing":3,"on_hold":4,"dropped":5}[status], "name": status},
            "subject": {
                "id": subject_id, "name": "", "name_cn": title, "date": "", "eps": 0,
                "rating": {"score": score, "total": 0} if score > 0 else {},
                "tags": [], "images": images, "summary": "",
            },
        })

    order = {"doing": 0, "wish": 1, "collect": 2, "on_hold": 3, "dropped": 4}
    collections.sort(key=lambda c: order.get(c["status"]["name"], 5))

    with open("bangumi.json", "w", encoding="utf-8") as f:
        json.dump({
            "username": "wutong",
            "last_updated": time.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
            "total": len(collections),
            "collections": collections,
        }, f, ensure_ascii=False, indent=2)

    print(f"完成: {len(collections)} 条")

if __name__ == "__main__":
    main()
