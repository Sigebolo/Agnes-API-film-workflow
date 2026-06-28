# 视频生成Prompt约束指南（强化版）

## 最高优先级原则（⚠️ 强制执行）

**商品主体100%保持原貌**
- **绝对禁止**：任何形式的商品变形、扭曲、拉伸、压缩
- **绝对禁止**：改变商品的形状、结构、包装外观
- **绝对禁止**：商品出现不可能的动态效果（如沙琪玛喷牛奶、饼干喷彩带等）
- **绝对禁止**：商品与其实际属性不符的行为（如非液体商品喷洒、非可燃商品燃烧等）
- **必须保持**：商品的原始外观、颜色、材质、形状与扣图完全一致
- **设计核心**：通过运镜、打光、场景来增强展示，而不是改变商品本身

## 生成原则

### 1. 自然真实原则
- 避免夸张变形：商品外观必须保持真实比例和形态
- 避免诡异动作：物体运动应自然流畅，符合物理规律
- 避免过度渲染：不追求过度艺术化的效果，保持商品原貌
- 避免风格突变：同一商品在不同镜头中保持一致的风格和色调

### 2. 符合商品特性
- 材质匹配：根据商品材质选择合适的光照和质感描述
- 功能适配：视频内容应与商品核心功能相关联
- 场景合理：展示场景应与商品实际使用场景相符
- 受众契合：画面风格应与目标受众审美匹配

### 3. 专业广告标准
- 品牌调性统一：所有分镜的视觉风格保持一致性
- 视觉重点突出：商品始终是画面主体，背景不喧宾夺主
- 画面清晰稳定：避免模糊、抖动、失焦
- 色彩协调统一：色调符合品牌定位和商品属性

## 最保险的画面生成方案

### 核心原则
- 商品完全静态，只通过运镜展示
- 避免任何商品动态效果
- 通过多商品组合或场景丰富画面

### 推荐运镜（按优先级排序）
1. **往前推**：突出商品细节，从整体到局部
2. **旋转运镜**：展示商品360度视角
3. **平移运镜**：横向或纵向展示多个商品或场景
4. **环绕运镜**：围绕商品中心，展示立体感
5. **静止镜头**：商品完全静态展示（最保险）

## 禁止的动态效果（强制执行）

1. 商品内部/表面喷洒效果
2. 商品变形效果（融化、扭曲、拉伸、压缩）
3. 不可能的物理互动（自行移动、漂浮、飞行）
4. 过度的特效叠加
5. 与商品属性不符的行为

## Prompt模板

### 模板1：简约风格（数码、办公用品）
```
A professional product photography of a [商品描述],
[商品关键特征],
the product is placed on a clean and minimalist [场景环境],
professional studio lighting with soft highlights and subtle shadows,
[摄像机：缓慢推拉或环绕运镜],
[风格关键词：modern, sleek, minimalist, professional],
sharp focus on the entire product,
the product's shape, structure, and appearance remain exactly as shown in the reference,
4K resolution, commercial quality, subtle camera movement only
```

### 模板2：生活方式（服装、家居、日用品）
```
A lifestyle photography showcasing a [商品描述],
[商品在场景中的位置，保持自然],
[具体生活场景描述],
natural light with warm and inviting atmosphere,
[摄像机：温和的平移或缓慢推拉运镜],
[风格关键词：authentic, comfortable, lifestyle, natural],
the product maintains its original appearance and structure in the scene,
natural textures and colors as in the reference,
4K quality, lifestyle commercial style, subtle and natural movement
```

### 模板3：奢华质感（高端产品、奢侈品）
```
A premium product photography of a [商品描述],
elegant and sophisticated [场景环境],
cinematic lighting with dramatic highlights and shadows emphasizing texture,
[摄像机：缓慢特写或精细运镜],
[风格关键词：luxurious, elegant, premium, sophisticated],
sharp focus, the product's luxury features are enhanced by lighting, not by distortion,
the product shape and structure remain perfectly consistent,
4K resolution, high-end commercial quality, elegant camera work
```

### 模板4：活力时尚（年轻、潮流商品）
```
A dynamic yet controlled commercial shot of a [商品描述],
[商品的时尚特征],
[场景环境],
vibrant colors and bold contrasts in the background,
[摄像机：有节奏感的运镜，但不过于激烈],
[风格关键词：energetic, trendy, vibrant, fashionable],
the product maintains its original shape and structure throughout the shot,
youthful and fashionable atmosphere created by environment and camera,
not by distorting the product,
4K quality, modern commercial style, controlled energy
```

### 模板5：温馨治愈（母婴、家居、食品）
```
A warm and heartwarming scene featuring a [商品描述],
[商品在温馨场景中的展示],
soft and gentle lighting creating a cozy atmosphere,
[环境细节],
[摄像机：温和的运镜],
[风格关键词：warm, cozy, heartwarming, gentle],
the product appears natural and authentic in the setting,
its appearance and structure match the reference perfectly,
4K quality, emotional commercial style, gentle presentation
```

### 通用约束（所有模板必须遵守）
```
必须在Prompt中明确声明：
- "the product's shape, structure, and appearance remain exactly as shown in reference"
- "no distortion, no deformation, no exaggeration"
- "product maintains original appearance throughout shot"
- "camera movement only, product stays static/natural"
```
