#!/usr/bin/env python3
"""
MFilm-CLI - Motion Film Management Interface
Industrial-grade film asset management system.

Usage:
    mfilm create --prompt "Scene description" --duration 15 --label "Shot_01"
    mfilm status --all
    mfilm status --id <TaskID>
    mfilm sync --output-dir "D:/Cinematic_Vault"
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
            return json.load(f)
    return {}


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
        progress = ProgressIndicator("Submitting")
        progress.start()
        try:
            data = api_request("POST", SUBMIT_URL, api_key, body, timeout=300)
        finally:
            progress.stop()

        if data.get("error") == "rate_limited":
            wait = 60 * (attempt + 1)  # 60s, 120s, 180s...
            print(f"  [Rate limited, waiting {wait}s...]")
            time.sleep(wait)
            continue

        if data.get("error") in ("timeout", "connection_error", "service_unavailable"):
            wait = 15 * (attempt + 1)
            print(f"  [Network error, waiting {wait}s before retry...]")
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
            print(f"  [!] Zombie task warning: waited {elapsed}s, progress still 0%. May need manual intervention.")

        if status != last_status:
            status_icons = {
                "not_start": "[Queued]",
                "queued": "[Queued]",
                "processing": "[Rendering]",
                "running": "[Rendering]",
                "in_progress": "[Rendering]",
                "completed": "[Done]",
                "success": "[Done]",
                "failed": "[Failed]",
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
    print(f"  [Timeout, checking final status...]")
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
        progress = ProgressIndicator("Downloading")
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
        print(f"  [Saved {size_mb:.1f}MB -> {output_path}]")
        return True

    except Exception as e:
        print(f"  [Download failed: {e}]")
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


def cmd_chain(args):
    """Execute a long video chain: generate multiple scenes sequentially,
    using each scene's last frame as the next scene's reference image."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")
    if not api_key:
        print("[Error] No API key. Run: mfilm config --api-key <key>")
        sys.exit(1)

    # Load scenes from JSON or inline prompts
    scenes = []
    initial_image = None
    dna_name = None
    no_concat = args.no_concat if hasattr(args, "no_concat") else False

    if args.scenes:
        if not os.path.exists(args.scenes):
            print(f"[Error] Scene file not found: {args.scenes}")
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
        print("[Error] Need --scenes <file.json> or --prompt \"scene 1\" --prompt \"scene 2\"")
        sys.exit(1)

    if not scenes:
        print("[Error] No scenes defined")
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
        print("[Error] No API key. Run: mfilm config --api-key <key>")
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

    # R1: 强校验 — 提交后立即确认任务已挂载
    resolved_id = resolve_video_id(video_id)
    verified = False
    for check in range(5):
        time.sleep(1)
        check_data = api_request("GET", f"{POLL_URL}{resolved_id}", api_key, timeout=10)
        if not check_data.get("error"):
            verified = True
            break
        if "not_found" not in str(check_data.get("error", "")):
            verified = True
            break
    if verified:
        print(f"  [OK] Task confirmed in cloud queue")
    else:
        print(f"  [!] Warning: Task {video_id} not confirmed after submit, may have been dropped by cloud")

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
        print("[Error] Specify --all or --id <TaskID>")
        sys.exit(1)


def cmd_sync(args):
    """Sync completed tasks to local directory."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")

    if not api_key:
        print("[Error] No API key. Run: mfilm config --api-key <key>")
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
            print("[Error] Need --name and --traits")
            sys.exit(1)
        data = save_dna(args.name, args.anchor or "", args.traits)
        print(f"[DNA saved: {data['name']}]")
        print(f"  Anchor: {data['anchor_url'] or '(none)'}")
        print(f"  Traits: {data['traits']}")

    elif args.dna_action == "load":
        if not args.name:
            print("[Error] Need --name")
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
            print("[Error] Need --name")
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
            print("[Daemon not running]")
        return

    if args.daemon_action == "stop":
        if not os.path.exists(DAEMON_PID_FILE):
            print("[Daemon not running]")
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
        print("[Daemon] No API key. Run: mfilm config --api-key <key>")
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
    print("[Daemon] Stopped")


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
        print(f"[Daemon] Downloaded {downloaded} video(s)")


def cmd_batch(args):
    """Batch create from JSON file."""
    if not os.path.exists(args.file):
        print(f"[Error] File not found: {args.file}")
        sys.exit(1)

    with open(args.file, "r") as f:
        tasks = json.load(f)

    if not isinstance(tasks, list):
        print("[Error] JSON must be an array of tasks")
        sys.exit(1)

    print(f"[Batch: {len(tasks)} task(s)]")

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
        description="MFilm-CLI - Motion Film Management Interface",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  mfilm create --prompt "Product showcase" --duration 15 --label "Ad_01"
  mfilm create --use-dna "Maoning" --prompt "在书房说话" --async
  mfilm dna save "Maoning" --anchor "https://..." --traits "20岁女孩"
  mfilm dna list
  mfilm status --all
  mfilm status --id vid_xxxxx
  mfilm sync --output-dir "D:/Cinematic_Vault"
  mfilm config --api-key "sk-xxx"
  mfilm batch --file tasks.json
  mfilm chain --prompt "Scene 1" --prompt "Scene 2" --duration 10
  mfilm chain --scenes chain.json --output-dir ./videos
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # create
    p_create = subparsers.add_parser("create", help="Create rendering task")
    p_create.add_argument("--prompt", "-p", required=True, help="Scene description")
    p_create.add_argument("--duration", "-d", type=int, default=15, help="Duration in seconds (5-30)")
    p_create.add_argument("--anchor-image", "-i", help="Reference image URL")
    p_create.add_argument("--use-dna", dest="use_dna", help="Use DNA preset by name")
    p_create.add_argument("--label", "-l", help="Asset label/name")
    p_create.add_argument("--output-dir", "-o", help="Download directory")
    p_create.add_argument("--api-key", help="Agnes API key")
    p_create.add_argument("--async", dest="async_mode", action="store_true", help="Don't wait for completion")

    # status
    p_status = subparsers.add_parser("status", help="Check task status")
    p_status.add_argument("--all", "-a", action="store_true", help="Show all tasks")
    p_status.add_argument("--id", help="Specific task ID")
    p_status.add_argument("--api-key", help="Agnes API key")

    # sync
    p_sync = subparsers.add_parser("sync", help="Sync completed videos locally")
    p_sync.add_argument("--output-dir", "-o", help="Sync directory")
    p_sync.add_argument("--api-key", help="Agnes API key")

    # config
    p_config = subparsers.add_parser("config", help="Manage configuration")
    p_config.add_argument("--api-key", help="Set API key")
    p_config.add_argument("--output-dir", help="Set default output directory")
    p_config.add_argument("--set", help="Set config key=value")
    p_config.add_argument("--show", action="store_true", help="Show current config")

    # batch
    p_batch = subparsers.add_parser("batch", help="Batch create from JSON")
    p_batch.add_argument("--file", "-f", required=True, help="JSON file with tasks")
    p_batch.add_argument("--api-key", help="Agnes API key")
    p_batch.add_argument("--output-dir", "-o", help="Download directory")

    # dna (R2)
    p_dna = subparsers.add_parser("dna", help="Manage character DNA presets")
    p_dna.add_argument("dna_action", choices=["save", "load", "list", "delete"], help="Action to perform")
    p_dna.add_argument("--name", "-n", help="Preset name")
    p_dna.add_argument("--anchor", "-a", help="Anchor image URL")
    p_dna.add_argument("--traits", "-t", help="Character traits description")

    # daemon (R3)
    p_daemon = subparsers.add_parser("daemon", help="Manage background daemon process")
    p_daemon.add_argument("daemon_action", choices=["start", "stop", "status"], help="Action to perform")
    p_daemon.add_argument("--api-key", help="Agnes API key")
    p_daemon.add_argument("--output-dir", "-o", help="Download directory")
    p_daemon.add_argument("--interval", type=int, default=60, help="Check interval in seconds (default: 60)")

    # chain (long video)
    p_chain = subparsers.add_parser("chain", help="Generate long video from scene chain")
    p_chain.add_argument("--scenes", "-s", help="JSON file with scene definitions")
    p_chain.add_argument("--prompt", "-p", action="append", help="Scene prompt (repeat for multiple scenes)")
    p_chain.add_argument("--duration", "-d", type=int, default=15, help="Duration per scene in seconds (default: 15)")
    p_chain.add_argument("--initial-image", help="First scene reference image URL")
    p_chain.add_argument("--dna", help="DNA preset name to use")
    p_chain.add_argument("--output-dir", "-o", help="Output directory")
    p_chain.add_argument("--no-concat", action="store_true", help="Don't auto-concatenate clips")
    p_chain.add_argument("--api-key", help="Agnes API key")

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
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
