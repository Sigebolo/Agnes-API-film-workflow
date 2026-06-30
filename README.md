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

**给你的产品做一个免费广告** ⭐
