#!/usr/bin/env python3
"""
Edge-TTS wrapper for Agnes Film Studio.
Usage: python tts_edge.py --text "Hello" --voice zh-CN-XiaoxiaoNeural --output out.mp3
"""

import argparse
import asyncio
import edge_tts
import sys


# Available voices (subset)
VOICES = {
    # Chinese
    "zh-female-xiaoxiao": "zh-CN-XiaoxiaoNeural",
    "zh-female-xiaoyi": "zh-CN-XiaoyiNeural",
    "zh-male-yunjian": "zh-CN-YunjianNeural",
    "zh-male-yunxi": "zh-CN-YunxiNeural",
    "zh-female-xiaohan": "zh-CN-XiaohanNeural",
    "zh-female-xiaomeng": "zh-CN-XiaomengNeural",
    "zh-female-xiaorui": "zh-CN-XiaoruiNeural",
    "zh-female-xiaoshuang": "zh-CN-XiaoshuangNeural",
    "zh-female-xiaoyou": "zh-CN-XiaoyouNeural",
    # English
    "en-female-jenny": "en-US-JennyNeural",
    "en-female-aria": "en-US-AriaNeural",
    "en-male-guy": "en-US-GuyNeural",
    "en-female-davis": "en-US-DavisNeural",
    "en-female-jane": "en-US-JaneNeural",
    "en-male-tony": "en-US-TonyNeural",
    "en-female-sara": "en-US-SaraNeural",
    "en-male-andrew": "en-US-AndrewNeural",
    "en-male-brian": "en-US-BrianNeural",
    # Japanese
    "ja-female-nanami": "ja-JP-NanamiNeural",
    "ja-male-keita": "ja-JP-KeitaNeural",
    # Korean
    "ko-female-sunhi": "ko-KR-SunHiNeural",
    "ko-male-injoon": "ko-KR-InJoonNeural",
}


async def generate_tts(text: str, voice: str, output: str, rate: str = "+0%", pitch: str = "+0Hz"):
    """Generate speech from text using Edge-TTS."""
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(output)


def list_voices():
    """Print available voices."""
    for name, voice_id in sorted(VOICES.items()):
        print(f"  {name:30s} -> {voice_id}")


def main():
    parser = argparse.ArgumentParser(description="Edge-TTS voice synthesis")
    parser.add_argument("--text", "-t", help="Text to speak")
    parser.add_argument("--file", "-f", help="Text file to read")
    parser.add_argument("--voice", "-v", default="zh-female-xiaoxiao",
                        help="Voice name or Edge voice ID (default: zh-female-xiaoxiao)")
    parser.add_argument("--output", "-o", required=True, help="Output audio file (.mp3)")
    parser.add_argument("--rate", "-r", default="+0%", help="Speech rate adjustment (e.g. +20%%, -10%%)")
    parser.add_argument("--pitch", "-p", default="+0Hz", help="Pitch adjustment (e.g. +50Hz)")
    parser.add_argument("--list-voices", action="store_true", help="List available voices")

    args = parser.parse_args()

    if args.list_voices:
        print("Available voices:")
        list_voices()
        return

    # Get text
    text = args.text
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            text = f.read()
    if not text:
        print("Error: --text or --file required")
        sys.exit(1)

    # Resolve voice ID
    voice_id = VOICES.get(args.voice, args.voice)

    # Generate
    print(f"[TTS] Voice: {voice_id}, Rate: {args.rate}, Pitch: {args.pitch}")
    print(f"[TTS] Text: {text[:80]}{'...' if len(text) > 80 else ''}")

    try:
        asyncio.run(generate_tts(text, voice_id, args.output, args.rate, args.pitch))
        import os
        size_kb = os.path.getsize(args.output) / 1024
        print(f"[TTS] Done: {args.output} ({size_kb:.1f}KB)")
    except Exception as e:
        print(f"[TTS] Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
