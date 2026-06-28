# Agnes Film — 广告产品聚焦重构计划

## Overview
将 Agnes Film 从通用视频工具重构为 AI 广告视频制作系统。三大核心功能：产品Logo生成（AI推理提示词+3变体）、产品图生图（文字描述或上传→营销图+变体）、AI广告视频（产品图+广告文案→15s人物对话视频）。支持拖拽图片到提示词区域迭代优化。

## File Map
| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | 添加 Product, LogoResult, MarketingImage, AdVideo 类型 |
| `src/utils/api.ts` | Modify | 添加 logoApi, productImageApi, adVideoApi |
| `server.ts` | Modify | 添加 /api/logo/generate, /api/product-image/generate 端点 |
| `src/components/ProductInputStep.tsx` | Create | 产品信息输入（名称、描述、调性、目标平台） |
| `src/components/LogoGenerateStep.tsx` | Create | Logo生成：AI推理提示词→3变体批量生成→拖拽迭代 |
| `src/components/ProductImageStep.tsx` | Create | 产品图生图：文字描述/上传→AI生成营销图+变体 |
| `src/components/AdVideoStep.tsx` | Create | AI广告视频：产品图+文案→提示词优化→15s人物对话视频 |
| `src/components/DragDropZone.tsx` | Create | 通用拖拽图片区域组件，支持拖入图片到提示词 |
| `src/components/ImageVariantGrid.tsx` | Create | 图片变体网格展示组件（3个变体并排） |
| `src/App.tsx` | Modify | 新增广告模式工作流，替换旧分镜模式 |
| `src/App.tsx` | Modify | 移除 StoryboardMode 相关代码 |

## Phases

### Phase A — 类型定义与API层 (parallel track: foundation)
- [x] 1.1 定义广告产品类型 [role: implementer]
  - **Files**: `src/types.ts` (modify)
  - **Do**: 在 types.ts 末尾添加以下类型：
    ```typescript
    export interface Product {
      name: string;
      description: string;
      category: string; // 'digital'|'fashion'|'food'|'home'|'beauty'|'sports'
      style: string; // 'minimalist'|'luxury'|'trendy'|'warm'|'tech'
      targetPlatform: string; // 'taobao'|'douyin'|'xiaohongshu'|'instagram'|'general'
    }

    export interface LogoVariant {
      id: string;
      prompt: string;
      imageUrl?: string;
      status: TaskStatus;
    }

    export interface LogoResult {
      id: string;
      product: Product;
      variants: LogoVariant[];
      createdAt: number;
    }

    export interface MarketingVariant {
      id: string;
      prompt: string;
      imageUrl?: string;
      status: TaskStatus;
      scene: string; // 'ecommerce'|'social'|'poster'|'lifestyle'
    }

    export interface ProductImageResult {
      id: string;
      product: Product;
      sourceImageUrl?: string; // 上传的产品原图
      sourceTextDesc?: string; // 或文字描述
      variants: MarketingVariant[];
      createdAt: number;
    }

    export interface AdVideoResult {
      id: string;
      product: Product;
      sourceImageUrl: string;
      adCopy: string;
      videoPrompt: string;
      characterName?: string;
      characterDescription?: string;
      dialogue?: string;
      videoUrl?: string;
      videoTaskId?: string;
      status: TaskStatus;
      duration: number; // 15
      createdAt: number;
    }

    export type AdWorkflowStep = 'product' | 'logo' | 'product-image' | 'ad-video';
    ```
  - **Accept**: types.ts 包含所有新类型，TypeScript 编译无错误
  - **Verify**: `npx tsc --noEmit`
  <!-- complexity: low -->
  <!-- model: haiku -->

- [x] 1.2 添加广告API函数 [role: implementer]
  - depends: 1.1
  - **Files**: `src/utils/api.ts` (modify)
  - **Do**: 在 api.ts 末尾添加三个API函数：
    - `generateLogoApi(apiKey, product: Product): Promise<{prompt: string, variants: string[]}>` — 调用 /api/logo/generate
    - `generateProductImageApi(apiKey, product: Product, imageUrl?: string, textDesc?: string): Promise<{prompt: string, variants: string[]}>` — 调用 /api/product-image/generate
    - `generateAdVideoApi(apiKey, product: Product, imageUrl: string, adCopy: string, characterName?: string, dialogue?: string): Promise<{videoPrompt: string, duration: number}>` — 调用 /api/ad-video/generate-prompt
    每个函数使用 rateLimiter.acquire()，POST 到对应端点，Bearer token 认证。
  - **Accept**: 三个API函数已导出，TypeScript 编译通过
  - **Verify**: `npx tsc --noEmit`
  <!-- complexity: medium -->
  <!-- model: sonnet -->

- [x] 1.3 添加后端API端点 [role: implementer]
  - depends: 1.1
  - **Files**: `server.ts` (modify)
  - **Do**: 在 server.ts 的 STORYBOARD API 区域之前（约第760行），添加三个端点：
    - `POST /api/logo/generate` — 接收 product 对象，调用 agnes-2.0-flash 生成3个Logo设计提示词（每个提示词针对不同风格变体：简约/活力/高端），返回 `{prompt: string, variants: string[]}`
    - `POST /api/product-image/generate` — 接收 product + imageUrl/textDesc，调用 agnes-2.0-flash 生成3个营销场景提示词（电商主图/社媒素材/品牌海报），返回 `{prompt: string, variants: string[]}`
    - `POST /api/ad-video/generate-prompt` — 接收 product + imageUrl + adCopy + characterName/dialogue，调用 agnes-2.0-flash 生成视频提示词，参考 references/video-prompt-guide.md 的约束规则，返回 `{videoPrompt: string, duration: 15}`
    每个端点使用与现有 /api/storyboard/generate-script 相同的认证和错误处理模式。
  - **Accept**: 三个端点可调用，返回正确JSON，TypeScript 编译通过
  - **Verify**: `npx tsc --noEmit` && 启动服务器后 curl 测试
  <!-- complexity: high -->
  <!-- model: opus -->

### Phase B — UI组件 (parallel track: frontend)
- [x] 2.1 通用拖拽图片区域组件 [role: implementer]
  - **Files**: `src/components/DragDropZone.tsx` (create)
  - **Do**: 创建可复用的 DragDropZone 组件：
    - Props: `{ onImageDrop: (imageUrl: string) => void; className?: string; children?: React.ReactNode }`
    - 支持拖放图片文件（File API 读取为 base64/data URL）
    - 支持拖放图片URL（从其他组件拖过来）
    - 视觉反馈：拖入时边框高亮、虚线框
    - 拖入后显示图片缩略图 + 移除按钮
    - 使用 Tailwind 样式，与项目暗色主题一致
  - **Accept**: 组件可拖入本地图片文件和URL，显示缩略图，点击移除
  - **Verify**: 手动测试拖拽功能
  <!-- complexity: medium -->
  <!-- model: sonnet -->

- [x] 2.2 图片变体网格组件 [role: implementer]
  - **Files**: `src/components/ImageVariantGrid.tsx` (create)
  - **Do**: 创建 ImageVariantGrid 组件：
    - Props: `{ variants: Array<{id: string, imageUrl?: string, prompt: string, status: TaskStatus}>, onSelect?: (id: string) => void, selectedId?: string, onRegenerate?: (id: string) => void }`
    - 3列网格展示变体图片
    - 每个变体显示：图片预览、提示词（可展开）、状态指示器、重新生成按钮
    - 选中态：橙色边框高亮
    - 空状态：显示加载骨架屏或"点击生成"
  - **Accept**: 3个变体正确并排显示，支持选中和重新生成
  - **Verify**: 组件渲染无错误
  <!-- complexity: medium -->
  <!-- model: sonnet -->

- [x] 2.3 产品信息输入步骤 [role: implementer]
  - **Files**: `src/components/ProductInputStep.tsx` (create)
  - **Do**: 创建产品信息输入表单组件：
    - Props: `{ product: Product, onUpdate: (p: Product) => void, onNext: () => void }`
    - 表单字段：产品名称（必填）、产品描述（必填）、产品类别（下拉：数码/服装/食品/家居/美妆/运动）、品牌调性（下拉：简约/奢华/活力/温馨/科技）、目标平台（下拉：淘宝/抖音/小红书/Instagram/通用）
    - 使用与现有 PromptOptimizeStep 一致的暗色主题样式
    - "下一步"按钮，产品名称和描述为空时禁用
    - 参考 references/script-template.md 的产品分析框架
  - **Accept**: 表单所有字段可填写，验证逻辑正确，下一步按钮联动
  - **Verify**: `npx tsc --noEmit`
  <!-- complexity: medium -->
  <!-- model: sonnet -->

- [x] 2.4 Logo生成步骤 [role: implementer]
  - depends: 2.1, 2.2
  - **Files**: `src/components/LogoGenerateStep.tsx` (create)
  - **Do**: 创建Logo生成步骤组件：
    - Props: `{ apiKey: string, product: Product, onBack: () => void, onNext: (logoResult: LogoResult) => void }`
    - 左侧：产品信息摘要卡片
    - 右侧上方：DragDropZone（可选，用于上传参考Logo）
    - 右侧下方：ImageVariantGrid（展示3个Logo变体）
    - "生成Logo"按钮 → 调用 generateLogoApi → 获取3个提示词 → 并行调用 /api/proxy/images 生成3张图片
    - 每个变体支持"重新生成"（调用 /api/proxy/images 重新生成该变体）
    - 拖拽：可将生成的Logo图片拖到提示词区域进行微调再生成
    - "使用此Logo"按钮 → 选中当前Logo → onNext
  - **Accept**: 可生成3个Logo变体，支持重新生成，可拖拽图片到提示词区
  - **Verify**: `npx tsc --noEmit`
  <!-- complexity: high -->
  <!-- model: opus -->

- [x] 2.5 产品图生图步骤 [role: implementer]
  - depends: 2.1, 2.2
  - **Files**: `src/components/ProductImageStep.tsx` (create)
  - **Do**: 创建产品图生图步骤组件：
    - Props: `{ apiKey: string, product: Product, onBack: () => void, onNext: (imageResult: ProductImageResult) => void }`
    - 输入区域二选一：
      1. DragDropZone：上传产品原图
      2. 文字描述输入框：输入产品/服务描述
    - "生成营销图"按钮 → 调用 generateProductImageApi → 获取3个场景提示词（电商主图/社媒素材/品牌海报）→ 并行调用 /api/proxy/images 生成3张
    - ImageVariantGrid 展示3个变体，每个标注场景类型
    - 支持拖拽：生成的图片可拖到提示词区域微调再生成
    - "下一步"按钮 → 选中所有变体 → onNext
  - **Accept**: 支持上传图片或文字描述两种输入方式，3个场景变体正确生成
  - **Verify**: `npx tsc --noEmit`
  <!-- complexity: high -->
  <!-- model: opus -->

- [x] 2.6 AI广告视频步骤 [role: implementer]
  - depends: 2.5
  - **Files**: `src/components/AdVideoStep.tsx` (create)
  - **Do**: 创建AI广告视频步骤组件：
    - Props: `{ apiKey: string, product: Product, sourceImageUrl: string, adCopy: string, onBack: () => void, onComplete: (videoResult: AdVideoResult) => void }`
    - 顶部：产品图片预览 + 广告文案展示
    - 中间：人物对话设置（可选）
      - 人物名称输入框
      - 人物描述输入框
      - 对话台词输入框
    - "AI优化提示词"按钮 → 调用 generateAdVideoApi → 获取 videoPrompt
    - 提示词展示区（可编辑）
    - "生成15s视频"按钮 → 调用 /api/proxy/videos（使用 agnes-video-v2.0，num_frames: 361, frame_rate: 24）→ 轮询 /api/proxy/status
    - 视频预览区：生成完成后播放
    - "完成"按钮 → onComplete
  - **Accept**: 可设置人物对话，AI优化提示词，生成15s视频并预览
  - **Verify**: `npx tsc --noEmit`
  <!-- complexity: high -->
  <!-- model: opus -->

### Phase C — 主流程集成 (sequential: after A & B)
- [x] 3.1 重构App.tsx工作流 [role: implementer]
  - depends: 2.3, 2.4, 2.5, 2.6
  - **Files**: `src/App.tsx` (modify)
  - **Do**: 
    1. 移除所有 StoryboardMode 相关代码（isStoryboardMode, storyboardProject, handleGenerateStoryboard, handleGenerateStoryboardImages, handleGenerateStoryboardVideos, handleRegenerateSingleImage, StoryboardView, StoryboardInputForm, StoryboardTimeline 导入）
    2. 添加广告工作流状态：
       ```typescript
       const [adStep, setAdStep] = useState<AdWorkflowStep>('product');
       const [adProduct, setAdProduct] = useState<Product | null>(null);
       const [logoResult, setLogoResult] = useState<LogoResult | null>(null);
       const [imageResult, setImageResult] = useState<ProductImageResult | null>(null);
       const [videoResult, setVideoResult] = useState<AdVideoResult | null>(null);
       ```
    3. 替换 Header 中的 Storyboard Mode 按钮为"广告模式"按钮
    4. 在主内容区域，广告模式下按 adStep 渲染对应组件：
       - product → ProductInputStep
       - logo → LogoGenerateStep
       - product-image → ProductImageStep
       - ad-video → AdVideoStep
    5. 保留原有单clip工作流作为"创意模式"（旧功能不删除，只是切换入口）
  - **Accept**: 广告模式4步工作流可完整走通，旧功能不受影响
  - **Verify**: `npx tsc --noEmit` && 手动测试完整流程
  <!-- complexity: high -->
  <!-- model: opus -->

- [x] 3.2 清理旧分镜代码 [role: implementer]
  - depends: 3.1
  - **Files**: `src/App.tsx` (modify), `src/types.ts` (modify)
  - **Do**: 
    1. 从 App.tsx 中删除 StoryboardView, StoryboardInputForm, StoryboardTimeline 的 import 和所有使用
    2. 从 types.ts 中删除 StoryboardShot, StoryboardProject, StoryboardPhase, ShotType, CameraMove 类型（保留 VideoClip 等原有类型）
    3. 确保旧的单clip工作流（prompt→image→video→timeline）仍然正常工作
  - **Accept**: 无残留的 Storyboard 引用，TypeScript 编译通过，旧工作流正常
  - **Verify**: `npx tsc --noEmit` && `npm test -- --run`
  <!-- complexity: medium -->
  <!-- model: sonnet -->

### Phase D — 测试与验证 (parallel track: after C)
- [ ] 4.1 单元测试 [role: tester]
  - depends: 3.1
  - **Files**: `src/components/ProductInputStep.test.tsx` (create), `src/components/LogoGenerateStep.test.tsx` (create)
  - **Do**: 为新组件编写测试：
    - ProductInputStep：表单字段渲染、验证逻辑、下一步按钮状态
    - LogoGenerateStep：生成按钮调用API、变体网格渲染
    - 使用现有测试模式（参考 PromptOptimizeStep.test.tsx）
  - **Accept**: 测试通过，覆盖核心交互逻辑
  - **Verify**: `npm test -- --run`
  <!-- complexity: medium -->
  <!-- model: sonnet -->

- [ ] 4.2 集成测试与手动验证 [role: tester]
  - depends: 3.1, 3.2
  - **Files**: 无新文件
  - **Do**: 
    1. 运行 `npm test -- --run` 确保所有现有测试通过
    2. 运行 `npx tsc --noEmit` 确保无类型错误
    3. 启动服务器，手动验证广告模式完整流程
    4. 验证旧的单clip工作流不受影响
  - **Accept**: 所有测试通过，无编译错误，两个工作流均可正常使用
  - **Verify**: `npm test -- --run && npx tsc --noEmit`
  <!-- complexity: low -->
  <!-- model: haiku -->
