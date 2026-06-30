<div align="center">

# 🎬 Agnes Film Studio

**AI-powered short video production studio**

*Generate product ads, short dramas, and marketing content with AI — no video editing skills required*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-required-orange.svg)](https://ffmpeg.org)

[![Watch Demo](https://img.shields.io/badge/📹-Watch_Demo-red)](#)
[![Star](https://img.shields.io/github/stars/Sigebolo/Agnes-API-film-workflow?style=social)](https://github.com/Sigebolo/Agnes-API-film-workflow)

</div>

---

## What is this?

Agnes Film Studio is a self-hosted web app that turns your product description into a complete ad video. Enter your product info → AI generates logo → marketing images → video with character dialogue. All powered by [Agnes AI](https://platform.agnes-ai.com) APIs.

**No video editing. No design skills. Just describe your product.**

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Ad Studio** | End-to-end product ad: Product Info → Logo → Product Images → Video |
| 🎨 **AI Logo** | Generate N style variants from product description |
| 📸 **Product Images** | E-commerce, Social Media, Poster styles — all from one prompt |
| 🎬 **Ad Video** | AI optimizes prompt, generates 5-30s video with character dialogue |
| ⏱️ **Duration Control** | Choose video length: 5s / 10s / 15s / 20s / 25s / 30s |
| 🖱️ **Drag & Drop** | Drag any generated image into prompt area for iteration |
| 💾 **Auto-Save** | All images/videos saved to timestamped output folders |
| 🔄 **State Persistence** | Switch pages without losing progress |
| 📋 **Task Registry** | Query all tasks, track status, refresh, delete |
| ✂️ **Video Trimming** | Trim unwanted segments with FFmpeg |
| 🎞️ **Creative Mode** | Storyboard → Batch Images → Batch Videos → Timeline Merge |
| 📝 **Script Injection** | 4-part ad structure: Opening → Showcase → Selling Points → Ending |

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **FFmpeg** installed and in PATH
- **Agnes AI** API key → [Get one here](https://platform.agnes-ai.com)

### Install

```bash
git clone https://github.com/Sigebolo/Agnes-API-film-workflow.git
cd Agnes-API-film-workflow
npm install
npm run dev
# → http://localhost:3000
```

### One-click Startup (Windows)

双击 `启动Agnes.bat` — auto-builds if needed, cleans up old processes, opens browser.

## 🎬 Workflow

### Ad Mode (Recommended)

```
┌─────────────────┐
│  Product Info    │  Name, description, features, target audience
└────────┬────────┘
         ▼
┌─────────────────┐
│  AI Logo         │  Generate N style variants (3/5/6/9)
└────────┬────────┘
         ▼
┌─────────────────┐
│  AI Images       │  E-commerce / Social / Poster variants
└────────┬────────┘
         ▼
┌─────────────────┐
│  AI Video        │  5-30s with character dialogue
└────────┬────────┘
         ▼
┌─────────────────┐
│  Auto-Save       │  outputs/YYYY-MM-DD_HH-MM-SS_topic/
└─────────────────┘
```

### Creative Mode (Short Drama / Batch)

```
Story Outline
    ↓
AI Script + Shot List (agnes-2.0-flash)
    ↓
Batch Image Generation (per shot)
    ↓
User Approval Gate (regenerate before video)
    ↓
Batch Video Generation (5-30s per shot)
    ↓
Timeline Merge + TTS Voiceover (FFmpeg)
    ↓
Export Final Video
```

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  React 19 + TypeScript + Tailwind + Framer       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Ad Studio│ │ Creative │ │ Task History     │ │
│  │ 4-step   │ │ Storyboard│ │ (Query/Refresh) │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────┬──────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────────┐
│                  Backend                         │
│  Express + WebSocket (TypeScript)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Agnes    │ │ Output   │ │ FFmpeg           │ │
│  │ API Proxy│ │ Folder   │ │ (Trim/Merge)     │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│               Agnes AI API                       │
│  Text / Image / Video Generation                 │
└─────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
agnes-film-studio/
├── server.ts                  # Express + WebSocket + Agnes AI proxy
├── 启动Agnes.bat              # One-click startup (Windows)
├── agnes_video.py             # Standalone Python video generator
├── references/                # Prompt templates & script formats
│   ├── video-prompt-guide.md  # Video prompt constraints
│   └── script-template.md     # 4-part ad script structure
├── outputs/                   # Auto-saved generated assets
├── src/
│   ├── App.tsx               # Root — Ad Mode + Creative Mode
│   ├── components/
│   │   ├── ProductInputStep.tsx      # Product info form
│   │   ├── LogoGenerateStep.tsx      # Logo gen with N variants
│   │   ├── ProductImageStep.tsx      # Product image gen
│   │   ├── AdVideoStep.tsx           # Ad video gen (5-30s)
│   │   ├── ImageGenerateStep.tsx     # Single-clip image gen
│   │   ├── VideoGenerateStep.tsx     # Single-clip video gen
│   │   ├── PromptOptimizeStep.tsx    # Prompt optimization
│   │   ├── Sidebar.tsx              # Task history + progress
│   │   ├── Timeline.tsx             # Timeline merge + export
│   │   ├── DragDropZone.tsx         # Drag-and-drop component
│   │   └── ImageVariantGrid.tsx     # Variant grid display
│   ├── types.ts              # TypeScript interfaces
│   └── utils/
│       ├── api.ts            # API client + auto-save helpers
│       ├── storage.ts        # LocalStorage persistence
│       ├── imageCompress.ts  # Client-side compression
│       └── rateLimiter.ts    # Token bucket rate limiter
└── tests/                    # Vitest unit tests (54 tests)
```

## ⚙️ Configuration

No `.env` file needed. API key is entered in the UI and stored in browser `localStorage`.

### Environment Variables (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Set to `production` for deployment |

### Production Deployment

```bash
npm run build
npm start
# → http://localhost:3000
```

## 📤 Output Structure

All generated assets auto-saved to timestamped folders:

```
outputs/
├── 2026-06-29_19-20-39_AI_Accounting_Software/
│   ├── logo_1.jpg              # Logo variants
│   ├── logo_2.jpg
│   ├── logo_3.jpg
│   ├── ecommerce_1.jpg         # Product images
│   ├── social_1.jpg
│   ├── poster_1.jpg
│   ├── video_xxx.mp4           # Generated video
│   ├── reference.jpg           # Reference image (if used)
│   └── metadata.json           # Generation parameters
```

## 🐍 Standalone Python Generator

For agent workflows or batch processing:

```python
from agnes_video import generate_video

result = generate_video(
    image_url="https://example.com/product.jpg",
    prompt="A confident woman presenting the product...",
    duration=15,
    api_key="sk-xxx"
)
# result = {"video_id": "...", "status": "completed", "video_url": "..."}
```

Or CLI:

```bash
python agnes_video.py \
  --image https://example.com/product.jpg \
  --prompt "A confident woman presenting the product..." \
  --duration 15 \
  --api-key "sk-xxx" \
  --output video.mp4
```

## 🧪 Testing

```bash
npm test          # Run all 54 unit tests
```

Tests cover: API client, task registry, output folder management, rate limiter, compression, and more.

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

### Development Setup

```bash
npm install
npm run dev        # Start dev server with hot reload
npm test           # Run tests
npm run build      # Build for production
```

## 📝 Changelog

### v1.0.0 (2026-06-29)
- Ad Studio workflow (Product → Logo → Images → Video)
- Creative Mode with storyboard
- Video duration selector (5-30s)
- Task registry with Query All
- Auto-save to timestamped folders
- Video trimming with FFmpeg
- State persistence across navigation
- Standalone Python video generator
- Image compression before upload
- Drag-and-drop image reference

## 📄 License

[MIT](LICENSE)

---

<div align="center">

**Built with ❤️ using [Agnes AI](https://platform.agnes-ai.com)**

*Give it a ⭐ if you find it useful!*

</div>
