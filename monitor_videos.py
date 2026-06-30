#!/usr/bin/env python3
"""
Agnes Video Monitor
Checks for new completed videos and downloads them.
Run via cron every 5 minutes.

Usage:
    python monitor_videos.py --api-key "sk-xxx" --output-dir "downloads"
"""

import argparse
import json
import os
import time
import requests
from datetime import datetime

STATE_FILE = "video_monitor_state.json"


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {"known_videos": [], "last_check": None}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def check_new_videos(api_key: str, output_dir: str) -> list:
    """Check for new completed videos and download them."""
    state = load_state()
    known = set(state.get("known_videos", []))
    new_videos = []
    
    # Check task registry
    tasks_file = "data/tasks.json"
    if not os.path.exists(tasks_file):
        return []
    
    with open(tasks_file, "r") as f:
        tasks = json.load(f)
    
    for task_id, task in tasks.items():
        if task.get("type") != "video":
            continue
        
        video_id = task.get("video_id") or task_id
        if video_id in known:
            continue
        
        # Check status
        try:
            resp = requests.get(
                f"https://apihub.agnes-ai.com/agnesapi?video_id={video_id}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            
            status = data.get("status", "").lower()
            if status in ("completed", "success"):
                video_url = data.get("video_url") or data.get("remixed_from_video_id")
                if video_url:
                    # Download
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"video_{timestamp}_{video_id[:8]}.mp4"
                    filepath = os.path.join(output_dir, filename)
                    
                    dl_resp = requests.get(video_url, timeout=120)
                    dl_resp.raise_for_status()
                    
                    with open(filepath, "wb") as f:
                        f.write(dl_resp.content)
                    
                    size_mb = os.path.getsize(filepath) / (1024 * 1024)
                    print(f"[New video downloaded: {filename} ({size_mb:.1f}MB)]")
                    
                    new_videos.append({
                        "video_id": video_id,
                        "path": filepath,
                        "url": video_url,
                    })
                    
                    known.add(video_id)
        
        except Exception as e:
            print(f"[Error checking {video_id}: {e}]")
    
    # Save state
    state["known_videos"] = list(known)
    state["last_check"] = datetime.now().isoformat()
    save_state(state)
    
    return new_videos


def main():
    parser = argparse.ArgumentParser(description="Monitor and download new Agnes videos")
    parser.add_argument("--api-key", required=True, help="Agnes AI API key")
    parser.add_argument("--output-dir", default="downloads", help="Download directory")
    parser.add_argument("--quiet", action="store_true", help="No output if no new videos")
    
    args = parser.parse_args()
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    new_videos = check_new_videos(args.api_key, args.output_dir)
    
    if new_videos and not args.quiet:
        print(f"[Found {len(new_videos)} new video(s)]")
    elif not args.quiet:
        print("[No new videos]")


if __name__ == "__main__":
    main()
