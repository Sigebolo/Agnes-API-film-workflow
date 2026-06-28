<div align="center">

# Agnes Film Studio 🎬

**AI-powered ad video production system**

*Product info → AI generates logo + marketing images + 15s ad video with character dialogue*

[![License](https://img.shields.io/badge/license-Apache%202.0-orange.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org)

</div>

---

> **Agnes Film Studio** is a self-hosted web app for creating product ad videos. Enter product info → AI generates logo variants → marketing images → 15-second ad video with character dialogue. Uses [Agnes AI](https://platform.agnes-ai.com) API for text, image, and video generation.

## ✨ Features

- 🎯 **Ad Mode** — 4-step workflow: Product Info → Logo Design → Product Images → Ad Video
- 🎨 **Logo Generator** — AI generates N style variants (3/5/6/9) from product description
- 📸 **Product Image Generator** — Upload product image or describe it, AI creates E-commerce/Social/Poster variants
- 🎬 **15s Ad Video** — AI optimizes video prompts with product integrity rules, generates 15-second video
- 👤 **Character Dialogue** — Add character name, description, and dialogue lines to ad videos
- 🖱️ **Drag & Drop** — Drag generated images to prompt area for iterative refinement
- 🎨 **Creative Mode** — Single-clip workflow: Prompt optimize → Image → Video → Timeline

## 🚀 Quick Start

**Prerequisites:** Node.js ≥ 18, [FFmpeg](https://ffmpeg.org/download.html) installed, Agnes AI API key

```bash
git clone https://github.com/yourname/agnes-film-studio
cd agnes-film-studio
npm install
npm run dev
# → http://localhost:3000
```

Then enter your Agnes AI API key in the left sidebar. Get one at [platform.agnes-ai.com](https://platform.agnes-ai.com).

## 🎬 Workflow

```
Story Outline
    ↓
AI Script + Shot List  (agnes-2.0-flash)
    ↓
Batch Image Generation  (agnes-image-2.1-flash)
    ↓
User Approval Gate
    ↓
Batch Video Generation  (agnes-video-2.1, 5s per shot)
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
| **Video** | FFmpeg (merge + voiceover dub) |
| **Build** | Vite (frontend) + esbuild (server) |

## 📁 Project Structure

```
agnes-film-studio/
├── server.ts              # Express + WebSocket server, Agnes AI proxy
├── references/            # Ad creative guides (prompt templates, script formats)
├── src/
│   ├── App.tsx            # Root — Ad Mode (4-step) + Creative Mode
│   ├── components/
│   │   ├── ProductInputStep.tsx     # Product info input form
│   │   ├── LogoGenerateStep.tsx     # Logo generation with N variants
│   │   ├── ProductImageStep.tsx     # Product image generation
│   │   ├── AdVideoStep.tsx          # AI ad video generation (15s)
│   │   ├── DragDropZone.tsx         # Reusable drag-and-drop component
│   │   ├── ImageVariantGrid.tsx     # Variant image grid display
│   │   ├── ImageGenerateStep.tsx    # Single-clip image generation
│   │   ├── VideoGenerateStep.tsx    # Single-clip video generation
│   │   ├── PromptOptimizeStep.tsx   # Prompt optimization
│   │   └── Timeline.tsx            # Multi-clip timeline merge
│   ├── types.ts           # TypeScript interfaces
│   └── utils/
│       ├── api.ts         # Agnes API client functions
│       └── rateLimiter.ts # Token bucket rate limiter
└── tests/                 # Playwright E2E + Vitest unit tests
```

## ⚙️ Configuration

No `.env` file needed. The Agnes API key is entered in the UI and stored in browser `localStorage`.

For production deployment, set the `NODE_ENV=production` and run:

```bash
npm run build
npm start
```

## ⚠️ Known Limitations

- Ad video is fixed at **15 seconds** (num_frames: 361, frame_rate: 24)
- Logo and image generation uses **3 variants by default** (configurable up to 9)
- TTS voiceover uses Google Translate's unofficial endpoint — may be rate-limited or unavailable; treat as best-effort
- Video merging requires **FFmpeg** installed on the server host
- Character consistency across shots is approximate — AI models don't guarantee pixel-perfect identity

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss major changes.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

## 📄 License

[Apache 2.0](LICENSE) — see LICENSE for full text.
