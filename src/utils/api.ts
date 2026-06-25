/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VideoClip } from "../types";
import { rateLimiter } from "./rateLimiter";

export async function optimizePromptApi(
  apiKey: string,
  userPrompt: string,
  mode: "image" | "video"
): Promise<string> {
  await rateLimiter.acquire();
  const response = await fetch("/api/proxy/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "agnes-2.0-flash",
      messages: [
        {
          role: "system",
          content: mode === "image"
            ? `You are a world-class Stable Diffusion / Midjourney prompt engineer specializing in LoRA-style professional image generation. Transform the user's idea into a production-grade English prompt optimized for text-to-image AI models. Follow this EXACT structure with comma-separated phrases:

1. **Quality & LoRA Tags** (start with these): masterpiece, best quality, ultra-detailed, 8k UHD, photorealistic, sharp focus, professional photography, award-winning, highres, absurdres, incredibly detailed, intricate details
2. **Subject & Character**: Precise description — age, gender, hair (color, style, length), eyes, skin, expression, body type, pose, clothing (material, color, fit, brand/style), accessories, jewelry
3. **Scene & Environment**: Detailed setting — location, background elements, objects, props, weather, time of day, season, architecture, nature, urban elements
4. **Composition & Camera**: Camera angle (dutch angle, bird's eye, rule of thirds, low angle, worm's eye), lens (35mm, 85mm f/1.4, 50mm f/1.2, anamorphic, telephoto), depth of field (bokeh, tilt-shift), focal point, framing (close-up, medium shot, wide shot, full body)
5. **Lighting**: Specific setup (golden hour, blue hour, volumetric god rays, Rembrandt lighting, chiaroscuro, rim light, neon ambient, studio softbox, candlelight, bioluminescent, dramatic side lighting)
6. **Color & Mood**: Color palette (warm tones, cool tones, pastel, monochrome, desaturated, vibrant, complementary colors), emotional tone (ethereal, moody, serene, dramatic, whimsical, melancholic)
7. **Art Style** (if applicable): anime, realistic, oil painting, watercolor, concept art, digital illustration, cinematic still, fashion photography, editorial

RULES:
- Translate Chinese or any non-English input to fluent English first
- Use comma-separated descriptive phrases, NEVER full sentences
- Be extremely specific and verbose: "a 25-year-old East Asian woman with long flowing black hair, wearing a weathered brown leather jacket with brass buckles" NOT "a woman in a jacket"
- Include quality boosters that would normally be in negative prompts as positive descriptors
- If the user mentions a specific art style or character (e.g., "Studio Ghibli style", "cyberpunk"), incorporate relevant LoRA-specific keywords
- Output ONLY the optimized prompt text, no explanations, labels, markdown, or formatting`
            : `You are a professional video motion designer and cinematographer. Transform the user's idea into a precise, production-grade video motion guidance prompt. Follow this structure:

1. **Camera Movement**: Specific camera motion (slow dolly-in, smooth tracking shot, orbital pan, handheld shake, crane up, steadicam follow, whip pan, zoom in/out, rack focus).
2. **Subject Animation**: What moves in the scene — character gestures, facial expressions, environmental dynamics (wind, particles, water, smoke), object interactions, cloth movement, hair physics.
3. **Temporal Flow**: Pacing description (slow motion at 120fps, real-time, time-lapse ramp, speed ramp from 0.5x to 2x, freeze frame, bullet time).
4. **Transition & Continuity**: How the shot begins and ends (fade from black, fade to white, whip pan, match cut potential, dissolve, cross-fade).
5. **Atmospheric Dynamics**: Animated elements — drifting fog, flickering lights, rain streaks, dust motes, lens flares, light leaks, particle effects, sparkle effects.

RULES:
- Translate Chinese or any non-English input to fluent English first
- Use concise, action-oriented phrases separated by commas
- Focus on MOVEMENT and TIME — what changes frame by frame
- Be specific: "camera slowly dollies in 2 meters over 4 seconds" NOT "camera moves forward"
- Include timing cues: "0-2s: slow reveal, 2-4s: character turns head, 4-6s: camera pulls back"
- Output ONLY the optimized motion prompt, no explanations, labels, markdown, or formatting`,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to optimize prompt: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Agnes optimization API returned an empty prompt.");
  }
  return text;
}

export async function generateImageApi(
  apiKey: string,
  prompt: string,
  size: string = "1024x768",
  image?: string,
  strength?: number
): Promise<string> {
  await rateLimiter.acquire();
  const body: Record<string, any> = {
    model: "agnes-image-2.1-flash",
    prompt,
    size,
  };

  if (image) {
    body.image = image;
  }
  if (strength !== undefined) {
    body.strength = strength;
  }

  const response = await fetch("/api/proxy/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Image generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL returned from Agnes Image API.");
  }
  return imageUrl;
}

export async function generateCharacterSheetApi(
  apiKey: string,
  description: string,
  style: string = "character turnaround sheet, multiple views, consistent design, reference sheet"
): Promise<string> {
  await rateLimiter.acquire();
  const prompt = `masterpiece, best quality, ultra-detailed, 8k UHD, character turnaround reference sheet, ${style}, ${description}, front view, side view, back view, three-quarter view, full body, neutral pose, white background, clean design, consistent character across all views`;

  const response = await fetch("/api/proxy/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "agnes-image-2.1-flash",
      prompt,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Character sheet generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL returned from Agnes Image API.");
  }
  return imageUrl;
}

export async function generateCharacterViewApi(
  apiKey: string,
  description: string,
  viewAngle: string,
  referenceImageUrl?: string
): Promise<string> {
  await rateLimiter.acquire();
  const anglePrompts: Record<string, string> = {
    front: "front view, facing camera, neutral expression, full body",
    side: "side profile view, facing right, neutral expression, full body",
    back: "back view, rear perspective, neutral expression, full body",
    threeQuarter: "three-quarter angle view, 45 degrees, neutral expression, full body",
  };

  const angleDesc = anglePrompts[viewAngle] || anglePrompts.front;
  const prompt = `masterpiece, best quality, ultra-detailed, 8k UHD, character reference, ${angleDesc}, ${description}, white background, clean design, consistent character design`;

  const body: Record<string, any> = {
    model: "agnes-image-2.1-flash",
    prompt,
    size: "1024x1024",
  };

  if (referenceImageUrl) {
    body.image = referenceImageUrl;
    body.strength = 0.6;
  }

  const response = await fetch("/api/proxy/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Character view generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL returned from Agnes Image API.");
  }
  return imageUrl;
}

export async function createVideoTaskApi(
  apiKey: string,
  prompt: string,
  imageUrl?: string
): Promise<{ video_id?: string; task_id?: string }> {
  await rateLimiter.acquire();
  const body: Record<string, any> = {
    model: "agnes-video-v2.0",
    prompt,
    num_frames: 121, // 8n + 1 frame rate compatibility
    frame_rate: 24,
  };

  if (imageUrl) {
    body.image = imageUrl; // Image-to-video workflow
  }

  const response = await fetch("/api/proxy/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Video generation task creation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    video_id: data.video_id,
    task_id: data.task_id,
  };
}

export async function pollVideoStatusApi(
  apiKey: string,
  video_id?: string,
  task_id?: string,
  onProgress?: (message: string) => void
): Promise<string> {
  let queryParams = "";
  if (video_id) {
    queryParams = `video_id=${video_id}`;
  } else if (task_id) {
    queryParams = `task_id=${task_id}`;
  } else {
    throw new Error("Either video_id or task_id must be provided to query status.");
  }

  const delays = [5000, 10000, 15000, 20000, 30000, 45000, 60000];
  const maxAttempts = 35;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait first before polling if it's a retry/subsequent attempt
    if (attempt > 0) {
      const currentDelay = delays[Math.min(attempt - 1, delays.length - 1)];
      let remainingMs = currentDelay;
      while (remainingMs > 0) {
        if (onProgress) {
          onProgress(`Polling next in ${Math.ceil(remainingMs / 1000)}s... (Attempt ${attempt + 1}/${maxAttempts})`);
        }
        const waitTime = Math.min(remainingMs, 1000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        remainingMs -= waitTime;
      }
    } else {
      if (onProgress) {
        onProgress("Checking initial video rendering status...");
      }
    }

    await rateLimiter.acquire();
    const response = await fetch(`/api/proxy/status?${queryParams}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      continue; // Sometime transient server networks block, retry gracefully
    }

    const data = await response.json();
    const status = data.status?.toLowerCase();

    if (onProgress) {
      onProgress(`Video status: ${status || "pending"}...`);
    }

    if (status === "completed" || status === "success") {
      const urls = data.urls;
      if (urls && urls.length > 0) {
        return urls[0];
      }
      const videoUrl = data.video_url || data.url || data.remixed_from_video_id;
      if (videoUrl) {
        return videoUrl;
      }
      throw new Error("Video was generated successfully, but no URL was found in the response.");
    } else if (status === "failed") {
      throw new Error(data.error || "Agnes AI video generation failed.");
    }
  }

  throw new Error("Polling timeout: Video generation is taking longer than expected. Please check back later.");
}

export async function mergeClipsApi(
  clips: VideoClip[],
  lang: "zh" | "en"
): Promise<{ videoUrl: string; subtitlesUrl: string; voiceoverUrl: string | null }> {
  const response = await fetch("/api/merge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clips, lang }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to merge clips: ${response.statusText}`);
  }

  return response.json();
}

export interface VideoProgressMessage {
  type: "progress" | "done" | "error" | "subscribed";
  taskId: string;
  step?: string;
  status?: string;
  message?: string;
  progress?: number;
  url?: string;
  videoId?: string;
}

export function subscribeVideoProgress(
  videoId: string,
  apiKey: string,
  taskId: string,
  onProgress: (msg: VideoProgressMessage) => void,
  onDone: (url: string) => void,
  onError: (message: string) => void
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws?taskId=${encodeURIComponent(taskId)}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "subscribe", videoId, apiKey }));
  };

  ws.onmessage = (event) => {
    try {
      const msg: VideoProgressMessage = JSON.parse(event.data);
      if (msg.type === "done" && msg.url) {
        onDone(msg.url);
      } else if (msg.type === "error") {
        onError(msg.message || "Unknown error");
      } else {
        onProgress(msg);
      }
    } catch {}
  };

  ws.onerror = () => {
    onError("WebSocket connection error");
  };

  return ws;
}
