# 02《你敢算吗》· Agnes 视频剧本（4镜 × 15秒 = 60秒口播）

> 模型：`agnes-video-v2.0`（`num_frames` 按15秒对齐，`frame_rate: 24`）
> 统一人物（4镜同脸）：锚点图 `anchor_02_accountant.png`（Agnes image 2.5 生成，16:9 2K），每镜都做 image-to-video。
> 统一穿着：深藏青色西装外套 + 白色衬衫 + 珍珠耳钉，长发，淡妆。
> 统一环境：现代会计师办公室，背景虚化书架+绿植，自然暖光。
> 机位：胸上景别，直视镜头，缓慢推近。

---

## 镜1（0–15秒）：开场质问

**画面**：美女会计师直视镜头，表情严肃关切，办公室暖光。
**运镜**：缓慢推近（slow push-in），0-3秒定格，人物开口。
**台词**（人物说出）：
> 你敢算吗？那个一年只收800刀的小客户，你到底贴了几个小时？
> 100笔流水，对账，追单，调分类，一返工，就是4小时。

**Agnes prompt**：
```
A beautiful East Asian female accountant in her mid-30s, long black hair,
dark navy blazer over white shirt, pearl earrings, sitting in a modern
accounting office with blurred bookshelf background, warm natural light.
Medium close-up, looking directly at camera with a serious concerned
expression, speaking to the viewer with slight head movements and hand
gesture counting. Slow push-in camera. She says: "Are you brave enough
to do the math? That small client paying only 800 dollars a year, how
many hours have you actually lost on them?"
Photorealistic, high detail, 4k commercial video still.
```

## 镜2（15–30秒）：痛点暴击

**画面**：同人物，语气加重，配合无奈摇头、手摊开动作。
**运镜**：保持胸上景别，轻微手持感。
**台词**：
> 时薪，不到200。旺季，你就是在倒贴。
> 不是客户小，是你做法太重。拿做大客户的方式，做小客户，必亏。

**Agnes prompt**：
```
Same female accountant, dark navy blazer, white shirt, modern office,
medium close-up looking at camera, tone heavier, shaking head slightly
with open-palm gesture. Subtle handheld feel. She says: "Less than 200
dollars an hour. In busy season you are paying out of pocket. It is not
that the client is small, it is that your process is too heavy."
Photorealistic, high detail, 4k.
```

## 镜3（30–45秒）：解决方案

**画面**：人物表情转暖，自信微笑，拿起一份整洁报表示意。
**运镜**：缓慢环绕（orbit）半圈，展示3D感。
**台词**：
> 小算盘AI，就是把小客户，做成流水线。
> 拖进来，自动分好类，缺什么，列清楚，越用，越像你。
> 你，只做最后点头那一下。

**Agnes prompt**：
```
Same female accountant, expression warms into a confident smile, holding
up a neat financial report. Slow orbital camera move around her. She
says: "Xiaosuanpan AI turns small clients into an assembly line. Drag
it in, it sorts itself, missing items listed clearly, the more you use
it the more it thinks like you. You only give the final nod."
Photorealistic, high detail, 4k.
```

## 镜4（45–60秒）：收尾CTA

**画面**：人物前倾，坚定有力，结尾微笑定格。
**运镜**：缓慢推近至近景（close-up），最后2秒定格微笑。
**台词**：
> 一户，压到20分钟左右。收费不变，省下的时间，就是利润。
> 这样，你才敢再接100个。小客户，不再是负担。是利润。

**Agnes prompt**：
```
Same female accountant leaning slightly forward, firm and convincing,
ending with a warm confident smile freeze. Slow push-in to close-up.
She says: "Twenty minutes per client. Same fee, the time saved is pure
profit. Then you dare to take 100 more. Small clients are no longer a
burden. They are profit." Photorealistic, high detail, 4k.
```

---

## 生成顺序（mfilm chain，四镜末帧串联保一致）

```bash
python mfilm.py chain --prompt "<镜1 prompt>" --prompt "<镜2 prompt>" \
  --prompt "<镜3 prompt>" --prompt "<镜4 prompt>" \
  --duration 15 --initial-image "<anchor公网URL>" --output-dir ./output_02
```

锚点图由 `agnes-image-2.5-flash`（`size: 2K, ratio: 16:9`）生成，
取返回的公网 URL 直接做 `--initial-image`。

## 执行记录（2026-09-08，已成片）

- 锚点图：`https://platform-outputs.agnes-ai.space/images/t2i/task_ku4UcstQUkhz8DgJMrExB6r32fYFECsZ/output_bee28f2a33bf4df0ad831e457bd5ed32.png`
- 镜1 opening：`video_221542785f5d4065bd8a3a6f7472638f` ✅
- 镜2 pain：`video_a44194658df34f52becde118f93c2d3c` ✅
- 镜3 solution：`video_32773ee248fb4b0b84418229671de2ae` ✅
- 镜4 cta：`video_c4a9b9ec6a0d467dac7bc32fcc308685` ✅
- 成片：`output_02/小算盘02你敢算吗_60s.mp4`（58.87秒，1088x832，15.3MB，中文字幕硬烧 + SRT同目录）
- 备注：单镜353帧/15秒；提交间隔触发429限流，mfilm自动60秒退避后成功；抽帧验证4镜同脸、字幕正常。
