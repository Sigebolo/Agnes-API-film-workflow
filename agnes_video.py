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
import requests


def submit_video(api_key: str, prompt: str, image_url: str, duration: int = 15) -> str:
    """Submit video generation task, return video_id."""
    num_frames = int((duration * 24 - 1) / 8) * 8 + 1
    
    resp = requests.post(
        "https://apihub.agnes-ai.com/v1/videos",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json={
            "model": "agnes-video-v2.0",
            "prompt": prompt,
            "image": image_url,
            "num_frames": num_frames,
            "frame_rate": 24,
        },
        timeout=30,
    )
    
    if resp.status_code == 429:
        print("⏳ Rate limited, waiting 60s...")
        time.sleep(60)
        return submit_video(api_key, prompt, image_url, duration)
    
    resp.raise_for_status()
    data = resp.json()
    
    if "error" in data:
        raise Exception(f"API error: {data['error']}")
    
    video_id = data.get("video_id") or data.get("id") or data.get("task_id")
    if not video_id:
        raise Exception(f"No video_id in response: {data}")
    
    return video_id


def poll_video(api_key: str, video_id: str, timeout: int = 600) -> str:
    """Poll until video is ready, return video URL."""
    start = time.time()
    
    while time.time() - start < timeout:
        resp = requests.get(
            f"https://apihub.agnes-ai.com/agnesapi?video_id={video_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        
        status = data.get("status", "unknown")
        progress = data.get("progress", 0)
        elapsed = int(time.time() - start)
        print(f"   [{elapsed}s] {status} {progress}%")
        
        if status == "completed":
            return data.get("video_url") or data.get("remixed_from_video_id")
        
        if status == "failed":
            raise Exception(f"Generation failed: {data.get('error')}")
        
        time.sleep(10)
    
    raise TimeoutError(f"Video generation timed out after {timeout}s")


def generate_video(api_key: str, image_url: str, prompt: str, duration: int = 15) -> str:
    """Full pipeline: submit + poll, return video URL."""
    print(f"🎬 Submitting video generation ({duration}s)...")
    video_id = submit_video(api_key, prompt, image_url, duration)
    print(f"✅ Task submitted: {video_id}")
    
    print("⏳ Waiting for completion...")
    video_url = poll_video(api_key, video_id)
    
    print(f"\n🎉 Video ready!")
    print(f"📹 URL: {video_url}")
    return video_url


def main():
    parser = argparse.ArgumentParser(description="Generate video from image using Agnes AI")
    parser.add_argument("--image", required=True, help="Public image URL")
    parser.add_argument("--prompt", required=True, help="Video prompt")
    parser.add_argument("--duration", type=int, default=15, choices=[5, 10, 15, 20, 25, 30],
                        help="Video duration in seconds (default: 15)")
    parser.add_argument("--api-key", required=True, help="Agnes AI API key")
    parser.add_argument("--output", help="Save video to this path (optional)")
    
    args = parser.parse_args()
    
    try:
        video_url = generate_video(args.api_key, args.image, args.prompt, args.duration)
        
        if args.output and video_url:
            print(f"\n💾 Downloading to {args.output}...")
            resp = requests.get(video_url, timeout=120)
            resp.raise_for_status()
            with open(args.output, "wb") as f:
                f.write(resp.content)
            print(f"✅ Saved to {args.output}")
    
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
