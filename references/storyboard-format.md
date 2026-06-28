# 分镜设计格式规范

## 分镜格式（JSON）

```json
{
  "storyboard": [
    {
      "id": "seg_01",
      "sequence": 1,
      "duration": 4.0,
      "scene_type": "opening",
      "visual_description": "科技感城市夜景，蓝色和紫色灯光在建筑间流转，镜头缓慢推近",
      "product_position": {
        "location": "none",
        "size": "none",
        "action": "none"
      },
      "digital_human": {
        "position": "voiceover",
        "appearance": "professional female, business attire",
        "action": "voice narration only"
      },
      "camera_movement": "slow push in",
      "lighting": "neon lights, cool tones, cinematic",
      "text_overlay": null,
      "transition": "fade in"
    }
  ]
}
```

## 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 分镜唯一标识符 |
| `sequence` | integer | 是 | 序号（1, 2, 3...） |
| `duration` | float | 是 | 时长（秒） |
| `scene_type` | string | 是 | 场景类型：opening/showcase/selling/ending |
| `visual_description` | string | 是 | 画面详细描述 |
| `product_position` | object | 是 | 商品位置和展示方式 |
| `digital_human` | object | 是 | 数字人配置 |
| `camera_movement` | string | 是 | 摄像机运动 |
| `lighting` | string | 是 | 灯光描述 |
| `text_overlay` | string/null | 否 | 文字叠加内容 |
| `transition` | string | 是 | 转场方式 |

## 场景类型

| 类型 | 用途 | 时长建议 | 画面特点 |
|------|------|---------|---------|
| `opening` | 吸引注意，建立氛围 | 3-5秒 | 氛围感强，商品可以不出场 |
| `showcase` | 多角度展示商品 | 5-15秒 | 商品为主，细节清晰 |
| `selling` | 突出卖点和功能 | 5-10秒 | 场景化展示，结合使用 |
| `ending` | 品牌强化和行动引导 | 3-5秒 | 简洁明了，CTA明确 |

## 商品位置

| 位置 | 适用场景 | 说明 |
|------|---------|------|
| `none` | 开场、纯氛围场景 | 商品不出场 |
| `center` | 展示、卖点 | 商品居中，最显眼 |
| `left` | 数字人配合 | 数字人在右侧，商品在左侧 |
| `right` | 数字人配合 | 数字人在左侧，商品在右侧 |
| `background` | 数字人为主 | 商品作为背景元素 |

## 商品尺寸

| 尺寸 | 适用场景 | 说明 |
|------|---------|------|
| `close-up` | 细节展示 | 商品占据画面70-90% |
| `medium` | 整体展示 | 商品占据画面40-60% |
| `full` | 场景展示 | 商品与场景协调 |

## 数字人位置

| 位置 | 说明 | 适用场景 |
|------|------|---------|
| `voiceover` | 画外音，不出镜 | 开场、结尾 |
| `left` | 在画面左侧 | 商品在右侧时 |
| `right` | 在画面右侧 | 商品在左侧时 |
| `center` | 居中，与商品共存 | 商品作为背景时 |

## 摄像机运动

| 运动 | 效果 | 适用场景 |
|------|------|---------|
| `static` | 静止 | 强调稳定性、细节 |
| `push in` | 推近 | 引导注意力、聚焦 |
| `pull back` | 拉远 | 展示环境、全景 |
| `pan left/right` | 平移 | 跟随物体、扫描 |
| `tilt up/down` | 俯仰 | 展示高度、层次 |
| `orbit` | 环绕 | 展示360度、立体感 |
| `zoom in/out` | 变焦 | 突出重点、环境 |

## 灯光描述

| 灯光类型 | 效果 | 适用产品 |
|---------|------|---------|
| `studio lighting` | 专业、干净 | 数码、化妆品 |
| `natural daylight` | 自然、真实 | 服装、家居 |
| `neon lights` | 科技、潮流 | 数码、潮流商品 |
| `warm lighting` | 温馨、舒适 | 家居、母婴 |
| `dramatic lighting` | 戏剧、高端 | 奢侈品、艺术品 |
