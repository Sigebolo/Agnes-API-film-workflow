#!/usr/bin/env python3
"""
MFilm-CLI - AI 影片资产管理系统

用法:
    mfilm create --prompt "场景描述" --duration 15 --label "镜头_01"
    mfilm status --all
    mfilm status --id <任务ID>
    mfilm sync --output-dir "D:/Cinematic_Vault"
    mfilm logo --product "产品名" --desc "产品描述"
"""

import argparse
import base64
import json
import os
import re
import signal
import sys
import time
import threading
from datetime import datetime
from pathlib import Path


# ============================================
# Config
# ============================================

CONFIG_FILE = os.path.expanduser("~/.mfilm/config.json")
STATE_FILE = os.path.expanduser("~/.mfilm/state.json")
TASKS_DIR = os.path.expanduser("~/.mfilm/tasks")

AGNES_API_BASE = "https://apihub.agnes-ai.com"
LOCAL_SERVER = "http://localhost:3000"
SUBMIT_URL = f"{AGNES_API_BASE}/v1/videos"
POLL_URL = f"{AGNES_API_BASE}/agnesapi?video_id="
DNA_DIR = os.path.expanduser("~/.mfilm/dna")
DAEMON_PID_FILE = os.path.expanduser("~/.mfilm/daemon.pid")


def ensure_dirs():
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    os.makedirs(TASKS_DIR, exist_ok=True)
    os.makedirs(DNA_DIR, exist_ok=True)


def resolve_video_id(video_id: str) -> str:
    """Decode Agnes base64 video_id to extract the real ID for polling."""
    if video_id.startswith("video_"):
        try:
            b64 = video_id[len("video_"):]
            decoded = base64.b64decode(b64).decode("utf-8")
            match = re.search(r"video_id:(video_[^;]+)", decoded)
            if match:
                return match.group(1)
        except Exception:
            pass
    return video_id


def load_config():
    ensure_dirs()
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
    else:
        config = {}

    # Auto-sync: if no valid key locally, fetch from server
    if not config.get("api_key") or config["api_key"].startswith("test"):
        try:
            import requests as _req
            resp = _req.get(f"{LOCAL_SERVER}/api/get-api-key", timeout=3)
            if resp.ok:
                data = resp.json()
                if data.get("api_key"):
                    config["api_key"] = data["api_key"]
                    save_config(config)
                    print("  [已从服务器同步 API 密钥]")
        except Exception:
            pass

    return config


def save_config(config):
    ensure_dirs()
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def load_state():
    ensure_dirs()
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {"tasks": {}}


def save_state(state):
    ensure_dirs()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def load_task(task_id):
    path = os.path.join(TASKS_DIR, f"{task_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def save_task(task_id, data):
    ensure_dirs()
    path = os.path.join(TASKS_DIR, f"{task_id}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ============================================
# DNA Presets (R2)
# ============================================

def load_dna(name: str) -> dict:
    path = os.path.join(DNA_DIR, f"{name}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def save_dna(name: str, anchor_url: str, traits: str):
    ensure_dirs()
    data = {
        "name": name,
        "anchor_url": anchor_url,
        "traits": traits,
        "created_at": datetime.now().isoformat(),
    }
    path = os.path.join(DNA_DIR, f"{name}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return data


def delete_dna(name: str) -> bool:
    path = os.path.join(DNA_DIR, f"{name}.json")
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def list_dna() -> list:
    ensure_dirs()
    presets = []
    for f in sorted(Path(DNA_DIR).glob("*.json")):
        with open(f, "r") as fh:
            presets.append(json.load(fh))
    return presets


def inject_dna(prompt: str, dna: dict) -> str:
    """Prepend DNA traits to the front of the prompt."""
    traits = dna.get("traits", "")
    if traits:
        return f"{traits}, {prompt}"
    return prompt


# ============================================
# Frame Alignment (8n+1)
# ============================================

def align_frames(duration: int, fps: int = 24) -> int:
    """Calculate frame count aligned to 8n+1 for encoder compatibility."""
    raw = duration * fps
    aligned = ((raw - 1) // 8) * 8 + 1
    return max(aligned, 1)


# ============================================
# Prompt Enhancement
# ============================================

CAMERA_MOVEMENTS = [
    "Slow push in from medium to close-up",
    "360-degree rotation around subject",
    "Smooth lateral pan following the action",
    "Orbital shot circling the product",
    "Static frame with subtle breathing room",
    "Dolly zoom for dramatic emphasis",
    "Crane shot rising from low angle",
    "Handheld follow with natural movement",
]

STYLE_ENHANCERS = [
    "cinematic lighting with soft shadows",
    "shallow depth of field with bokeh background",
    "film grain texture for analog warmth",
    "color graded with teal and orange tones",
    "anamorphic lens flare accents",
    "volumetric light rays through atmosphere",
    "reflections on glossy surfaces",
    "dust particles caught in spotlight",
]


def enhance_prompt(user_prompt: str, style: str = "cinematic") -> str:
    """Enhance user prompt with industrial film aesthetics."""
    has_camera = any(word in user_prompt.lower() for word in [
        "pan", "push", "rotate", "orbit", "static", "crane", "dolly"
    ])
    has_style = any(word in user_prompt.lower() for word in [
        "lighting", "depth of field", "grain", "color", "lens"
    ])

    enhanced = user_prompt

    if not has_camera:
        import random
        camera = random.choice(CAMERA_MOVEMENTS)
        enhanced += f". {camera}"

    if not has_style:
        import random
        style_elem = random.choice(STYLE_ENHANCERS)
        enhanced += f". {style_elem}"

    enhanced += ". 8K resolution, ultra high detail, professional cinematography"

    return enhanced


# ============================================
# Progress Indicator
# ============================================

class ProgressIndicator:
    """Shows a spinning progress indicator during long operations."""
    
    def __init__(self, message="Working"):
        self.message = message
        self.running = False
        self.thread = None
    
    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._animate, daemon=True)
        self.thread.start()
    
    def _animate(self):
        chars = ["|", "/", "-", "\\"]
        i = 0
        while self.running:
            sys.stdout.write(f"\r  {self.message} {chars[i % len(chars)]} ")
            sys.stdout.flush()
            time.sleep(0.1)
            i += 1
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=0.2)
        sys.stdout.write("\r" + " " * 60 + "\r")
        sys.stdout.flush()


def render_bar(percent: int, width: int = 30) -> str:
    """Render an ANSI progress bar: [########........] 50%"""
    filled = int(width * percent / 100)
    bar = "#" * filled + "." * (width - filled)
    return f"[{bar}] {percent}%"


# ============================================
# API Client
# ============================================

def api_request(method, url, api_key, json_data=None, timeout=300):
    """Make API request with error handling."""
    import requests

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        if method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=timeout)
        else:
            resp = requests.get(url, headers=headers, timeout=timeout)

        if resp.status_code == 429:
            return {"error": "rate_limited", "retry_after": 60}

        if resp.status_code == 503:
            return {"error": "service_unavailable"}

        resp.raise_for_status()
        return resp.json()

    except requests.exceptions.Timeout:
        return {"error": "timeout"}
    except requests.exceptions.ConnectionError:
        return {"error": "connection_error"}
    except Exception as e:
        return {"error": str(e)}


def submit_task(api_key: str, prompt: str, image_url: str = None,
                duration: int = 15, label: str = None) -> dict:
    """Submit video generation task."""
    num_frames = align_frames(duration)

    body = {
        "model": "agnes-video-v2.0",
        "prompt": prompt,
        "num_frames": num_frames,
        "frame_rate": 24,
    }
    if image_url:
        body["image"] = image_url

    # Retry on rate limit or timeout
    for attempt in range(5):
        progress = ProgressIndicator("提交中")
        progress.start()
        try:
            data = api_request("POST", SUBMIT_URL, api_key, body, timeout=300)
        finally:
            progress.stop()

        if data.get("error") == "rate_limited":
            wait = 60 * (attempt + 1)  # 60s, 120s, 180s...
            print(f"  [速率限制，等待 {wait} 秒...]")
            time.sleep(wait)
            continue

        if data.get("error") in ("timeout", "connection_error", "service_unavailable"):
            wait = 15 * (attempt + 1)
            print(f"  [网络错误，等待 {wait} 秒后重试...]")
            time.sleep(wait)
            continue

        if "error" in data:
            return {"success": False, "error": data["error"]}

        video_id = data.get("video_id") or data.get("id") or data.get("task_id")
        if not video_id:
            return {"success": False, "error": "No video_id in response"}

        return {
            "success": True,
            "video_id": video_id,
            "num_frames": num_frames,
            "duration": duration,
            "label": label,
        }

    return {"success": False, "error": "Failed after 5 attempts (API rate limit or network issues)"}


def poll_task(api_key: str, video_id: str, timeout: int = 600) -> dict:
    """Poll task status until completion."""
    start = time.time()
    last_status = ""
    resolved_id = resolve_video_id(video_id)
    zombie_threshold = 600  # 10 minutes at 0% = zombie

    while time.time() - start < timeout:
        data = api_request("GET", f"{POLL_URL}{resolved_id}", api_key, timeout=30)

        if data.get("error") and data["error"] not in ("timeout", "connection_error"):
            return {"success": False, "error": data["error"]}

        status = data.get("status", "unknown").lower()
        progress = data.get("progress", 0)
        elapsed = int(time.time() - start)

        # Zombie detection: stuck at 0% for >10 minutes
        if progress == 0 and elapsed > zombie_threshold and status in ("queued", "not_start", "unknown"):
            print(f"  [!] 僵尸任务警告：已等待 {elapsed} 秒，进度仍为 0%。可能需要手动干预。")

        if status != last_status:
            status_icons = {
                "not_start": "[排队中]",
                "queued": "[排队中]",
                "processing": "[渲染中]",
                "running": "[渲染中]",
                "in_progress": "[渲染中]",
                "completed": "[完成]",
                "success": "[完成]",
                "failed": "[失败]",
            }
            icon = status_icons.get(status, f"[{status}]")
            bar = render_bar(progress)
            print(f"  {elapsed}s {icon} {bar}")
            last_status = status
        elif progress > 0:
            # Update progress bar inline (overwrite previous line)
            bar = render_bar(progress)
            sys.stdout.write(f"\r  {elapsed}s [Rendering] {bar} ")
            sys.stdout.flush()

        if status in ("completed", "success"):
            sys.stdout.write("\n")
            url = data.get("video_url") or data.get("remixed_from_video_id") or data.get("url")
            if url:
                return {"success": True, "video_url": url, "elapsed": elapsed}
            return {"success": False, "error": "Completed but no URL"}

        if status == "failed":
            sys.stdout.write("\n")
            return {"success": False, "error": data.get("error", "Unknown error")}

        time.sleep(10)

    # Timeout — final check
    print(f"  [超时，检查最终状态...]")
    data = api_request("GET", f"{POLL_URL}{resolved_id}", api_key, timeout=30)

    if data.get("status", "").lower() in ("completed", "success"):
        url = data.get("video_url") or data.get("remixed_from_video_id")
        if url:
            return {"success": True, "video_url": url, "elapsed": int(time.time() - start)}

    return {"success": False, "error": f"Timeout after {timeout}s"}


def download_video(url: str, output_path: str) -> bool:
    """Download video to local file."""
    import requests

    try:
        progress = ProgressIndicator("下载中")
        progress.start()
        try:
            resp = requests.get(url, timeout=120, stream=True)
            resp.raise_for_status()

            with open(output_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        finally:
            progress.stop()

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"  [已保存 {size_mb:.1f}MB → {output_path}]")
        return True

    except Exception as e:
        print(f"  [下载失败: {e}]")
        return False


# ============================================
# Long Video Chain Helpers
# ============================================

def extract_last_frame(video_path: str) -> str:
    """Extract last frame from video, return base64 data URL for API reuse."""
    import subprocess
    frame_path = video_path.rsplit(".", 1)[0] + "_lastframe.jpg"
    result = subprocess.run(
        ["ffmpeg", "-sseof", "-1", "-i", video_path,
         "-frames:v", "1", "-q:v", "2", frame_path, "-y"],
        capture_output=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode(errors='replace')[:200]}")

    with open(frame_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:image/jpeg;base64,{b64}"


def concat_videos(video_paths: list, output_path: str) -> bool:
    """Concatenate multiple videos using ffmpeg concat demuxer."""
    import subprocess
    list_file = output_path + ".txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in video_paths:
            f.write(f"file '{os.path.abspath(p)}'\n")
    try:
        result = subprocess.run(
            ["ffmpeg", "-f", "concat", "-safe", "0",
             "-i", list_file, "-c", "copy", output_path, "-y"],
            capture_output=True
        )
        return result.returncode == 0
    finally:
        if os.path.exists(list_file):
            os.remove(list_file)


def cmd_logo(args):
    """生成 Logo 设计。"""
    config = load_config()
    api_key = args.api_key or config.get("api_key")
    if not api_key:
        print("[错误] 未设置 API 密钥。请运行: mfilm config --api-key <密钥>")
        sys.exit(1)

    product = {
        "name": args.product,
        "description": args.desc or "",
        "category": "digital",
        "style": "modern",
        "targetPlatform": "general",
    }

    count = min(max(args.count, 1), 5)
    output_dir = args.output_dir or config.get("output_dir", ".")
    os.makedirs(output_dir, exist_ok=True)

    print(f"[Logo] 为「{args.product}」生成 {count} 个风格变体...")

    # Call the local server's logo generate API
    body = {
        "product": product,
        "variantCount": count,
    }
    data = api_request("POST", f"{LOCAL_SERVER}/api/logo/generate", api_key, body)

    if "error" in data:
        print(f"[错误] {data['error']}")
        sys.exit(1)

    prompts = data.get("variants", [])
    print(f"[Logo] 收到 {len(prompts)} 个提示词")

    # Generate images for each prompt
    import requests
    for i, prompt in enumerate(prompts):
        print(f"  [变体 {i+1}/{len(prompts)}] 生成图片...")
        img_data = api_request("POST", f"{LOCAL_SERVER}/api/proxy/images", api_key, {
            "model": "agnes-image-2.1-flash",
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
        })

        if "error" in img_data:
            print(f"  [错误] {img_data['error']}")
            continue

        url = img_data.get("data", [{}])[0].get("url", "")
        if url:
            filename = f"logo_{i+1}.png"
            filepath = os.path.join(output_dir, filename)
            download_video(url, filepath)
        else:
            print(f"  [变体 {i+1}] 无 URL")

        # Rate limit between requests
        if i < len(prompts) - 1:
            time.sleep(3)

    print(f"[Logo] 完成！文件保存在: {output_dir}")


def cmd_merge(args):
    """Merge multiple video files into one using ffmpeg."""
    import subprocess

    files = args.files
    if len(files) < 2:
        print("[错误] 需要至少两个视频文件来合并")
        sys.exit(1)

    # Validate all files exist
    for f in files:
        if not os.path.exists(f):
            print(f"[错误] 文件不存在: {f}")
            sys.exit(1)

    # Output path
    output = args.output or f"merged_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"

    # Create temp file list for ffmpeg concat
    temp_dir = os.path.join(os.path.dirname(output) or ".", ".mfilm_temp")
    os.makedirs(temp_dir, exist_ok=True)
    list_file = os.path.join(temp_dir, "concat_list.txt")

    with open(list_file, "w", encoding="utf-8") as f:
        for video_file in files:
            # Use forward slashes for ffmpeg compatibility
            abs_path = os.path.abspath(video_file).replace("\\", "/")
            f.write(f"file '{abs_path}'\n")

    print(f"[Merge] 合并 {len(files)} 个视频...")
    for i, f in enumerate(files):
        print(f"  {i+1}. {os.path.basename(f)}")

    # Step 1: Concat videos
    concat_cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", list_file, "-c", "copy", output
    ]

    try:
        subprocess.run(concat_cmd, check=True, capture_output=True, text=True)
        print(f"[Merge] 视频合并完成: {output}")
    except subprocess.CalledProcessError as e:
        print(f"[错误] FFmpeg 合并失败: {e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print("[错误] 未找到 ffmpeg，请先安装: https://ffmpeg.org/download.html")
        sys.exit(1)

    # Step 2: Add subtitles if provided
    if args.subtitles and os.path.exists(args.subtitles):
        sub_output = output.replace(".mp4", "_sub.mp4")
        sub_cmd = [
            "ffmpeg", "-y", "-i", output, "-i", args.subtitles,
            "-c:v", "copy", "-c:s", "mov_text", sub_output
        ]
        try:
            subprocess.run(sub_cmd, check=True, capture_output=True, text=True)
            os.replace(sub_output, output)
            print(f"[Merge] 字幕已添加")
        except Exception as e:
            print(f"[警告] 添加字幕失败: {e}")

    # Step 3: Generate voiceover if enabled
    if args.voiceover:
        print(f"[Merge] 生成配音 ({args.lang})...")
        # Extract subtitles text for TTS
        voiceover_cmd = [
            "ffmpeg", "-y", "-i", output,
            "-map", "0:s:0?",  # Try to extract subtitles
            os.path.join(temp_dir, "subs.srt")
        ]
        try:
            subprocess.run(voiceover_cmd, capture_output=True, text=True)
            # Read subtitle text
            srt_path = os.path.join(temp_dir, "subs.srt")
            if os.path.exists(srt_path):
                with open(srt_path, "r", encoding="utf-8") as f:
                    srt_content = f.read()
                # Parse text from SRT
                import re
                texts = re.findall(r'\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n(.+?)(?:\n\n|\n$)', srt_content, re.DOTALL)
                full_text = " ".join(texts).strip()
                if full_text:
                    # Use Google Translate TTS
                    tts_lang = "zh-CN" if args.lang == "zh" else "en"
                    tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={tts_lang}&q={full_text}"
                    voice_file = os.path.join(temp_dir, "voiceover.mp3")

                    tts_cmd = [
                        "ffmpeg", "-y", "-i", tts_url,
                        "-headers", "User-Agent: Mozilla/5.0\r\n",
                        voice_file
                    ]
                    subprocess.run(tts_cmd, capture_output=True, text=True)

                    if os.path.exists(voice_file):
                        # Mix voiceover with video
                        dubbed_output = output.replace(".mp4", "_dubbed.mp4")
                        dub_cmd = [
                            "ffmpeg", "-y", "-i", output, "-i", voice_file,
                            "-c:v", "copy", "-c:a", "aac",
                            "-map", "0:v:0", "-map", "1:a:0",
                            "-shortest", dubbed_output
                        ]
                        subprocess.run(dub_cmd, check=True, capture_output=True, text=True)
                        os.replace(dubbed_output, output)
                        print(f"[Merge] 配音完成")
                    else:
                        print(f"[警告] TTS 生成失败")
        except Exception as e:
            print(f"[警告] 配音生成失败: {e}")

    # Cleanup
    try:
        os.remove(list_file)
        os.rmdir(temp_dir)
    except:
        pass

    # Report
    size_mb = os.path.getsize(output) / (1024 * 1024)
    print(f"\n[完成] {output} ({size_mb:.1f}MB)")


def cmd_chain(args):
    """Execute a long video chain: generate multiple scenes sequentially,
    using each scene's last frame as the next scene's reference image."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")
    if not api_key:
        print("[错误] 未设置 API 密钥。请运行: mfilm config --api-key <密钥>")
        sys.exit(1)

    # Load scenes from JSON or inline prompts
    scenes = []
    initial_image = None
    dna_name = None
    no_concat = args.no_concat if hasattr(args, "no_concat") else False

    if args.scenes:
        if not os.path.exists(args.scenes):
            print(f"[错误] 未找到场景文件: {args.scenes}")
            sys.exit(1)
        with open(args.scenes, "r", encoding="utf-8") as f:
            data = json.load(f)
        initial_image = data.get("initial_image")
        dna_name = data.get("dna")
        no_concat = data.get("no_concat", no_concat)
        scenes = data.get("scenes", [])
    elif args.prompt:
        for i, p in enumerate(args.prompt):
            scenes.append({
                "prompt": p,
                "duration": args.duration,
                "label": f"chain_{i+1:02d}",
            })
    else:
        print("[错误] 需要 --scenes <文件.json> 或 --prompt \"场景1\" --prompt \"场景2\"")
        sys.exit(1)

    if not scenes:
        print("[错误] 未定义场景")
        sys.exit(1)

    output_dir = args.output_dir or config.get("output_dir", "./chain_output")
    os.makedirs(output_dir, exist_ok=True)

    duration = args.duration
    ref_image = initial_image

    # Load DNA if specified
    dna = None
    if dna_name:
        dna = load_dna(dna_name)
        if dna:
            print(f"[DNA loaded: {dna['name']}]")
            if dna.get("anchor_url") and not ref_image:
                ref_image = dna["anchor_url"]

    print(f"[Chain: {len(scenes)} scenes, {duration}s each, ~{len(scenes)*duration}s total]")
    print(f"[Output: {output_dir}]\n")

    video_paths = []

    for i, scene in enumerate(scenes):
        label = scene.get("label", f"chain_{i+1:02d}")
        prompt = scene["prompt"]
        scene_duration = scene.get("duration", duration)

        print(f"--- Scene {i+1}/{len(scenes)}: {label} ---")

        # Build prompt
        enhanced = prompt
        if dna:
            enhanced = inject_dna(enhanced, dna)
        enhanced = enhance_prompt(enhanced)

        # Submit
        print(f"  [Submitting...]")
        result = submit_task(
            api_key=api_key,
            prompt=enhanced,
            image_url=ref_image,
            duration=scene_duration,
            label=label,
        )

        if not result["success"]:
            print(f"  [FAILED at scene {i+1}: {result['error']}]")
            print(f"  [Chain stopped. Completed {i}/{len(scenes)} scenes.]")
            break

        video_id = result["video_id"]
        print(f"  [Task ID: {video_id}]")

        # Save task
        task_data = {
            "video_id": video_id,
            "label": label,
            "prompt": enhanced,
            "original_prompt": prompt,
            "image_url": ref_image[:100] + "..." if ref_image and len(ref_image) > 100 else ref_image,
            "duration": scene_duration,
            "num_frames": result["num_frames"],
            "status": "submitted",
            "chain_index": i,
            "created_at": datetime.now().isoformat(),
            "output_dir": output_dir,
        }
        save_task(video_id, task_data)

        # Verify task exists on Agnes server (ghost task detection)
        resolved_id = resolve_video_id(video_id)
        verify_url = f"{AGNES_API_BASE}/v1/video/generations/{resolved_id}"
        ghost_detected = False
        for check in range(3):
            time.sleep(1)
            check_data = api_request("GET", verify_url, api_key, timeout=10)
            if "task_not_exist" in str(check_data.get("error", "")):
                ghost_detected = True
                break
            status = check_data.get("status", "").lower()
            if status in ("queued", "not_start", "processing", "running", "completed", "success"):
                break
            if not check_data.get("error"):
                break

        if ghost_detected:
            print(f"  [!] GHOST TASK at scene {i+1}: {video_id} not on server. Skipping.")
            task_data["status"] = "failed"
            task_data["error"] = "Ghost task - not found on Agnes server"
            save_task(video_id, task_data)
            break

        # Poll
        print(f"  [Waiting for completion...]")
        poll_result = poll_task(api_key, video_id, timeout=600)

        if not poll_result["success"]:
            print(f"  [FAILED at scene {i+1}: {poll_result['error']}]")
            task_data["status"] = "failed"
            task_data["error"] = poll_result["error"]
            save_task(video_id, task_data)
            break

        # Download
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{label}_{timestamp}.mp4"
        filepath = os.path.join(output_dir, filename)

        if download_video(poll_result["video_url"], filepath):
            video_paths.append(filepath)
            task_data["status"] = "completed"
            task_data["video_url"] = poll_result["video_url"]
            task_data["local_path"] = filepath
            task_data["completed_at"] = datetime.now().isoformat()
            save_task(video_id, task_data)

            # Extract last frame for next scene
            if i < len(scenes) - 1:
                try:
                    ref_image = extract_last_frame(filepath)
                    print(f"  [Last frame extracted for next scene]")
                except Exception as e:
                    print(f"  [Warning: Could not extract last frame: {e}]")
                    ref_image = None
        else:
            print(f"  [Download failed for scene {i+1}]")
            break

        print()

    # Concat
    if video_paths and not no_concat:
        print(f"--- Concatenating {len(video_paths)} clips ---")
        final_name = f"chain_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
        final_path = os.path.join(output_dir, final_name)

        if concat_videos(video_paths, final_path):
            size_mb = os.path.getsize(final_path) / (1024 * 1024)
            print(f"  [Done! {len(video_paths)} clips -> {final_path} ({size_mb:.1f}MB)]")
        else:
            print(f"  [Concat failed. Individual clips saved in {output_dir}]")
    elif video_paths:
        print(f"[{len(video_paths)} clips saved to {output_dir}]")
    else:
        print(f"[No clips generated]")


# ============================================
# Commands
# ============================================

def cmd_create(args):
    """Create a new rendering task."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")

    if not api_key:
        print("[错误] 未设置 API 密钥。请运行: mfilm config --api-key <密钥>")
        sys.exit(1)

    # R2: Load DNA preset if specified
    dna = None
    anchor_image = args.anchor_image
    if hasattr(args, "use_dna") and args.use_dna:
        dna = load_dna(args.use_dna)
        if not dna:
            print(f"[Error] DNA preset '{args.use_dna}' not found. Run: mfilm dna list")
            sys.exit(1)
        print(f"  [DNA loaded: {dna['name']}]")
        if dna.get("anchor_url") and not anchor_image:
            anchor_image = dna["anchor_url"]

    # Enhance prompt
    print(f"[Creating task: {args.label or 'untitled'}]")
    print(f"  Duration: {args.duration}s ({align_frames(args.duration)} frames)")

    enhanced = args.prompt

    # R2: Inject DNA traits at front of prompt
    if dna:
        enhanced = inject_dna(enhanced, dna)
        print(f"  [DNA traits injected]")

    enhanced = enhance_prompt(enhanced)
    if enhanced != args.prompt:
        print(f"  [Prompt enhanced]")

    # Submit
    print(f"  [Submitting...]")
    result = submit_task(
        api_key=api_key,
        prompt=enhanced,
        image_url=anchor_image,
        duration=args.duration,
        label=args.label,
    )

    if not result["success"]:
        print(f"  [Failed: {result['error']}]")
        sys.exit(1)

    video_id = result["video_id"]
    print(f"  [Task ID: {video_id}]")

    # R1: Verify task exists on Agnes server immediately after submit
    resolved_id = resolve_video_id(video_id)
    verified = False
    verify_url = f"{AGNES_API_BASE}/v1/video/generations/{resolved_id}"
    for check in range(5):
        time.sleep(1)
        check_data = api_request("GET", verify_url, api_key, timeout=10)
        status = check_data.get("status", "").lower()
        error = check_data.get("error", "")
        # task_not_exist or timeout means ghost task
        if "task_not_exist" in str(error):
            break
        if status in ("queued", "not_start", "processing", "running", "completed", "success"):
            verified = True
            break
        if not check_data.get("error"):
            verified = True
            break

    if verified:
        print(f"  [OK] Task confirmed in cloud queue")
    else:
        print(f"  [!] GHOST TASK: {video_id} not found on Agnes server. Marking as failed.")
        print(f"      This task was submitted but never created. Possible causes:")
        print(f"      - Rate limit (1 req/min) blocked creation")
        print(f"      - Backend error during task initialization")
        print(f"      To retry: mfilm create --prompt \"{args.prompt}\" --label \"{args.label}\"")
        sys.exit(1)

    # Save task
    task_data = {
        "video_id": video_id,
        "label": args.label or "untitled",
        "prompt": enhanced,
        "original_prompt": args.prompt,
        "image_url": anchor_image,
        "duration": args.duration,
        "num_frames": result["num_frames"],
        "status": "submitted",
        "created_at": datetime.now().isoformat(),
        "output_dir": args.output_dir,
        "dna_name": dna["name"] if dna else None,
    }
    save_task(video_id, task_data)

    # Update state
    state = load_state()
    state["tasks"][video_id] = {
        "label": args.label,
        "status": "submitted",
        "created_at": task_data["created_at"],
        "dna_name": dna["name"] if dna else None,
    }
    save_state(state)

    # Poll if not async
    if not args.async_mode:
        print(f"  [Waiting for completion...]")
        poll_result = poll_task(api_key, video_id, timeout=600)

        if poll_result["success"]:
            task_data["status"] = "completed"
            task_data["video_url"] = poll_result["video_url"]
            task_data["completed_at"] = datetime.now().isoformat()
            save_task(video_id, task_data)

            # Download if output_dir specified
            if args.output_dir:
                os.makedirs(args.output_dir, exist_ok=True)
                label = args.label or video_id[:8]
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{label}_{timestamp}.mp4"
                filepath = os.path.join(args.output_dir, filename)

                if download_video(poll_result["video_url"], filepath):
                    task_data["local_path"] = filepath
                    save_task(video_id, task_data)
                    print(f"  [Done! -> {filepath}]")
                else:
                    print(f"  [Done! URL: {poll_result['video_url']}]")
            else:
                print(f"  [Done! URL: {poll_result['video_url']}]")
        else:
            task_data["status"] = "failed"
            task_data["error"] = poll_result["error"]
            save_task(video_id, task_data)
            print(f"  [Failed: {poll_result['error']}]")
            sys.exit(1)


def cmd_status(args):
    """Check task status."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")

    if args.id:
        # Single task
        task = load_task(args.id)
        if not task:
            print(f"[Task not found: {args.id}]")
            sys.exit(1)

        print(f"\n[Task: {task.get('label', 'untitled')}]")
        print(f"  ID: {task['video_id']}")
        print(f"  Status: {task['status']}")
        print(f"  Duration: {task.get('duration', '?')}s")
        print(f"  Created: {task.get('created_at', '?')}")

        if task.get("video_url"):
            print(f"  URL: {task['video_url']}")
        if task.get("local_path"):
            print(f"  Local: {task['local_path']}")
        if task.get("error"):
            print(f"  Error: {task['error']}")

        # Live check if API key available
        if api_key and task["status"] not in ("completed", "failed"):
            print(f"\n  [Checking live status...]")
            resolved = resolve_video_id(args.id)
            data = api_request("GET", f"{POLL_URL}{resolved}", api_key, timeout=30)
            status = data.get("status", "unknown")
            progress = data.get("progress", 0)
            bar = render_bar(progress)
            print(f"  Live: {status} {bar}")

    elif args.all:
        # All tasks
        state = load_state()
        tasks = state.get("tasks", {})

        if not tasks:
            print("[No tasks found]")
            return

        print(f"\n[Found {len(tasks)} task(s)]\n")
        print(f"{'Label':<20} {'Status':<15} {'Created':<20} {'ID'}")
        print("-" * 80)

        for tid, info in tasks.items():
            label = (info.get("label") or "untitled")[:18]
            status = info.get("status", "unknown")[:13]
            created = info.get("created_at", "?")[:19]
            print(f"{label:<20} {status:<15} {created:<20} {tid[:16]}...")

    else:
        print("[错误] 请指定 --all 或 --id <任务ID>")
        sys.exit(1)


def cmd_sync(args):
    """Sync completed tasks to local directory."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")

    if not api_key:
        print("[错误] 未设置 API 密钥。请运行: mfilm config --api-key <密钥>")
        sys.exit(1)

    output_dir = args.output_dir or config.get("output_dir", "./downloads")
    os.makedirs(output_dir, exist_ok=True)

    print(f"[Syncing to {output_dir}]")

    state = load_state()
    tasks = state.get("tasks", {})
    synced = 0

    for tid, info in tasks.items():
        if info.get("status") == "synced":
            continue

        # Check live status
        resolved = resolve_video_id(tid)
        data = api_request("GET", f"{POLL_URL}{resolved}", api_key, timeout=30)
        status = data.get("status", "").lower()

        if status in ("completed", "success"):
            url = data.get("video_url") or data.get("remixed_from_video_id")
            if url:
                label = info.get("label") or tid[:8]
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{label}_{timestamp}.mp4"
                filepath = os.path.join(output_dir, filename)

                print(f"  [Downloading: {label}...]")
                if download_video(url, filepath):
                    # Update task
                    task_data = load_task(tid) or {}
                    task_data["status"] = "synced"
                    task_data["local_path"] = filepath
                    task_data["synced_at"] = datetime.now().isoformat()
                    save_task(tid, task_data)

                    # Update state
                    state["tasks"][tid]["status"] = "synced"
                    save_state(state)

                    synced += 1

    print(f"\n[Synced {synced} task(s)]")


def cmd_config(args):
    """Manage configuration."""
    config = load_config()

    if args.api_key:
        config["api_key"] = args.api_key
        save_config(config)
        print("[API key saved]")

    if args.output_dir:
        config["output_dir"] = args.output_dir
        save_config(config)
        print(f"[Default output dir: {args.output_dir}]")

    if args.set:
        key, value = args.set.split("=", 1)
        config[key] = value
        save_config(config)
        print(f"[Set {key} = {value}]")

    if args.show or (not args.api_key and not args.output_dir and not args.set):
        print("\n[Current Config]")
        for k, v in config.items():
            if k == "api_key" and v:
                print(f"  {k}: {v[:8]}...{v[-4:]}")
            else:
                print(f"  {k}: {v}")


def cmd_dna(args):
    """Manage character DNA presets."""
    if args.dna_action == "save":
        if not args.name or not args.traits:
            print("[错误] 需要 --name 和 --traits 参数")
            sys.exit(1)
        data = save_dna(args.name, args.anchor or "", args.traits)
        print(f"[DNA saved: {data['name']}]")
        print(f"  Anchor: {data['anchor_url'] or '(none)'}")
        print(f"  Traits: {data['traits']}")

    elif args.dna_action == "load":
        if not args.name:
            print("[错误] 需要 --name 参数")
            sys.exit(1)
        dna = load_dna(args.name)
        if not dna:
            print(f"[Not found: {args.name}]")
            sys.exit(1)
        print(f"\n[DNA: {dna['name']}]")
        print(f"  Anchor: {dna.get('anchor_url', '(none)')}")
        print(f"  Traits: {dna.get('traits', '(none)')}")
        print(f"  Created: {dna.get('created_at', '?')}")

    elif args.dna_action == "list":
        presets = list_dna()
        if not presets:
            print("[No DNA presets saved]")
            return
        print(f"\n[Found {len(presets)} preset(s)]\n")
        print(f"{'Name':<25} {'Anchor':<15} {'Traits'}")
        print("-" * 70)
        for p in presets:
            name = p.get("name", "?")[:23]
            anchor = "Yes" if p.get("anchor_url") else "No"
            traits = (p.get("traits", "") or "")[:30]
            print(f"{name:<25} {anchor:<15} {traits}")

    elif args.dna_action == "delete":
        if not args.name:
            print("[错误] 需要 --name 参数")
            sys.exit(1)
        if delete_dna(args.name):
            print(f"[Deleted: {args.name}]")
        else:
            print(f"[Not found: {args.name}]")


def cmd_daemon(args):
    """Manage the background daemon process."""
    if args.daemon_action == "status":
        if os.path.exists(DAEMON_PID_FILE):
            with open(DAEMON_PID_FILE, "r") as f:
                pid = int(f.read().strip())
            try:
                os.kill(pid, 0)
                print(f"[Daemon running: PID {pid}]")
            except OSError:
                print(f"[Daemon not running (stale PID file: {pid})]")
                os.remove(DAEMON_PID_FILE)
        else:
            print("[守护进程未运行]")
        return

    if args.daemon_action == "stop":
        if not os.path.exists(DAEMON_PID_FILE):
            print("[守护进程未运行]")
            return
        with open(DAEMON_PID_FILE, "r") as f:
            pid = int(f.read().strip())
        try:
            os.kill(pid, signal.SIGTERM)
            print(f"[Daemon stopped: PID {pid}]")
        except OSError:
            print(f"[Process {pid} not found]")
        os.remove(DAEMON_PID_FILE)
        return

    if args.daemon_action == "start":
        # Check if already running
        if os.path.exists(DAEMON_PID_FILE):
            with open(DAEMON_PID_FILE, "r") as f:
                pid = int(f.read().strip())
            try:
                os.kill(pid, 0)
                print(f"[Daemon already running: PID {pid}]")
                return
            except OSError:
                os.remove(DAEMON_PID_FILE)

        # Fork to background
        pid = os.fork() if hasattr(os, "fork") else None
        if pid is None:
            # Windows: no fork, run inline with a note
            print("[Starting daemon (foreground on Windows)...]")
            _daemon_loop(args)
            return

        # Parent: write PID and exit
        if pid > 0:
            ensure_dirs()
            with open(DAEMON_PID_FILE, "w") as f:
                f.write(str(pid))
            print(f"[Daemon started: PID {pid}]")
            return

        # Child: become session leader
        os.setsid()
        _daemon_loop(args)
        os._exit(0)


def _daemon_loop(args):
    """Main daemon polling loop."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")
    if not api_key:
        print("[守护进程] 未设置 API 密钥。请运行: mfilm config --api-key <密钥>")
        return

    output_dir = args.output_dir or config.get("output_dir", "./downloads")
    os.makedirs(output_dir, exist_ok=True)

    interval = getattr(args, "interval", 60)
    running = True

    def handle_signal(sig, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    print(f"[Daemon] Monitoring every {interval}s, output: {output_dir}")

    while running:
        try:
            _daemon_check_once(api_key, output_dir)
        except Exception as e:
            print(f"[Daemon] Error: {e}")
        time.sleep(interval)

    # Cleanup PID file
    if os.path.exists(DAEMON_PID_FILE):
        os.remove(DAEMON_PID_FILE)
    print("[守护进程] 已停止")


def _daemon_check_once(api_key: str, output_dir: str):
    """Check all pending tasks and download completed ones. Also writes metadata .json."""
    state = load_state()
    tasks = state.get("tasks", {})
    downloaded = 0

    for tid, info in tasks.items():
        if info.get("status") in ("completed", "failed", "synced"):
            continue

        resolved = resolve_video_id(tid)
        data = api_request("GET", f"{POLL_URL}{resolved}", api_key, timeout=30)

        status = data.get("status", "").lower()
        progress = data.get("progress", 0)

        if status in ("completed", "success"):
            url = data.get("video_url") or data.get("remixed_from_video_id")
            if url:
                label = info.get("label") or tid[:8]
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{label}_{timestamp}.mp4"
                filepath = os.path.join(output_dir, filename)

                if download_video(url, filepath):
                    # Metadata sync: save .json alongside .mp4
                    meta_path = filepath.rsplit(".", 1)[0] + ".json"
                    task_data = load_task(tid) or {}
                    meta = {
                        "video_id": tid,
                        "label": label,
                        "prompt": task_data.get("prompt", ""),
                        "original_prompt": task_data.get("original_prompt", ""),
                        "duration": task_data.get("duration"),
                        "num_frames": task_data.get("num_frames"),
                        "image_url": task_data.get("image_url"),
                        "dna_name": task_data.get("dna_name"),
                        "local_path": filepath,
                        "downloaded_at": datetime.now().isoformat(),
                    }
                    with open(meta_path, "w") as f:
                        json.dump(meta, f, indent=2)

                    # Update state
                    state["tasks"][tid]["status"] = "synced"
                    save_state(state)

                    # Update task file
                    task_data["status"] = "synced"
                    task_data["local_path"] = filepath
                    save_task(tid, task_data)

                    downloaded += 1

        elif status == "failed":
            state["tasks"][tid]["status"] = "failed"
            save_state(state)

    if downloaded > 0:
        print(f"[守护进程] 已下载 {downloaded} 个视频")


def cmd_batch(args):
    """Batch create from JSON file."""
    if not os.path.exists(args.file):
        print(f"[Error] File not found: {args.file}")
        sys.exit(1)

    with open(args.file, "r") as f:
        tasks = json.load(f)

    if not isinstance(tasks, list):
        print("[错误] JSON 必须是任务数组")
        sys.exit(1)

    print(f"[批量模式: {len(tasks)} 个任务]")

    for i, task in enumerate(tasks):
        print(f"\n{'='*50}")
        print(f"[Task {i+1}/{len(tasks)}]")
        print(f"{'='*50}")

        args.prompt = task["prompt"]
        args.duration = task.get("duration", 15)
        args.anchor_image = task.get("image_url")
        args.label = task.get("label", f"batch_{i+1}")
        args.async_mode = False

        cmd_create(args)


# ============================================
# Main
# ============================================

def main():
    parser = argparse.ArgumentParser(
        prog="mfilm",
        description="MFilm-CLI — AI 影片资产管理系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  mfilm create --prompt "产品展示" --duration 15 --label "广告_01"
  mfilm create --use-dna "猫宁" --prompt "在书房说话" --async
  mfilm dna save "猫宁" --anchor "https://..." --traits "20岁女孩"
  mfilm dna list
  mfilm status --all
  mfilm status --id vid_xxxxx
  mfilm sync --output-dir "D:/Cinematic_Vault"
  mfilm config --api-key "sk-xxx"
  mfilm batch --file tasks.json
  mfilm chain --prompt "场景1" --prompt "场景2" --duration 10
  mfilm logo --product "产品名" --desc "产品描述" --count 3
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # create
    p_create = subparsers.add_parser("create", help="创建渲染任务")
    p_create.add_argument("--prompt", "-p", required=True, help="场景描述")
    p_create.add_argument("--duration", "-d", type=int, default=15, help="视频时长，单位秒（5-30）")
    p_create.add_argument("--anchor-image", "-i", help="参考图片 URL")
    p_create.add_argument("--use-dna", dest="use_dna", help="使用指定 DNA 预设")
    p_create.add_argument("--label", "-l", help="资产标签/名称")
    p_create.add_argument("--output-dir", "-o", help="下载目录")
    p_create.add_argument("--api-key", help="Agnes API 密钥")
    p_create.add_argument("--async", dest="async_mode", action="store_true", help="异步模式，不等待完成")

    # status
    p_status = subparsers.add_parser("status", help="查看任务状态")
    p_status.add_argument("--all", "-a", action="store_true", help="显示所有任务")
    p_status.add_argument("--id", help="指定任务 ID")
    p_status.add_argument("--api-key", help="Agnes API 密钥")

    # sync
    p_sync = subparsers.add_parser("sync", help="同步已完成的视频到本地")
    p_sync.add_argument("--output-dir", "-o", help="同步目录")
    p_sync.add_argument("--api-key", help="Agnes API 密钥")

    # config
    p_config = subparsers.add_parser("config", help="管理配置")
    p_config.add_argument("--api-key", help="设置 API 密钥")
    p_config.add_argument("--output-dir", help="设置默认输出目录")
    p_config.add_argument("--set", help="设置配置项 key=value")
    p_config.add_argument("--show", action="store_true", help="显示当前配置")

    # batch
    p_batch = subparsers.add_parser("batch", help="批量创建任务（JSON 文件）")
    p_batch.add_argument("--file", "-f", required=True, help="任务 JSON 文件")
    p_batch.add_argument("--api-key", help="Agnes API 密钥")
    p_batch.add_argument("--output-dir", "-o", help="下载目录")

    # dna (R2)
    p_dna = subparsers.add_parser("dna", help="管理角色 DNA 预设")
    p_dna.add_argument("dna_action", choices=["save", "load", "list", "delete"], help="操作类型")
    p_dna.add_argument("--name", "-n", help="预设名称")
    p_dna.add_argument("--anchor", "-a", help="锚点图片 URL")
    p_dna.add_argument("--traits", "-t", help="角色特征描述")

    # daemon (R3)
    p_daemon = subparsers.add_parser("daemon", help="管理后台守护进程")
    p_daemon.add_argument("daemon_action", choices=["start", "stop", "status"], help="操作类型")
    p_daemon.add_argument("--api-key", help="Agnes API 密钥")
    p_daemon.add_argument("--output-dir", "-o", help="下载目录")
    p_daemon.add_argument("--interval", type=int, default=60, help="检查间隔，单位秒（默认 60）")

    # chain (long video)
    p_chain = subparsers.add_parser("chain", help="从场景链生成长视频")
    p_chain.add_argument("--scenes", "-s", help="场景定义 JSON 文件")
    p_chain.add_argument("--prompt", "-p", action="append", help="场景提示词（重复使用可添加多个场景）")
    p_chain.add_argument("--duration", "-d", type=int, default=15, help="每场景时长，单位秒（默认 15）")
    p_chain.add_argument("--initial-image", help="第一场景参考图片 URL")
    p_chain.add_argument("--dna", help="DNA 预设名称")
    p_chain.add_argument("--output-dir", "-o", help="输出目录")
    p_chain.add_argument("--no-concat", action="store_true", help="不自动合并片段")
    p_chain.add_argument("--api-key", help="Agnes API 密钥")

    # merge
    p_merge = subparsers.add_parser("merge", help="合并多个视频文件")
    p_merge.add_argument("files", nargs="+", help="要合并的视频文件路径（按顺序）")
    p_merge.add_argument("--output", "-o", help="输出文件路径（默认 merged_<时间戳>.mp4）")
    p_merge.add_argument("--voiceover", action="store_true", help="启用配音（从字幕生成语音）")
    p_merge.add_argument("--lang", choices=["zh", "en"], default="zh", help="配音语言（默认中文）")
    p_merge.add_argument("--subtitles", "-s", help="字幕文件路径（.srt 或 .vtt）")

    # logo
    p_logo = subparsers.add_parser("logo", help="生成 Logo 设计")
    p_logo.add_argument("--product", required=True, help="产品名称")
    p_logo.add_argument("--desc", "--description", help="产品描述")
    p_logo.add_argument("--count", "-c", type=int, default=3, help="生成变体数量（3 或 5）")
    p_logo.add_argument("--output-dir", "-o", help="下载目录")
    p_logo.add_argument("--api-key", help="Agnes API 密钥")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "create": cmd_create,
        "status": cmd_status,
        "sync": cmd_sync,
        "config": cmd_config,
        "batch": cmd_batch,
        "dna": cmd_dna,
        "daemon": cmd_daemon,
        "chain": cmd_chain,
        "logo": cmd_logo,
        "merge": cmd_merge,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
