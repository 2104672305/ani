# 追番列表网站

一个与「無同的追番列表」同款的 Bangumi 追番网站。采用**方案A：静态 JSON + 定时脚本**架构。

## 架构

```
bangumi-site/
├── index.html          # 主页面（毛玻璃 UI）
├── style.css           # 样式
├── app.js              # 前端逻辑（渲染/筛选/搜索/弹窗/词云）
├── config.json         # 用户配置（用户名、昵称、背景等）
├── bangumi.json        # 数据文件（由脚本生成，前端加载它）
├── fetch_bangumi.py    # ★ 从 Bangumi API 抓数据 + 下载封面
├── update.bat          # ★ 一键更新数据（Windows）
├── start.bat           # ★ 一键启动本地服务器
├── extract_data.py     # 从旧 HTML 提取数据的辅助脚本
├── covers/             # 本地封面缓存（脚本自动下载）
└── avatar.webp         # 头像
```

## 数据流

```
Bangumi API (api.bgm.tv)
      │  python fetch_bangumi.py  ← 手动/定时运行
      ▼
  bangumi.json  +  covers/
      │  静态托管 / 本地打开
      ▼
  index.html（前端渲染）
```

## 使用步骤

### 1. 配置用户名

编辑 `config.json`，把 `username` 改成你的 Bangumi 用户名：

```json
{
    "bangumi": {
        "username": "wutong",
        "nickname": "無同"
    }
}
```

### 2. 更新数据

双击 `update.bat`，或命令行运行：

```bash
python fetch_bangumi.py
```

这会从 API 获取收藏数据并生成 `bangumi.json`，同时把封面下载到 `covers/`（离线也能显示）。

### 3. 预览网站

双击 `start.bat`，或：

```bash
python -m http.server 8080
```

浏览器打开 http://localhost:8080

## 定时自动更新（可选）

让数据每日自动更新，三种方式：

- **Windows 任务计划程序**：每天定时运行 `update.bat`
- **Linux cron**：`0 3 * * * cd /path/to/site && python fetch_bangumi.py`
- **GitHub Actions**：定时调用 API 生成 JSON 并 push 到静态托管

## 功能

- 状态筛选：全部 / 在看 / 看过 / 想看 / 搁置
- 实时搜索（中文名/日文名）
- 详情弹窗：封面、评分、集数、开播日期、标签、简介
- 番剧标签词云
- 返回顶部
- 响应式设计（手机/平板/桌面）

## 说明

- 数据来自 [Bangumi API](https://bangumi.github.io/api/)，需联网才能更新数据
- 前端完全静态，可部署到任意静态托管（GitHub Pages / Cloudflare Pages / Vercel 等）
- 当前 `bangumi.json` 是从旧版 HTML 提取的 239 条数据，运行 `fetch_bangumi.py` 后会被 API 完整数据（含标签/简介/日文名）覆盖