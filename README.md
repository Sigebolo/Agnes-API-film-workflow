<div align="center">

# Agnes Film Studio

**Free AI Video Ad Generator for Small Businesses**

Logos · Marketing Copy · Video Ads — No Design Skills Needed

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Stars](https://img.shields.io/github/stars/Sigebolo/Agnes-API-film-workflow?style=social)](https://github.com/Sigebolo/Agnes-API-film-workflow)
[![Issues](https://img.shields.io/github/issues/Sigebolo/Agnes-API-film-workflow)](https://github.com/Sigebolo/Agnes-API-film-workflow/issues)

Keywords: `ai` `video-generation` `marketing` `ffmpeg` `react` `open-source`

[中文](#中文) | [English](#what-is-agnes-film-studio)

</div>

---

## What is Agnes Film Studio?

Agnes Film Studio is a free, open-source AI video production tool. Describe your product, and the AI generates everything you need for marketing:

- **Logo** — Multiple styles, pick your favorite
- **Marketing Copy** — E-commerce, social media, poster content
- **Video Ads** — 5-30 seconds, with AI character presentation

**No editing skills. No designers. No actors. Just describe your product.**

### How It Works

```
Enter product info (name, description, selling points)
        ↓
  AI generates Logo (3 styles)
        ↓
  Choose your favorite
        ↓
  AI generates marketing images (ecommerce / social / poster)
        ↓
  AI generates video ad (optional: upload character photo)
        ↓
  Auto-saved to output folder
```

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# Open http://localhost:3000

# Enter your Agnes AI API Key (free at https://platform.agnes-ai.com)
```

Windows users: double-click `启动Agnes.bat` to launch.

## Key Features

### Image-to-Video

Upload a character photo, write a product intro, and AI makes the character "speak" to present your product. Perfect for e-commerce demos, social media ads, and personal branding.

### One-Click Pipeline

Product name & description → auto Logo → auto marketing images → auto video ad. The entire pipeline runs end-to-end.

### Duration Control

Choose 5 to 30 seconds per video segment.

### Free & Open Source

Agnes AI provides free credits. This project is MIT-licensed and fully open source.

## Demo Videos

See Agnes Film Studio in action — AI-generated 15-second product ad videos for **小算盘AI会计软件**:

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0;">

<video src="public/demo-videos/小算盘AI-15s广告-v1.mp4" controls style="width:100%;border-radius:12px;border:1px solid #333;">
  Version 1 — Logo + 电商图 + 人物讲解
</video>

<video src="public/demo-videos/小算盘AI-15s广告-v2.mp4" controls style="width:100%;border-radius:12px;border:1px solid #333;">
  Version 2 — 风格二
</video>

</div>

**To generate your own:** `npm install && npm run dev` → enter your [Agnes AI API Key](https://platform.agnes-ai.com) → 输入产品信息 → 一键生成 Logo + 营销图 + 广告视频

## MFilm-CLI

Industrial-grade film asset management from the terminal. No browser needed.

```bash
pip install requests

# Configure
python mfilm.py config --api-key "sk-xxx"

# Create video (wait)
python mfilm.py create --prompt "Product showcase" --duration 15 --label "Ad_01"

# Create video (async)
python mfilm.py create --prompt "Character animation" --anchor-image "https://..." --async

# Long video chain
python mfilm.py chain --prompt "Scene 1" --prompt "Scene 2" --prompt "Scene 3" --duration 10

# DNA character presets
python mfilm.py dna save "Maoning" --anchor "https://..." --traits "20-year-old girl"

# Background daemon
python mfilm.py daemon start

# Batch tasks
python mfilm.py batch --file tasks.json
```

| Command | Function |
|---------|----------|
| `create` | Auto-enhance prompt, frame alignment (8n+1), DNA injection |
| `chain` | Multi-scene sequential generation, auto-extract last frame as reference |
| `dna` | Character DNA preset management (save/load/list/delete) |
| `daemon` | Background auto-poll and download completed videos |
| `status` | Task monitoring with ANSI progress bar, zombie task detection |
| `sync` | Auto-detect completed tasks and download |
| `batch` | JSON batch task creation |

## Agent Automation

Let AI agents (Claude Code, OpenCode, etc.) generate videos for you automatically.

```bash
# Install the skill
cp -r skills/agnes-video-generation ~/.config/opencode/skills/
# or Claude Code
cp -r skills/agnes-video-generation ~/.claude/skills/
```

After installation, agents auto-detect and use the skill:

```
You: Make a skincare product ad video
Agent: (auto-calls agnes-video-generation skill)
    1. Generates product copy
    2. Generates marketing images
    3. Uploads image, gets URL
    4. Calls Agnes API to generate video
    5. Returns video file
```

### Python Direct Call

```python
from agnes_video import generate_video

result = generate_video(
    image_url="https://example.com/product.jpg",
    prompt="A professional woman presenting skincare benefits...",
    duration=15,
    api_key="sk-xxx"
)
print(result["video_url"])
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Express + WebSocket |
| AI Engine | Agnes AI (text / image / video generation) |
| Video | FFmpeg |
| CLI | MFilm-CLI (Python) |

## Auto-Download with Cron

```bash
# Linux/Mac
crontab -e
# */5 * * * * cd /path/to/Agnes-API-film-workflow && python monitor_videos.py --api-key "sk-xxx" --output-dir "downloads" --quiet

# Windows (Task Scheduler)
schtasks /create /tn "AgnesVideoMonitor" /tr "python monitor_videos.py --api-key sk-xxx --output-dir D:\downloads --quiet" /sc minute /mo 5
```

## License

[MIT](LICENSE) — Free to use, free to modify.

---

## 中文

Agnes Film Studio 是一个免费的 AI 视频制作工具。输入产品信息，AI 自动生成 Logo、营销文案和视频广告。

**不用学剪辑，不用请设计师，不用花钱找演员。**

### 核心功能

- **图生视频** — 上传人物照片，AI 让这个人为你的产品做宣讲
- **一键生成** — 输入产品信息 → 自动生成 Logo → 营销图 → 视频广告
- **时长可控** — 5 到 30 秒，按需选择
- **完全免费** — Agnes AI 提供免费额度，本项目 MIT 开源

### 效果演示

**小算盘AI会计软件** — AI 生成的 15 秒产品广告视频：

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0;">

<video src="public/demo-videos/小算盘AI-15s广告-v1.mp4" controls style="width:100%;border-radius:12px;border:1px solid #333;">
  版本一
</video>

<video src="public/demo-videos/小算盘AI-15s广告-v2.mp4" controls style="width:100%;border-radius:12px;border:1px solid #333;">
  版本二
</video>

</div>

### 快速开始

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

Windows 用户双击 `启动Agnes.bat` 一键启动。

### MFilm-CLI 命令行工具

```bash
pip install requests

python mfilm.py config --api-key "sk-xxx"
python mfilm.py create --prompt "产品展示" --duration 15 --label "Ad_01"
python mfilm.py chain --prompt "场景1" --prompt "场景2" --prompt "场景3" --duration 10
python mfilm.py dna save "Maoning" --anchor "https://..." --traits "20岁女孩"
python mfilm.py daemon start
python mfilm.py batch --file tasks.json
```

详细文档请参阅英文部分。

---

<div align="center">

**Made with AI for small businesses** 

</div>
