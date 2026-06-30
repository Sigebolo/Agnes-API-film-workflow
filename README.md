<div align="center">

# 🎬 Agnes Film Studio

**免费生成 Logo、文案、视频广告 — 专为个人和小企业设计**

[English](#english) | 中文

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

</div>

---

## 这是什么？

Agnes Film Studio 是一个免费的 AI 视频制作工具。输入你的产品信息，AI 自动生成：

- 🎨 **Logo** — 多种风格供你选择
- 📝 **营销文案** — 电商、社交媒体、海报文案
- 🎬 **视频广告** — 5-30 秒，带人物讲解

**不用学剪辑，不用请设计师，不用花钱找演员。**

## 核心功能

### 图生视频
上传一张人物照片，AI 让这个人为你的产品做宣讲。

### 一键生成
输入产品名称和描述 → 自动生成 Logo → 自动生成营销图 → 自动生成视频广告。

### 时长可控
5 秒到 30 秒，按需选择。

### 免费
Agnes AI 提供免费额度，本项目完全开源。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm run dev
# 打开 http://localhost:3000

# 3. 输入你的 Agnes AI API Key（免费获取）
#    https://platform.agnes-ai.com
```

Windows 用户双击 `启动Agnes.bat` 一键启动。

## 使用流程

```
输入产品信息（名称、描述、卖点）
        ↓
  AI 生成 Logo（3 种风格）
        ↓
  选择你喜欢的 Logo
        ↓
  AI 生成产品图（电商/社交/海报）
        ↓
  AI 生成视频广告（可选：上传人物照片做讲解）
        ↓
  自动保存到 output 文件夹
```

## 图生视频示例

1. 上传一张人物照片
2. 写一段产品介绍文案
3. AI 让照片中的人物「开口说话」，为你讲解产品

适合：
- 电商产品展示
- 社交媒体广告
- 短视频内容
- 个人品牌宣传

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **后端**: Express + WebSocket
- **AI**: Agnes AI（文本/图像/视频生成）
- **视频处理**: FFmpeg

## 输出示例

```
outputs/
└── 2026-06-29_19-20-39_My_Product/
    ├── logo_1.jpg
    ├── logo_2.jpg
    ├── logo_3.jpg
    ├── ecommerce_1.jpg
    ├── social_1.jpg
    ├── video_xxx.mp4
    └── metadata.json
```

## 🤖 Agent 自动化

你可以让 AI Agent（Claude Code、OpenCode 等）自动帮你生成视频。

### 安装 Skill

```bash
# 复制 skill 到你的 agent 配置目录
cp -r skills/agnes-video-generation ~/.config/opencode/skills/
# 或 Claude Code
cp -r skills/agnes-video-generation ~/.claude/skills/
```

### Agent 自动调用

安装后，Agent 会自动识别任务并调用 skill：

```
你：帮我生成一个护肤产品的广告视频
Agent：（自动调用 agnes-video-generation skill）
    1. 生成产品文案
    2. 生成营销图片
    3. 上传图片获取 URL
    4. 调用 Agnes API 生成视频
    5. 返回视频文件
```

### Python 直接调用

```python
from agnes_video import generate_video

result = generate_video(
    image_url="https://example.com/product.jpg",
    prompt="一位专业女性介绍这款护肤品的功效...",
    duration=15,
    api_key="sk-xxx"
)
print(result["video_url"])
```

## 开源协议

[MIT](LICENSE) — 免费使用，自由修改。

---

# English

## What is it?

Agnes Film Studio is a free AI video maker. Enter your product info and AI automatically generates:

- 🎨 **Logo** — Multiple style options
- 📝 **Marketing Copy** — E-commerce, social media, poster content
- 🎬 **Video Ads** — 5-30 seconds with character presentation

**No editing skills. No designers. No actors. Just describe your product.**

## Core Features

### Image-to-Video
Upload a character photo and AI makes them present your product.

### One-Click Generation
Enter product name and description → auto-generate logo → marketing images → video ad.

### Duration Control
5 to 30 seconds, choose as needed.

### Free
Agnes AI provides free credits. This project is fully open source.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

Windows: Double-click `启动Agnes.bat`

## How It Works

```
Enter product info (name, description, features)
        ↓
  AI generates logo (3 styles)
        ↓
  Choose your favorite
        ↓
  AI generates product images (ecommerce/social/poster)
        ↓
  AI generates video ad (optional: upload character photo)
        ↓
  Auto-saved to output folder
```

## Image-to-Video

1. Upload a character photo
2. Write a product introduction
3. AI makes the character "speak" and present your product

Perfect for:
- E-commerce product demos
- Social media ads
- Short video content
- Personal branding

## Agent Automation

Let AI agents generate videos for you automatically.

### Install Skill

```bash
cp -r skills/agnes-video-generation ~/.config/opencode/skills/
# or Claude Code
cp -r skills/agnes-video-generation ~/.claude/skills/
```

### Agent Auto-Call

After installation, agents automatically detect and use the skill:

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

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Express + WebSocket
- **AI**: Agnes AI (text/image/video generation)
- **Video**: FFmpeg

## License

[MIT](LICENSE) — Free to use, free to modify.

---

**Make a free ad for your product** ⭐
