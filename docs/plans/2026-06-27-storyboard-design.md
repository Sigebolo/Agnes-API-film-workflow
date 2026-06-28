# Agnes Film Studio - 智能分镜系统设计

## 概述

基于 Agnes API 的 5 秒视频特性，构建智能分镜流水线：
**输入故事大纲 → AI 生成剧本 → 自动拆分镜头 → 批量生成图片 → 批量生成视频 → 时间线组装**

## 核心约束

- 每个镜头固定 5 秒（Agnes 视频 API 限制）
- 主人公锚点：同一个角色在所有镜头中保持一致
- 每个镜头中其他角色只能出现一次（避免不一致）
- 用户可随时微调每个镜头的提示词

## 数据模型

### StoryboardShot（单个镜头）

```typescript
interface StoryboardShot {
  id: string;
  index: number;           // 排序
  scene: string;           // 场景描述
  shotType: 'close-up' | 'medium' | 'wide' | 'extreme-close';
  cameraMove: 'static' | 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'tilt-up' | 'tilt-down';
  characters: string[];    // 出场角色名（锚点角色自动包含）
  characterActions: Record<string, string>; // 角色动作 { "女主": "微笑点头" }
  dialogue: string;        // 台词/旁白
  dialogueSpeaker: string; // 说话人
  emotion: string;         // 情绪氛围
  imagePrompt: string;     // AI 生成的图片提示词（用户可微调）
  videoPrompt: string;     // AI 生成的视频提示词（用户可微调）
  imageUrl?: string;       // 生成的图片 URL
  videoUrl?: string;       // 生成的视频 URL
  videoTaskId?: string;    // 视频任务 ID
  videoTaskStatus: 'pending' | 'generating' | 'completed' | 'failed';
  imageStatus: 'pending' | 'generating' | 'completed' | 'failed';
  duration: 5;             // 固定 5 秒
}
```

### StoryboardProject（项目）

```typescript
interface StoryboardProject {
  id: string;
  title: string;
  protagonist: {
    name: string;
    description: string;   // 外貌描述
    anchorImageUrl?: string; // 锚点图片
  };
  script: string;          // AI 生成的完整剧本
  shots: StoryboardShot[];
  status: 'draft' | 'generating-images' | 'generating-videos' | 'completed';
  createdAt: number;
}
```

## 工作流程

### Step 1: 输入故事大纲

用户输入：
- 故事大纲/产品描述（文本）
- 主人公名称和外貌描述（可选，AI 可自动生成）
- 风格选择（写实/动漫/3D 等）

### Step 2: AI 生成剧本 + 分镜表

调用 Agnes 文本 API（`agnes-2.0-flash`），输入故事大纲，输出：

```markdown
# 剧本：《XXX》

## 场景 1：清晨办公室
镜头 1 | 特写 | 静态 | 女主看着电脑屏幕，眉头微皱
台词：这个数据有问题...
情绪：紧张、专注

镜头 2 | 中景 | 缓慢推近 | 女主站起来，走向白板
台词：让我重新分析一下
情绪：自信、果断

## 场景 2：会议室
镜头 3 | 全景 | 静态 | 女主在白板前讲解，同事们认真听
台词：我们的方案是...
情绪：专业、权威
...
```

同时为每个镜头生成 `imagePrompt` 和 `videoPrompt`。

### Step 3: 批量生成锚点图

为每个出场角色生成锚点图（用于保持一致性）：
- 主人公：生成 1 张高质量锚点图
- 配角：在对应镜头中生成时作为参考

### Step 4: 批量生成图片

按顺序为每个镜头生成参考图：
- 使用 `imagePrompt` + 主人公锚点图作为参考
- 调用 Agnes 图片 API（`agnes-image-2.1-flash`）
- 显示批量生成进度
- 用户可选择微调某个镜头的提示词后重新生成（可选，不强制）

### Step 5: 用户审核图片

所有图片生成完成后：
- 展示所有镜头的生成结果
- 用户对比前后镜头，检查一致性
- 可选择：接受 / 重新生成某个镜头
- **用户点击"批准"按钮后才进入下一步**

### Step 6: 批量生成视频

用户批准后，批量生成 5 秒视频：
- 使用图片 + `videoPrompt` 生成视频
- 调用 Agnes 视频 API（`agnes-video-v2.0`）
- 自动处理唇形同步（台词 → TTS → 视频）
- 显示实时进度条

### Step 7: 时间线组装

所有 5 秒视频片段自动排列到时间线：
- 按镜头顺序排列
- 添加转场效果（可选）
- 导出最终视频

## UI 设计

### 分镜表视图（核心界面）

```
┌─────────────────────────────────────────────────────────┐
│ 📋 Storyboard: 《产品宣传片》                    [Export] │
├─────────────────────────────────────────────────────────┤
│ 👤 Protagonist: 小美 | 28岁女性，短发，白色衬衫        │
│ 📝 Script: AI 生成的剧本预览...                [Edit]   │
├─────────────────────────────────────────────────────────┤
│ Shot 1         Shot 2         Shot 3         Shot 4     │
│ ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐ │
│ │ [Image] │   │ [Image] │   │ [Image] │   │ [Image] │ │
│ │         │   │         │   │         │   │         │ │
│ └─────────┘   └─────────┘   └─────────┘   └─────────┘ │
│ 特写·静止      中景·推近      全景·静止      特写·拉远   │
│ "这个数据..."  "让我分析"     "方案是..."    "明白了"    │
│ [Edit] [Gen]  [Edit] [Gen]  [Edit] [Gen]  [Edit] [Gen] │
├─────────────────────────────────────────────────────────┤
│ Phase 1: [Generate Images] ✅ Done → Phase 2: [Approve & Generate Videos] │
└─────────────────────────────────────────────────────────┘
```

### 单镜头编辑面板

点击某个镜头展开：
- 画面描述（可编辑）
- 图片提示词（可编辑）+ 重新生成按钮
- 视频提示词（可编辑）
- 角色动作（可编辑）
- 台词（可编辑）
- 情绪（可编辑）
- 运镜方式（下拉选择）
- 景别（下拉选择）

## API 设计

### 后端路由

```
POST /api/storyboard/generate-script    # AI 生成剧本+分镜
POST /api/storyboard/batch-generate-images  # 批量生成图片
POST /api/storyboard/batch-generate-videos  # 批量生成视频
GET  /api/storyboard/status/:projectId  # 查询生成进度
PUT  /api/storyboard/shot/:shotId       # 更新单个镜头
POST /api/storyboard/shot/:shotId/regenerate  # 重新生成某镜头
```

### 剧本生成 Prompt

```
你是一位专业的短视频分镜师。根据以下故事大纲，生成分镜表。

要求：
1. 每个镜头固定 5 秒
2. 主人公 [{protagonist}] 贯穿所有镜头
3. 其他角色每个镜头最多出现 1 人
4. 包含：景别、运镜、角色动作、台词、情绪
5. 台词要简短有力，适合 5 秒内说完
6. 画面描述要具体，适合 AI 图片生成

故事大纲：{outline}
风格：{style}
预计时长：{duration} 秒（{duration/5} 个镜头）

输出格式：
## 场景 N：{场景名}
镜头 N | {景别} | {运镜} | {角色动作}
台词：{台词}
情绪：{情绪}
imagePrompt: {英文图片生成提示词}
videoPrompt: {英文视频运镜描述}
```

## 实现计划

### Phase 1: 数据模型 + 基础 UI（1-2 天）
- 定义 TypeScript 类型
- 创建分镜表 UI 组件
- 实现镜头卡片展示

### Phase 2: AI 剧本生成（1 天）
- 实现 `/api/storyboard/generate-script` 路由
- 调用 Agnes 文本 API 生成剧本+分镜
- 解析 AI 输出为结构化数据

### Phase 3: 提示词编辑 + 图片生成（1-2 天）
- 实现镜头编辑面板
- 实现批量图片生成
- 前端显示生成进度

### Phase 4: 视频生成 + 时间线（1-2 天）
- 复用现有视频生成功能
- 实现批量视频生成
- 时间线组装和导出

### Phase 5: 优化 + 测试（1 天）
- 拖拽排序
- 错误处理和重试
- 单元测试
