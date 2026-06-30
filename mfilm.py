#!/usr/bin/env python3
"""
MFilm-CLI — Motion Film Management Interface
Industrial-grade film asset management system.

Usage:
    mfilm create --prompt "Scene description" --duration 15 --label "Shot_01"
    mfilm status --all
    mfilm status --id <TaskID>
    mfilm sync --output-dir "D:/Cinematic_Vault"
"""

import argparse
import json
import os
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


def ensure_dirs():
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    os.makedirs(TASKS_DIR, exist_ok=True)


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

    while time.time() - start < timeout:
        data = api_request("GET", f"{POLL_URL}{video_id}", api_key, timeout=30)

        if data.get("error") and data["error"] not in ("timeout", "connection_error"):
            return {"success": False, "error": data["error"]}

        status = data.get("status", "unknown").lower()
        progress = data.get("progress", 0)
        elapsed = int(time.time() - start)

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
            print(f"  {elapsed}s {icon} {progress}%")
            last_status = status

        if status in ("completed", "success"):
            url = data.get("video_url") or data.get("remixed_from_video_id") or data.get("url")
            if url:
                return {"success": True, "video_url": url, "elapsed": elapsed}
            return {"success": False, "error": "Completed but no URL"}

        if status == "failed":
            return {"success": False, "error": data.get("error", "Unknown error")}

        time.sleep(10)

    # Timeout — final check
    print(f"  [Timeout, checking final status...]")
    data = api_request("GET", f"{POLL_URL}{video_id}", api_key, timeout=30)

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
# Commands
# ============================================

def cmd_create(args):
    """Create a new rendering task."""
    config = load_config()
    api_key = args.api_key or config.get("api_key")

    if not api_key:
        print("[Error] No API key. Run: mfilm config --api-key <key>")
        sys.exit(1)

    # Enhance prompt
    print(f"[Creating task: {args.label or 'untitled'}]")
    print(f"  Duration: {args.duration}s ({align_frames(args.duration)} frames)")

    enhanced = enhance_prompt(args.prompt)
    if enhanced != args.prompt:
        print(f"  [Prompt enhanced]")

    # Submit
    print(f"  [Submitting...]")
    result = submit_task(
        api_key=api_key,
        prompt=enhanced,
        image_url=args.anchor_image,
        duration=args.duration,
        label=args.label,
    )

    if not result["success"]:
        print(f"  [Failed: {result['error']}]")
        sys.exit(1)

    video_id = result["video_id"]
    print(f"  [Task ID: {video_id}]")

    # Save task
    task_data = {
        "video_id": video_id,
        "label": args.label or "untitled",
        "prompt": enhanced,
        "original_prompt": args.prompt,
        "image_url": args.anchor_image,
        "duration": args.duration,
        "num_frames": result["num_frames"],
        "status": "submitted",
        "created_at": datetime.now().isoformat(),
        "output_dir": args.output_dir,
    }
    save_task(video_id, task_data)

    # Update state
    state = load_state()
    state["tasks"][video_id] = {
        "label": args.label,
        "status": "submitted",
        "created_at": task_data["created_at"],
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
            data = api_request("GET", f"{POLL_URL}{args.id}", api_key, timeout=30)
            status = data.get("status", "unknown")
            progress = data.get("progress", 0)
            print(f"  Live: {status} {progress}%")

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
        data = api_request("GET", f"{POLL_URL}{tid}", api_key, timeout=30)
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
        description="MFilm-CLI — Motion Film Management Interface",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  mfilm create --prompt "Product showcase" --duration 15 --label "Ad_01"
  mfilm create --prompt "Character animation" --anchor-image "https://..." --output-dir "./videos"
  mfilm status --all
  mfilm status --id vid_xxxxx
  mfilm sync --output-dir "D:/Cinematic_Vault"
  mfilm config --api-key "sk-xxx"
  mfilm batch --file tasks.json
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # create
    p_create = subparsers.add_parser("create", help="Create rendering task")
    p_create.add_argument("--prompt", "-p", required=True, help="Scene description")
    p_create.add_argument("--duration", "-d", type=int, default=15, help="Duration in seconds (5-30)")
    p_create.add_argument("--anchor-image", "-i", help="Reference image URL")
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
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
