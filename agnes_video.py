"""
Agnes Video Generator
Generate videos from images using Agnes AI API.

Usage:
    python agnes_video.py --image <image_url> --prompt "your prompt" --duration 15 --api-key "sk-xxx"
    python agnes_video.py --image <image_url> --prompt "your prompt"  # default 15s

Requirements:
    pip install requests
"""

import argparse
import time
import sys
import os
import requests


def submit_video(api_key: str, prompt: str, image_url: str = None, duration: int = 15) -> str:
    """Submit video generation task, return video_id."""
    num_frames = int((duration * 24 - 1) / 8) * 8 + 1
    
    body = {
        "model": "agnes-video-v2.0",
        "prompt": prompt,
        "num_frames": num_frames,
        "frame_rate": 24,
    }
    if image_url:
        body["image"] = image_url
    
    for attempt in range(3):
        try:
            resp = requests.post(
                "https://apihub.agnes-ai.com/v1/videos",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json=body,
                timeout=30,
            )
            
            if resp.status_code == 429:
                wait = 60 * (attempt + 1)
                print(f"[Rate limited, waiting {wait}s...]")
                time.sleep(wait)
                continue
            
            resp.raise_for_status()
            data = resp.json()
            
            if "error" in data:
                raise Exception(f"API error: {data['error']}")
            
            video_id = data.get("video_id") or data.get("id") or data.get("task_id")
            if not video_id:
                raise Exception(f"No video_id in response: {data}")
            
            return video_id
            
        except requests.exceptions.Timeout:
            if attempt < 2:
                print(f"[Timeout, retrying...]")
                time.sleep(5)
            else:
                raise
    
    raise Exception("Failed to submit after 3 attempts")


def poll_video(api_key: str, video_id: str, timeout: int = 900) -> str:
    """Poll until video is ready, return video URL.
    
    After timeout, performs one final check in case video completed but polling missed it.
    """
    start = time.time()
    last_status = "unknown"
    
    while time.time() - start < timeout:
        try:
            resp = requests.get(
                f"https://apihub.agnes-ai.com/agnesapi?video_id={video_id}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            
            status = data.get("status", "unknown").lower()
            progress = data.get("progress", 0)
            elapsed = int(time.time() - start)
            last_status = status
            
            if status != last_status or elapsed % 30 == 0:
                print(f"   [{elapsed}s] {status} {progress}%")
            
            if status in ("completed", "success"):
                url = data.get("video_url") or data.get("remixed_from_video_id") or data.get("url")
                if url:
                    return url
                raise Exception(f"Completed but no URL in response: {data}")
            
            if status == "failed":
                raise Exception(f"Generation failed: {data.get('error', 'Unknown error')}")
            
            time.sleep(10)
            
        except requests.exceptions.Timeout:
            print(f"   [{int(time.time() - start)}s] Request timeout, retrying...")
            time.sleep(5)
        except requests.exceptions.ConnectionError:
            print(f"   [{int(time.time() - start)}s] Connection error, retrying...")
            time.sleep(10)
    
    # Timeout reached - final check
    print(f"[Timeout after {timeout}s, checking final status...]")
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
            url = data.get("video_url") or data.get("remixed_from_video_id") or data.get("url")
            if url:
                print(f"[Found completed video after timeout!]")
                return url
        
        raise TimeoutError(f"Video generation timed out after {timeout}s (last status: {status})")
        
    except requests.exceptions.RequestException:
        raise TimeoutError(f"Video generation timed out after {timeout}s")


def download_video(video_url: str, output_path: str) -> str:
    """Download video from URL to local file. Returns the path."""
    resp = requests.get(video_url, timeout=120, stream=True)
    resp.raise_for_status()
    
    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"[Saved {size_mb:.1f}MB to {output_path}]")
    return output_path


def generate_video(api_key: str, image_url: str, prompt: str, duration: int = 15, output: str = None) -> str:
    """Full pipeline: submit + poll + optional download. Returns video URL or local path."""
    print(f"[Submitting video generation ({duration}s)...]")
    video_id = submit_video(api_key, prompt, image_url, duration)
    print(f"[Task submitted: {video_id}]")
    
    print("[Waiting for completion...]")
    video_url = poll_video(api_key, video_id)
    
    if output:
        download_video(video_url, output)
        return output
    
    print(f"\n[Video ready!]")
    print(f"[URL: {video_url}]")
    return video_url


def generate_batch(api_key: str, tasks: list, output_dir: str = "output") -> list:
    """Generate multiple videos. Each task is dict with image_url, prompt, duration."""
    os.makedirs(output_dir, exist_ok=True)
    results = []
    
    for i, task in enumerate(tasks):
        print(f"\n{'='*50}")
        print(f"[Task {i+1}/{len(tasks)}]")
        print(f"{'='*50}")
        
        output_path = os.path.join(output_dir, f"video_{i+1}.mp4")
        try:
            result = generate_video(
                api_key=api_key,
                image_url=task.get("image_url"),
                prompt=task["prompt"],
                duration=task.get("duration", 15),
                output=output_path,
            )
            results.append({"status": "success", "path": result, "task": task})
        except Exception as e:
            print(f"[Failed: {e}]")
            results.append({"status": "failed", "error": str(e), "task": task})
        
        # Wait between tasks to avoid rate limiting
        if i < len(tasks) - 1:
            print("[Waiting 30s before next task...]")
            time.sleep(30)
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Generate video from image using Agnes AI")
    parser.add_argument("--image", help="Public image URL (optional for text-to-video)")
    parser.add_argument("--prompt", required=True, help="Video prompt")
    parser.add_argument("--duration", type=int, default=15, choices=[5, 10, 15, 20, 25, 30],
                        help="Video duration in seconds (default: 15)")
    parser.add_argument("--api-key", required=True, help="Agnes AI API key")
    parser.add_argument("--output", help="Save video to this path (optional)")
    
    args = parser.parse_args()
    
    try:
        video_url = generate_video(args.api_key, args.image, args.prompt, args.duration, args.output)
        
        if not args.output:
            print(f"\n[Video URL: {video_url}]")
    
    except Exception as e:
        print(f"[Error: {e}]", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
