# Workflow Optimization Capability Plan

**Date:** 2026-06-26  
**Status:** Ready for Implementation  
**Based on:** User feedback + current codebase analysis

---

## CAPABILITY

**用户（创作者）输入一个故事提示词后，系统自动完成：优化提示词 → 提取角色 → 生成多角度锚点图 → 生成场景图 → 生成视频。每一步用户都可以手动微调，但默认是全自动流水线。**

目标：从 5 步手动流程精简为 3 步，减少用户操作次数 60%，同时保留每个节点的手动干预能力。

---

## CONSTRAINTS

### Fixed Rules
1. **API 端点必须正确**
   - 图片: `https://apihub.agnes-ai.com/v1/images/generations`
   - 视频: `https://apihub.agnes-ai.com/v1/video/generations` (单数 video)
   - 聊天: `https://apihub.agnes-ai.com/v1/chat/completions`

2. **API 超时设置**
   - 图片生成: 60 秒 (AI 生成需要时间)
   - 视频生成: 60 秒
   - 聊天优化: 15 秒

3. **模型选择规则**
   - Text-to-Image: `agnes-image-2.1-flash`
   - Img2Img: `agnes-image-2.0-flash`
   - 视频: `agnes-video-v2.0`
   - 聊天优化: `agnes-2.0-flash`

4. **角色锚点生成顺序**
   - 先生成正面图 (text-to-image)
   - 再用正面图做 img2img 生成其他角度 (strength=0.55)
   - 不是 4 张独立生成

### Invariants
1. 用户在任何步骤都可以点击"编辑"微调文本
2. 微调后的文本会覆盖自动生成的内容
3. 日志必须显示实际发给 API 的完整 prompt
4. 模拟器只在 API 真正失败时使用，不是默认行为

### Scope Boundaries
- 不改变 Timeline 步骤
- 不改变 localStorage 持久化逻辑
- 不改变 WebSocket 视频进度推送逻辑

---

## IMPLEMENTATION CONTRACT

### Actors
- **创作者 (User)**: 输入提示词，微调锚点描述，确认生成
- **系统 (System)**: 自动优化、自动提取、自动生成

### Surfaces
- **Step 1**: Prompt & Anchor (合并原 Step 1 + Step 1.5)
- **Step 2**: Generate Scene Image (保留手动微调)
- **Step 3**: Generate Video (保留手动微调)

### States and Transitions

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Prompt & Anchor                                    │
│                                                             │
│  State: idle → optimizing → extracting → generating → ready │
│                                                             │
│  User can:                                                  │
│  - 编辑提示词 (textarea)                                     │
│  - 点击"优化"重新调用 API                                     │
│  - 编辑角色描述 (textarea)                                    │
│  - 点击"重新生成"重新调用图片 API                              │
│  - 查看实时日志                                               │
│                                                             │
│  Auto-flow:                                                 │
│  1. 用户输入提示词                                            │
│  2. 自动调用 /api/proxy/chat 优化                             │
│  3. 自动提取角色描述 (从优化后的提示词)                         │
│  4. 自动调用 /api/proxy/images 生成正面图                     │
│  5. 自动调用 /api/proxy/images 生成其他 3 个角度 (img2img)     │
│                                                             │
│  [Step 2: Generate Image →]                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Generate Scene Image                               │
│                                                             │
│  State: idle → generating → success / error                 │
│                                                             │
│  User can:                                                  │
│  - 编辑场景提示词                                             │
│  - 切换 img2img 开关                                         │
│  - 调整 img2img strength                                    │
│  - 查看实际发给 API 的 prompt                                 │
│  - 手动刷新检查状态                                           │
│                                                             │
│  [Step 3: Generate Video →]                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Generate Video                                     │
│                                                             │
│  State: idle → creating → polling → completed / failed      │
│                                                             │
│  User can:                                                  │
│  - 编辑视频提示词                                             │
│  - 手动刷新进度                                               │
│  - 查看 WebSocket 实时日志                                    │
│                                                             │
│  [Timeline →]                                               │
└─────────────────────────────────────────────────────────────┘
```

### Interface/Data Implications

**Types unchanged:**
```typescript
// CharacterAnchor - no changes needed
interface CharacterAnchor {
  id: string;
  description: string;
  sheetUrl: string;
  viewUrls: { front?: string; side?: string; back?: string; threeQuarter?: string; };
}

// AppStep - remove 'character', add combined step
type AppStep = 'prompt' | 'image' | 'video' | 'timeline';
//                     ^^^^^^^^^ 'character' removed
```

**New props for PromptOptimizeStep:**
```typescript
interface PromptOptimizeStepProps {
  apiKey: string;
  activeClip: VideoClip;
  characterAnchor: CharacterAnchor | null;
  onUpdateClip: (updates: Partial<VideoClip>) => void;
  onSetCharacterAnchor: (anchor: CharacterAnchor | null) => void;  // NEW
  onNext: () => void;
  onToast?: (toast: ToastItem) => void;  // NEW
}
```

### Observability
- 每步日志显示: 时间戳 + 操作描述 + 实际 prompt + API 响应状态 + 耗时
- 服务端日志: `[Image API] Body: ...` + `[Image API] Response: ...`
- 客户端日志: 实时显示在 UI 的日志面板

---

## NON-GOALS

1. **不改变 Timeline 步骤** — 保持现有合并逻辑
2. **不实现 LoRA 训练** — 未来增强
3. **不实现多角色支持** — 未来增强
4. **不改变 localStorage 格式** — 向后兼容
5. **不改变 WebSocket 协议** — 保持现有视频进度推送

---

## OPEN QUESTIONS

1. **角色描述自动提取准确度** — 如果自动提取不准确，用户需要手动编辑。是否需要增加"重新提取"按钮？
   - **建议**: 保留手动编辑能力，不增加复杂度

2. **锚点图质量** — img2img 生成的其他角度可能与正面图不一致
   - **建议**: 提供"重新生成"按钮，用户可以多次尝试

3. **API 费用** — 每次生成锚点需要 4 次 API 调用
   - **建议**: 在日志中显示 API 调用次数，让用户知情

---

## HANDOFF

**Ready for direct implementation.**

### Implementation Order:
1. 修复 API 端点和超时 (server.ts)
2. 合并 Step 1 + Step 1.5 → 新的 PromptOptimizeStep
3. 更新 AppStep 类型和 App.tsx 路由
4. 更新 ImageGenerateStep 日志显示
5. 更新 VideoGenerateStep 修复视频端点
6. 运行测试验证
7. 手动测试完整流程

### Files to Modify:
| File | Change |
|------|--------|
| `server.ts` | 修复 API 端点, 增加超时, 增加详细日志 |
| `src/types.ts` | 移除 'character' from AppStep |
| `src/App.tsx` | 合并步骤路由, 移除 CharacterAnchorStep |
| `src/components/PromptOptimizeStep.tsx` | 重写为合并页面, 增加锚点生成 |
| `src/components/ImageGenerateStep.tsx` | 增加详细日志显示 |
| `src/components/VideoGenerateStep.tsx` | 修复视频端点 |
| `src/components/CharacterAnchorStep.tsx` | 删除 (功能合并到 PromptOptimizeStep) |
| `src/utils/api.ts` | 检查端点一致性 |
