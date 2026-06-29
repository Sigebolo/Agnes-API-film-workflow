<div align="center">

# Agnes Film Studio 🎬

**AI-powered ad video production system**

*Product info → AI generates logo + marketing images + ad video with character dialogue*

[![License](https://img.shields.io/badge/license-Apache%202.0-orange.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org)

</div>

---

> **Agnes Film Studio** is a self-hosted web app for creating product ad videos. Enter product info → AI generates logo variants → marketing images → ad video with character dialogue. Uses [Agnes AI](https://platform.agnes-ai.com) API for text, image, and video generation.

## ✨ Features

- 🎯 **Ad Mode** — 4-step workflow: Product Info → Logo Design → Product Images → Ad Video
- 🎨 **Logo Generator** — AI generates N style variants (3/5/6/9) from product description
- 📸 **Product Image Generator** — Upload product image or describe it, AI creates E-commerce/Social/Poster variants
- 🎬 **Ad Video** — AI optimizes video prompts, generates 5-30s video with character dialogue
- ⏱️ **Adjustable Duration** — Choose video length from 5s to 30s (5s increments)
- 👤 **Character Dialogue** — Add character name, description, and dialogue lines to ad videos
- 🖱️ **Drag & Drop** — Drag generated images to prompt area for iterative refinement
- 💾 **Auto-Save** — All generated images and videos automatically saved to output folder
- 🔄 **State Persistence** — Switch pages without losing progress; logo variants, selected images, and generation status persist
- 🎨 **Creative Mode** — Single-clip workflow: Prompt optimize → Image → Video → Timeline

## 🚀 Quick Start

**Prerequisites:** Node.js ≥ 18, [FFmpeg](https://ffmpeg.org/download.html) installed, Agnes AI API key

```bash
git clone https://github.com/Sigebolo/Agnes-API-film-workflow.git
cd Agnes-API-film-workflow
npm install
npm run dev
# → http://localhost:3000
```

Or use the one-click startup script (Windows):
```
双击 启动Agnes.bat
```

Then enter your Agnes AI API key in the left sidebar. Get one at [platform.agnes-ai.com](https://platform.agnes-ai.com).

## 🎬 Workflow

### Ad Mode (Recommended)
```
Product Info
    ↓
AI Logo Generation  (agnes-image-2.1-flash, N variants)
    ↓
User Selects Logo
    ↓
AI Product Images  (E-commerce / Social / Poster variants)
    ↓
AI Ad Video  (agnes-video-v2.0, 5-30s with character dialogue)
    ↓
Export + Auto-Save to Output Folder
```

### Creative Mode
```
Story Outline
    ↓
AI Script + Shot List  (agnes-2.0-flash)
    ↓
Batch Image Generation  (agnes-image-2.1-flash)
    ↓
User Approval Gate
    ↓
Batch Video Generation  (agnes-video-v2.0, 5-30s per shot)
    ↓
Timeline Merge + TTS Voiceover  (FFmpeg)
    ↓
Export Final Video
```

## 🏗 Architecture

| Layer | Stack |
|-------|-------|
| **Frontend** | React 19 + TypeScript + Tailwind CSS + Framer Motion |
| **Backend** | Express + WebSocket server (TypeScript, tsx) |
| **AI** | Agnes AI API — text, image, video generation |
| **Image Upload** | freeimage.host (for public URLs required by Agnes API) |
| **Video** | FFmpeg (merge + voiceover dub + trim) |
| **Build** | Vite (frontend) + esbuild (server) |

## 📁 Project Structure

```
agnes-film-studio/
├── server.ts              # Express + WebSocket server, Agnes AI proxy
├── 启动Agnes.bat          # One-click startup script (Windows)
├── references/            # Ad creative guides (prompt templates, script formats)
├── outputs/               # Auto-saved generated images and videos
├── src/
│   ├── App.tsx            # Root — Ad Mode (4-step) + Creative Mode
│   ├── components/
│   │   ├── ProductInputStep.tsx     # Product info input form
│   │   ├── LogoGenerateStep.tsx     # Logo generation with N variants
│   │   ├── ProductImageStep.tsx     # Product image generation
│   │   ├── AdVideoStep.tsx          # AI ad video generation (5-30s)
│   │   ├── DragDropZone.tsx         # Reusable drag-and-drop component
│   │   ├── ImageVariantGrid.tsx     # Variant image grid display
│   │   ├── ImageGenerateStep.tsx    # Single-clip image generation
│   │   ├── VideoGenerateStep.tsx    # Single-clip video generation
│   │   ├── PromptOptimizeStep.tsx   # Prompt optimization
│   │   ├── Sidebar.tsx              # Task history + workflow progress
│   │   └── Timeline.tsx            # Multi-clip timeline merge
│   ├── types.ts           # TypeScript interfaces
│   └── utils/
│       ├── api.ts         # Agnes API client + auto-save helpers
│       ├── storage.ts     # LocalStorage persistence (workflow + ad state)
│       ├── imageCompress.ts  # Client-side image compression
│       └── rateLimiter.ts # Token bucket rate limiter
└── tests/                 # Vitest unit tests (54 tests)
```

## ⚙️ Configuration

No `.env` file needed. The Agnes API key is entered in the UI and stored in browser `localStorage`.

For production deployment, set the `NODE_ENV=production` and run:

```bash
npm run build
npm start
```

## 📤 Output Folder

All generated assets are automatically saved to timestamped folders:

```
outputs/
├── 2026-06-29_19-20-39_AI_Accounting_Software/
│   ├── logo_1.jpg
│   ├── logo_2.jpg
│   ├── logo_3.jpg
│   ├── ecommerce_1.jpg
│   ├── social_1.jpg
│   ├── poster_1.jpg
│   ├── video_1782710439000.mp4
│   └── metadata.json
```

## ⚠️ Known Limitations

- Video duration is configurable from **5-30 seconds** (5s increments)
- Logo and image generation uses **3 variants by default** (configurable up to 9)
- TTS voiceover uses Google Translate's unofficial endpoint — may be rate-limited or unavailable
- Video merging requires **FFmpeg** installed on the server host
- Character consistency across shots is approximate — AI models don't guarantee pixel-perfect identity
- Image upload uses freeimage.host (free tier, may have rate limits)

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss major changes.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

## 📄 License

[Apache 2.0](LICENSE) — see LICENSE for full text.
