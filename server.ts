/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";
import { exec } from "child_process";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json({ limit: "50mb" }));
// Serve uploaded/generated files statically
app.use("/uploads", express.static(UPLOADS_DIR));

// ==========================================
// Session output folder
// ==========================================
const OUTPUTS_DIR = path.join(process.cwd(), "outputs");
if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}
let currentSessionDir: string | null = null;

// Create a new session output folder
app.post("/api/output/create", (req, res) => {
  const { name } = req.body;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeName = (name || "session").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_");
  currentSessionDir = path.join(OUTPUTS_DIR, `${safeName}_${ts}`);
  fs.mkdirSync(currentSessionDir, { recursive: true });
  res.json({ path: currentSessionDir, url: `/outputs/${safeName}_${ts}` });
});

// Get current session folder
app.get("/api/output/current", (_req, res) => {
  res.json({ path: currentSessionDir });
});

// Save reference image to output folder
app.post("/api/output/save-image", async (req, res) => {
  const { imageUrl, name } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl" });
  if (!currentSessionDir) {
    // Create a folder if none exists
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    currentSessionDir = path.join(OUTPUTS_DIR, `session_${ts}`);
    fs.mkdirSync(currentSessionDir, { recursive: true });
  }
  try {
    const ext = imageUrl.includes(".png") ? ".png" : ".jpg";
    const filename = (name || "reference") + ext;
    const filepath = path.join(currentSessionDir, filename);
    await downloadFile(imageUrl, filepath);
    res.json({ path: filepath, filename });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save video to output folder
app.post("/api/output/save-video", async (req, res) => {
  const { videoUrl, name } = req.body;
  if (!videoUrl) return res.status(400).json({ error: "Missing videoUrl" });
  if (!currentSessionDir) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    currentSessionDir = path.join(OUTPUTS_DIR, `session_${ts}`);
    fs.mkdirSync(currentSessionDir, { recursive: true });
  }
  try {
    const filename = (name || "video") + ".mp4";
    const filepath = path.join(currentSessionDir, filename);
    await downloadFile(videoUrl, filepath);
    res.json({ path: filepath, filename });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload base64 image to freeimage.host and return public URL (Agnes API requires public URLs)
app.post("/api/upload-image", async (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: "Missing base64" });

  // Parse base64
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: "Invalid base64 format" });

  const imageData = matches[2]; // raw base64 without prefix
  const ext = matches[1] === "png" ? "png" : "jpg";

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, "base64");

    // Upload to freeimage.host (free, no API key needed for small uploads)
    const formData = new FormData();
    formData.append("source", new Blob([buffer], { type: `image/${ext}` }), `upload.${ext}`);
    formData.append("type", "file");
    formData.append("action", "upload");
    formData.append("key", "6d207e02198a847aa98d0a2a901485a5"); // free anonymous key

    const uploadResp = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      console.error("FreeImage upload failed:", errText);
      return res.status(500).json({ error: "Image upload failed" });
    }

    const uploadData: any = await uploadResp.json();
    const publicUrl = uploadData.image?.url;
    if (!publicUrl) {
      return res.status(500).json({ error: "No URL in upload response" });
    }

    console.log("Image uploaded to freeimage.host:", publicUrl);
    res.json({ url: publicUrl });
  } catch (err: any) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve output files
const OUTPUTS_STATIC = path.join(process.cwd(), "outputs");
app.use("/outputs", express.static(OUTPUTS_STATIC));

// Helper: save a file to current session output folder
async function saveToSession(filename: string, data: Buffer | string): Promise<string | null> {
  if (!currentSessionDir) return null;
  const filepath = path.join(currentSessionDir, filename);
  fs.writeFileSync(filepath, data);
  return filepath;
}

// Helper: Download a file from URL to local path
async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  await fs.promises.writeFile(destPath, Buffer.from(buffer));
}

// Helper: Fetch TTS chunk from Google Translate TTS API
async function fetchTtsChunk(text: string, lang: string): Promise<Buffer> {
  const ttsLang = lang === "zh" ? "zh-CN" : "en";
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsLang}&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
    }
  });
  if (!response.ok) {
    throw new Error(`TTS generation failed: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Helper: Standard formatting for VTT timestamp
function formatVttTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const hrsStr = hrs.toString().padStart(2, "0");
  const minsStr = mins.toString().padStart(2, "0");
  const secsStr = secs.toString().padStart(2, "0");
  const msStr = ms.toString().padStart(3, "0");

  return `${hrsStr}:${minsStr}:${secsStr}.${msStr}`;
}

// ==========================================
// 1. AGNES AI PROXY ROUTES
// ==========================================

// Helper: Translation using the free Google Translate API
async function translateToEnglish(text: string): Promise<string> {
  if (!text || !/[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0].trim();
      }
    }
  } catch (err) {
    console.warn("Free translation API failed, utilizing local dictionary:", err);
  }
  return "";
}

// API endpoint for smart character and style consistency feature anchoring
app.post("/api/analyze-character", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing or invalid prompt parameter." });
  }

  const authHeader = req.headers.authorization;
  const isDemo = !authHeader || authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");

  // 1. Try to call the real Agnes text API first if a real API Key is provided
  if (!isDemo && authHeader) {
    try {
      console.log("Calling real Agnes API to extract/anchor character features...");
      const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          model: "agnes-2.0-flash",
          messages: [
            {
              role: "system",
              content: "Analyze the following scene description. Identify the primary subject or character (e.g. an astronaut, a female explorer, a futuristic car, a robot, etc.). Extract and formulate a detailed, specific, and consistent English physical description of this subject/character (hair color/style, clothing details, age, specific gear, key colors, and accessories) so we can anchor its visual features and keep it identical/consistent across future video scenes. Output ONLY the clean, concise English physical description under 25 words. Do not write any other explanation or formatting."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          console.log(`Agnes successfully extracted character traits: "${text}"`);
          return res.json({ character: text });
        }
      } else {
        console.warn(`Real Agnes API returned status ${response.status} for character analysis.`);
      }
    } catch (err) {
      console.log("Real Agnes API character analysis bypassed (using simulation fallback)");
    }
  }

  let englishPrompt = prompt;
  if (/[\u4e00-\u9fa5]/.test(prompt)) {
    const apiTranslated = await translateToEnglish(prompt);
    if (apiTranslated) {
      englishPrompt = apiTranslated;
    }
  }

  const pLower = englishPrompt.toLowerCase();
  
  // 2. Fallback rule-based smart anchors if simulated/demo or if real API fails
  let character = "a mysterious traveler in a dark hooded cloak and brass-rimmed goggles";
  
  if (pLower.includes("astronaut") || pLower.includes("mars") || pLower.includes("space")) {
    character = "a red-haired astronaut wearing a white spacesuit with gold visor and a shoulder emblem";
  } else if (pLower.includes("cyberpunk") || pLower.includes("girl") || pLower.includes("woman") || pLower.includes("female")) {
    character = "a 25-year-old female with short blonde hair, wearing a high-tech blue jacket, amber glasses";
  } else if (pLower.includes("boy") || pLower.includes("man") || pLower.includes("male") || pLower.includes("explorer")) {
    character = "a rugged 30-year-old male explorer in a leather jacket, heavy boots, and silver goggles";
  } else if (pLower.includes("robot") || pLower.includes("android") || pLower.includes("cyborg")) {
    character = "a sleek chrome humanoid robot with glowing neon blue optical sensors and carbon fiber joints";
  } else if (pLower.includes("cat")) {
    character = "a fluffy orange tabby cat wearing a tiny high-tech glowing neon collar";
  } else if (pLower.includes("dog")) {
    character = "a smart golden retriever wearing a futuristic rescue harness with a green light";
  } else if (pLower.includes("car") || pLower.includes("vehicle")) {
    character = "a sleek matte-black futuristic sports car with glowing amber headlights and aerodynamic wings";
  } else if (pLower.includes("alien") || pLower.includes("creature")) {
    character = "a tall bioluminescent alien creature with iridescent scales and large deep-purple eyes";
  } else {
    // Dynamic subject fallback! Clean up common action verbs and formatting words
    const cleanSubject = englishPrompt
      .replace(/\b(fight|fighting|battle|clash|scene|background|backgrounds|masterpiece|cinematic|photorealistic|high-density|highly|8k|masterpiece|of|and|with)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanSubject && cleanSubject.length > 2) {
      character = `a realistic ${cleanSubject}`;
    }
  }

  console.log(`Fallback rule-based character anchor selected: "${character}"`);
  return res.json({ character });
});

// Proxy to Agnes API Chat/Completions
app.post("/api/proxy/chat", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header (Agnes API Key)" });
  }

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");

  if (isDemo) {
    return res.status(400).json({ error: "Demo key detected. Please enter a real Agnes API key." });
  }

  try {
    const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(req.body),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMsg = `Agnes API error: ${response.status}`;
      try {
        const errData = JSON.parse(responseText);
        errorMsg = errData.error?.message || errData.message || errorMsg;
      } catch {}
      return res.status(response.status).json({ error: errorMsg });
    }

    try {
      const data = JSON.parse(responseText);
      return res.json(data);
    } catch (e) {
      return res.status(500).json({ error: "Invalid response from Agnes API" });
    }
  } catch (error: any) {
    console.error("Proxy Chat error:", error);
    return res.status(500).json({ error: error.message || "Failed to connect to Agnes API" });
  }
});

// Proxy to Agnes API Images/Generations
app.post("/api/proxy/images", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header (Agnes API Key)" });
  }

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");

  if (isDemo) {
    return res.status(400).json({ error: "Demo key detected. Please enter a real Agnes API key." });
  }

  try {
    const controller = new AbortController();
    // Image generation often exceeds 60s; align with client 180s budget
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const requestBody = JSON.stringify(req.body);
    console.log(`[Image API] → POST https://apihub.agnes-ai.com/v1/images/generations`);
    console.log(`[Image API] body keys: ${Object.keys(req.body || {}).join(",")}`);

    const response = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: requestBody,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log(`[Image API] ← ${response.status} (${responseText.length} bytes)`);

    if (!response.ok) {
      let errorMsg = `Agnes API error: ${response.status}`;
      try {
        const errData = JSON.parse(responseText);
        errorMsg = errData.error?.message || errData.error || errData.message || errorMsg;
        if (typeof errorMsg !== "string") errorMsg = JSON.stringify(errorMsg);
      } catch {
        if (responseText) errorMsg = `${errorMsg}: ${responseText.slice(0, 300)}`;
      }
      return res.status(response.status).json({ error: errorMsg });
    }

    try {
      const data = JSON.parse(responseText);
      const url =
        data.data?.[0]?.url ||
        data.url ||
        data.image_url ||
        data.images?.[0]?.url;
      if (url) {
        // Normalize to expected shape for clients
        if (!data.data?.[0]?.url) {
          return res.json({ ...data, data: [{ url }] });
        }
        return res.json(data);
      }
      console.error("[Image API] no URL in response:", responseText.slice(0, 500));
      return res.status(500).json({ error: "Invalid response: no image URL returned", raw: responseText.slice(0, 500) });
    } catch (e) {
      return res.status(500).json({ error: "Invalid response from Agnes API", raw: responseText.slice(0, 300) });
    }
  } catch (error: any) {
    console.error("Proxy Images error:", error);
    const msg =
      error?.name === "AbortError"
        ? "Image generation timed out (180s)"
        : error.message || "Failed to connect to Agnes API";
    return res.status(500).json({ error: msg });
  }
});

// Proxy to Agnes API Videos/Generations
app.post("/api/proxy/videos", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header (Agnes API Key)" });
  }

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");

  if (isDemo) {
    return res.status(400).json({ error: "Demo key detected. Please enter a real Agnes API key." });
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 30000; // 30 seconds between retries

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      console.log(`[Video API] → POST https://apihub.agnes-ai.com/v1/videos (attempt ${attempt}/${MAX_RETRIES})`);
      console.log(`[Video API] Body: ${JSON.stringify(req.body).slice(0, 500)}`);

      const response = await fetch("https://apihub.agnes-ai.com/v1/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log(`[Video API] ← Status: ${response.status}`);
      console.log(`[Video API] Response: ${responseText.slice(0, 500)}`);

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          // Normalize IDs — docs: video_id is preferred for polling; id/task_id are legacy
          const taskId = data.task_id || data.id;
          const videoId = data.video_id;
          if (!taskId && !videoId) {
            return res.status(400).json({ error: "Invalid response: missing task_id or video_id", raw: data });
          }
          // Cap awareness: clients may send too many frames; log for debugging
          console.log(
            `[Video API] created task_id=${taskId || "n/a"} video_id=${videoId || "n/a"} status=${data.status || "?"}`
          );
          return res.status(response.status).json({
            ...data,
            // Explicit aliases so all clients pick video_id first
            task_id: taskId,
            video_id: videoId,
            id: taskId || videoId,
            // Hint for clients: always poll with poll_id
            poll_id: videoId || taskId,
            poll_mode: videoId ? "video_id" : "task_id",
          });
        } catch (e) {
          return res.status(500).json({ error: "Failed to parse Agnes API response" });
        }
      }

      // Return all errors directly to client — client handles retry with visible UI feedback
      let errorMsg = `Agnes API error: ${response.status}`;
      try {
        const errData = JSON.parse(responseText);
        errorMsg = errData.message || errData.error?.message || errorMsg;
      } catch {}
      return res.status(response.status).json({ error: errorMsg, retryable: response.status === 503 });

    } catch (error: any) {
      console.error("Proxy Videos error:", error);
      return res.status(500).json({ error: error.message || "Failed to connect to Agnes API", retryable: true });
    }
  }

  return res.status(503).json({ error: "Agnes API is busy. Please try again later.", retryable: true });
});

// Proxy to Agnes API Tasks/Status
app.get("/api/proxy/status", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header (Agnes API Key)" });
  }

  const { video_id, task_id } = req.query;

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");

  if (isDemo) {
    return res.status(400).json({ error: "Demo key detected. Please enter a real Agnes API key." });
  }

  const rawId = (video_id || task_id) as string;
  if (!rawId) {
    return res.status(400).json({ error: "Required query parameter video_id or task_id is missing" });
  }

  try {
    // Strip "Bearer " for fetchVideoStatus helper (it adds Authorization itself)
    const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const data = await fetchVideoStatus(rawId, apiKey);
    if (!data) {
      return res.status(502).json({ error: "Failed to query Agnes video status from all endpoints" });
    }
    // Normalize URL field for clients
    const url = extractVideoUrl(data);
    return res.json({
      ...data,
      url: url || data.url,
      video_url: url || data.video_url,
    });
  } catch (error: any) {
    console.error("Proxy Status error:", error);
    return res.status(500).json({ error: error.message || "Failed to connect to Agnes API" });
  }
});

// ==========================================
// 2. TTS (TEXT TO SPEECH) ENDPOINT
// ==========================================

// Split text into ≤150-char chunks on sentence boundaries (Google TTS API limit ~200 chars)
function splitTextIntoChunks(text: string, maxLen = 150): string[] {
  const chunks: string[] = [];
  const parts = text.split(/([.,!?;，。！？；\n]+)/g);
  let current = "";
  for (const part of parts) {
    if (!part) continue;
    if (current.length + part.length < maxLen) {
      current += part;
    } else {
      if (current.trim()) chunks.push(current.trim());
      current = part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  if (chunks.length === 0) chunks.push(text.slice(0, maxLen));
  return chunks;
}

app.post("/api/tts", async (req, res) => {
  const { text, lang } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text parameter is required" });
  }

  try {
    const ttsLang = lang || "zh";
    const chunks = splitTextIntoChunks(text);

    // Fetch chunks and concatenate
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await fetchTtsChunk(chunk, ttsLang);
      buffers.push(buf);
    }

    const finalBuffer = Buffer.concat(buffers);
    const filename = `tts_${Date.now()}.mp3`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await fs.promises.writeFile(filepath, finalBuffer);

    res.json({
      success: true,
      audioUrl: `/uploads/${filename}`
    });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate TTS audio" });
  }
});

// ==========================================
// 3. VIDEO MERGING AND POST-PROCESSING ENDPOINT
// ==========================================
// Only allow downloading from safe sources to prevent SSRF
function isAllowedVideoUrl(rawUrl: string): boolean {
  // Allow local paths (uploads/, outputs/)
  if (rawUrl.startsWith("/uploads/") || rawUrl.startsWith("/outputs/")) {
    return true;
  }
  try {
    const u = new URL(rawUrl);
    // Allow local/LAN URLs (localhost, 127.0.0.1, 192.168.x.x, etc.)
    const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1"
      || /^192\.168\./.test(u.hostname) || /^10\./.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname);
    if (isLocal) return true;
    const allowed = [
      "apihub.agnes-ai.com",
      "cdn.agnes-ai.com",
      "platform-outputs.agnes-ai.space",
      "storage.googleapis.com",
      "freeimage.host",
    ];
    return u.protocol === "https:" && allowed.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

app.post("/api/merge", async (req, res) => {
  const { clips, lang, voiceover = false } = req.body;
  if (!clips || !Array.isArray(clips) || clips.length === 0) {
    return res.status(400).json({ error: "Invalid clips list provided" });
  }
  if (clips.length > 20) {
    return res.status(400).json({ error: "Maximum 20 clips per merge request" });
  }

  const runId = Date.now();
  const tempDir = path.join(UPLOADS_DIR, `temp_${runId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log(`Starting merge process (ID: ${runId}) for ${clips.length} clips.`);
    const localVideoPaths: string[] = [];
    const subtitleEntries: { start: number; end: number; text: string }[] = [];
    let cumulativeTime = 0;

    // Standard duration of Agnes video if not specified
    const standardDuration = 5.04;

    // Step 1: Download each video clip and compute subtitle timestamps
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (!clip.videoUrl) {
        throw new Error(`Clip at index ${i} is missing videoUrl`);
      }

      if (!isAllowedVideoUrl(clip.videoUrl)) {
        throw new Error(`Clip ${i}: URL not from an allowed domain`);
      }

      const clipFilename = `clip_${i}.mp4`;
      const clipLocalPath = path.join(tempDir, clipFilename);

      // Resolve full localhost/LAN URLs to local file paths (avoid HTTP round-trip)
      let clipPath = clip.videoUrl;
      try {
        const u = new URL(clip.videoUrl);
        const isLocalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1" || /^192\.168\./.test(u.hostname);
        if (isLocalHost && (u.pathname.startsWith("/uploads/") || u.pathname.startsWith("/outputs/"))) {
          clipPath = u.pathname;
        }
      } catch {}

      if (clipPath.startsWith("/uploads/") || clipPath.startsWith("/outputs/")) {
        const localSrc = path.join(process.cwd(), clipPath.replace(/^\//, ""));
        console.log(`Copying clip ${i} from local: ${localSrc}`);
        fs.copyFileSync(localSrc, clipLocalPath);
      } else {
        console.log(`Downloading clip ${i}: ${clip.videoUrl}`);
        await downloadFile(clip.videoUrl, clipLocalPath);
      }
      localVideoPaths.push(clipLocalPath);

      // Track duration
      const clipDuration = clip.duration || standardDuration;
      if (clip.subtitle && clip.subtitle.trim()) {
        subtitleEntries.push({
          start: cumulativeTime,
          end: cumulativeTime + clipDuration,
          text: clip.subtitle.trim()
        });
      }
      cumulativeTime += clipDuration;
    }

    // Step 2: Generate WebVTT Subtitle Track
    let vttContent = "WEBVTT\n\n";
    subtitleEntries.forEach((entry, index) => {
      vttContent += `${index + 1}\n`;
      vttContent += `${formatVttTime(entry.start)} --> ${formatVttTime(entry.end)}\n`;
      vttContent += `${entry.text}\n\n`;
    });

    const vttFilename = `subs_${runId}.vtt`;
    const vttLocalPath = path.join(UPLOADS_DIR, vttFilename);
    await fs.promises.writeFile(vttLocalPath, vttContent, "utf-8");

    // Step 3: Concatenate Videos using ffmpeg
    const finalVideoFilename = `merged_${runId}.mp4`;
    const finalVideoPath = path.join(UPLOADS_DIR, finalVideoFilename);

    // Create the demuxer inputs list
    const listFileContent = localVideoPaths.map(p => `file '${p}'`).join("\n");
    const listFilePath = path.join(tempDir, "inputs.txt");
    await fs.promises.writeFile(listFilePath, listFileContent, "utf-8");

    // Verify if ffmpeg is available
    let ffmpegAvailable = false;
    try {
      await new Promise((resolve, reject) => {
        exec("ffmpeg -version", (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
      ffmpegAvailable = true;
    } catch (e) {
      console.warn("FFmpeg is not installed or available on this host. Falling back to simple file copy.");
    }

    let hasAudio = false;
    let finalAudioUrl: string | null = null;

    // Step 4: Generate voiceover audio only if voiceover is enabled and subtitles exist
    const fullText = clips.map(c => c.subtitle || "").filter(Boolean).join(" ");
    if (voiceover && fullText.trim()) {
      try {
        const ttsLang = lang || "zh";
        const chunks = splitTextIntoChunks(fullText);

        const buffers: Buffer[] = [];
        for (const chunk of chunks) {
          const buf = await fetchTtsChunk(chunk, ttsLang);
          buffers.push(buf);
        }

        const audioFilename = `voice_${runId}.mp3`;
        const audioLocalPath = path.join(UPLOADS_DIR, audioFilename);
        await fs.promises.writeFile(audioLocalPath, Buffer.concat(buffers));
        finalAudioUrl = `/uploads/${audioFilename}`;
        hasAudio = true;
      } catch (err) {
        console.error("Failed to generate combined voiceover:", err);
      }
    }

    if (ffmpegAvailable) {
      // Run ffmpeg concat
      const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${finalVideoPath}"`;
      console.log(`Executing: ${concatCmd}`);
      
      await new Promise((resolve, reject) => {
        exec(concatCmd, (err, stdout, stderr) => {
          if (err) {
            console.error("FFmpeg concat failed:", stderr);
            reject(err);
          } else {
            resolve(true);
          }
        });
      });

      // If we have voiceover, dub it over the merged video
      if (hasAudio && finalAudioUrl) {
        const localAudioPath = path.join(UPLOADS_DIR, path.basename(finalAudioUrl));
        const dubbedVideoFilename = `dubbed_${runId}.mp4`;
        const dubbedVideoPath = path.join(UPLOADS_DIR, dubbedVideoFilename);
        
        // Dub voice over video, keep video copy, replace or add audio
        const dubCmd = `ffmpeg -y -i "${finalVideoPath}" -i "${localAudioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${dubbedVideoPath}"`;
        console.log(`Executing dubbing: ${dubCmd}`);
        
        try {
          await new Promise((resolve, reject) => {
            exec(dubCmd, (err, stdout, stderr) => {
              if (err) {
                console.error("FFmpeg dubbing failed:", stderr);
                reject(err);
              } else {
                resolve(true);
              }
            });
          });
          // Replace final output with dubbed version
          fs.renameSync(dubbedVideoPath, finalVideoPath);
        } catch (dubErr) {
          console.error("Dubbing command failed, returning un-dubbed merged video:", dubErr);
        }
      }
    } else {
      // FFmpeg Fallback: Copy first downloaded clip as merged video so the demo works smoothly!
      console.warn("Using simple copy fallback since FFmpeg is not available.");
      fs.copyFileSync(localVideoPaths[0], finalVideoPath);
    }

    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error("Failed to clean up temp files:", cleanupErr);
    }

    res.json({
      success: true,
      videoUrl: `/uploads/${finalVideoFilename}`,
      subtitlesUrl: `/uploads/${vttFilename}`,
      voiceoverUrl: finalAudioUrl,
    });
  } catch (error: any) {
    console.error("Merge error:", error);
    // Gracefully clean up on failure
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}
    res.status(500).json({ error: error.message || "Failed to merge video clips" });
  }
});

// ==========================================
// 4. WEBSOCKET VIDEO PROGRESS
// ==========================================

const videoProgressClients = new Map<string, Set<WebSocket>>();

// Agnes returns video_id as "video_<base64>" where base64 decodes to
// "litellm:...;video_id:video_xxx". Extract the inner ID for polling.
function resolveVideoId(videoId: string): string {
  if (videoId.startsWith("video_")) {
    try {
      const b64 = videoId.slice("video_".length);
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      const match = decoded.match(/video_id:(video_[^;]+)/);
      if (match) return match[1];
    } catch {}
  }
  return videoId;
}

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

/** Deep-search any http(s) URL that looks like a video asset */
function extractVideoUrl(rawData: any): string | undefined {
  if (!rawData || typeof rawData !== "object") return undefined;

  const directCandidates = [
    rawData.url,
    rawData.video_url,
    rawData.videoUrl,
    rawData.remixed_from_video_id,
    rawData.download_url,
    rawData.downloadUrl,
    rawData.output_url,
    rawData.outputUrl,
    rawData.file_url,
    rawData.fileUrl,
    rawData.mp4_url,
    rawData.mp4Url,
    rawData.urls?.[0],
    rawData.data?.url,
    rawData.data?.video_url,
    rawData.data?.[0]?.url,
    rawData.output?.url,
    rawData.output?.video_url,
    rawData.result?.url,
    rawData.result?.video_url,
    rawData.video?.url,
    rawData.assets?.[0]?.url,
    rawData.files?.[0]?.url,
  ];
  for (const c of directCandidates) {
    if (isHttpUrl(c)) return c;
    // remixed_from_video_id sometimes is a bare video_ id, not a URL — skip non-http
  }

  // Recursive walk (depth-limited) for any .mp4 / platform-outputs URL
  const seen = new Set<any>();
  const stack: any[] = [rawData];
  let steps = 0;
  while (stack.length && steps < 80) {
    steps++;
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
      continue;
    }
    for (const [k, v] of Object.entries(cur)) {
      if (isHttpUrl(v)) {
        const s = v as string;
        if (
          /\.mp4(\?|$)/i.test(s) ||
          /agnes-ai\.space/i.test(s) ||
          /platform-outputs/i.test(s) ||
          /\/videos\//i.test(s) ||
          /cdn/i.test(s) ||
          k.toLowerCase().includes("url") ||
          k.toLowerCase().includes("video")
        ) {
          return s;
        }
      } else if (v && typeof v === "object") {
        stack.push(v);
      }
    }
  }
  return undefined;
}

function extractErrorMessage(rawData: any): string {
  const err = rawData?.error;
  if (!err) return "Video generation failed";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    return err.message || err.code || JSON.stringify(err);
  }
  return String(err);
}

function isTerminalSuccess(status: string): boolean {
  return ["completed", "success", "succeeded", "done"].includes(status);
}

function isTerminalFailure(status: string): boolean {
  return ["failed", "error", "cancelled", "canceled"].includes(status);
}

/**
 * Build poll URLs for Agnes video tasks.
 * Official clients ALWAYS use /agnesapi?video_id=...&model_name=agnes-video-v2.0
 * even when the id looks like task_*. /v1/videos/{id} often returns progress
 * without the final URL — so we try agnesapi first, then legacy.
 */
function buildVideoPollUrls(rawId: string): string[] {
  const resolved = resolveVideoId(rawId);
  const ids = Array.from(new Set([resolved, rawId].filter(Boolean)));
  const urls: string[] = [];

  for (const id of ids) {
    // Preferred (official example / 1038lab video.py)
    urls.push(
      `https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(id)}&model_name=agnes-video-v2.0`
    );
    urls.push(`https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(id)}`);
    // Legacy OpenAI-compatible
    urls.push(`https://apihub.agnes-ai.com/v1/videos/${encodeURIComponent(id)}`);
    urls.push(`https://apihub.agnes-ai.com/v1/video/generations/${encodeURIComponent(id)}`);
  }

  return urls;
}

async function fetchVideoStatus(rawId: string, apiKey: string): Promise<any | null> {
  const urls = buildVideoPollUrls(rawId);
  let lastErr: any = null;
  let bestPartial: any | null = null; // keep highest-progress response if none have URL yet

  for (const targetUrl of urls) {
    try {
      const response = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20000),
      });
      const text = await response.text();
      if (!response.ok) {
        lastErr = { status: response.status, body: text.slice(0, 200), url: targetUrl };
        console.warn(`[Video Poll] ${response.status} ${targetUrl} ${text.slice(0, 120)}`);
        continue;
      }
      // Content endpoint may return binary — skip non-JSON
      const trimmed = text.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        console.warn(`[Video Poll] non-JSON from ${targetUrl} (${text.slice(0, 40)})`);
        continue;
      }
      const data = JSON.parse(text);
      data.__poll_via = targetUrl;

      const url = extractVideoUrl(data);
      const status = String(data.status || data.state || "").toLowerCase();

      // Prefer any response that already has a playable URL
      if (url) {
        console.log(`[Video Poll] URL found via ${targetUrl}`);
        return data;
      }

      // Track best progress/status for caller
      if (
        !bestPartial ||
        (typeof data.progress === "number" &&
          data.progress > (bestPartial.progress || 0)) ||
        isTerminalSuccess(status)
      ) {
        bestPartial = data;
      }
    } catch (e: any) {
      lastErr = e;
      if (e?.name === "TimeoutError" || e?.name === "AbortError") continue;
      console.warn(`[Video Poll] error ${targetUrl}:`, e?.message || e);
    }
  }

  if (bestPartial) return bestPartial;

  if (lastErr) {
    console.warn("[Video Poll] all endpoints failed for", rawId, lastErr);
  }
  return null;
}

/**
 * Historical Agnes completions use a stable CDN path:
 *   https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/{task_or_video_id}.mp4
 * When status=completed but JSON omits `url`, try these guessed URLs (HEAD/GET probe).
 */
function guessedOutputUrls(rawId: string): string[] {
  const id = rawId.split("?")[0];
  const bare = id; // keep task_ / video_ prefix — CDN uses full id in path
  // Also try without query-only; and litellm-decoded inner id if present
  const ids = new Set<string>([bare]);
  const resolved = resolveVideoId(bare);
  if (resolved !== bare) ids.add(resolved);

  const urls: string[] = [];
  for (const i of ids) {
    urls.push(`https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/${i}.mp4`);
    // Some older jobs used bare id without model folder
    urls.push(`https://platform-outputs.agnes-ai.space/videos/${i}.mp4`);
  }
  return urls;
}

async function probeUrlExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    if (head.ok) {
      const len = Number(head.headers.get("content-length") || "0");
      const ct = head.headers.get("content-type") || "";
      if (len > 1000 || ct.includes("video") || ct.includes("octet-stream") || ct.includes("mp4")) {
        return true;
      }
      // Some CDNs reject HEAD — fall through to range GET
    }
    // Range request for first byte
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(15000),
    });
    if (get.ok || get.status === 206) {
      const buf = Buffer.from(await get.arrayBuffer());
      return buf.length > 100;
    }
  } catch (e: any) {
    console.warn(`[Video Guess] probe fail ${url}:`, e?.message || e);
  }
  return false;
}

async function tryGuessCompletedVideoUrl(rawId: string): Promise<string | null> {
  for (const url of guessedOutputUrls(rawId)) {
    console.log(`[Video Guess] probing ${url}`);
    if (await probeUrlExists(url)) {
      console.log(`[Video Guess] hit ${url}`);
      return url;
    }
  }
  return null;
}

/**
 * When JSON status says completed but no URL, try OpenAI-style content download
 * and host the file under /uploads so the browser can play it.
 */
async function tryDownloadVideoContent(rawId: string, apiKey: string): Promise<string | null> {
  // 1) CDN path guess from historical successful jobs
  const guessed = await tryGuessCompletedVideoUrl(rawId);
  if (guessed) return guessed;

  const candidates = [
    `https://apihub.agnes-ai.com/v1/videos/${encodeURIComponent(rawId)}/content`,
    `https://apihub.agnes-ai.com/v1/videos/${encodeURIComponent(rawId)}/content?variant=video`,
  ];

  for (const targetUrl of candidates) {
    try {
      console.log(`[Video Content] GET ${targetUrl}`);
      const response = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) {
        console.warn(`[Video Content] ${response.status} ${targetUrl}`);
        continue;
      }
      const contentType = response.headers.get("content-type") || "";
      // If JSON, maybe it embeds a URL
      if (contentType.includes("json")) {
        const data = await response.json();
        const url = extractVideoUrl(data);
        if (url) return url;
        continue;
      }
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length < 1000) {
        console.warn(`[Video Content] tiny body ${buf.length} bytes from ${targetUrl}`);
        continue;
      }
      // Heuristic: MP4 often starts with ftyp within first bytes
      const head = buf.slice(0, 12).toString("ascii");
      const looksVideo =
        contentType.includes("video") ||
        contentType.includes("octet-stream") ||
        head.includes("ftyp") ||
        buf[0] === 0x00;

      if (!looksVideo) {
        console.warn(`[Video Content] unexpected content-type ${contentType}`);
        // still save if reasonably large
      }

      const filename = `agnes_${Date.now()}_${rawId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}.mp4`;
      const filepath = path.join(UPLOADS_DIR, filename);
      await fs.promises.writeFile(filepath, buf);
      const localUrl = `/uploads/${filename}`;
      console.log(`[Video Content] saved ${buf.length} bytes → ${localUrl}`);

      // Also copy to session output
      try {
        if (currentSessionDir) {
          fs.copyFileSync(filepath, path.join(currentSessionDir, filename));
        }
      } catch {}

      return localUrl;
    } catch (e: any) {
      console.warn(`[Video Content] error:`, e?.message || e);
    }
  }
  return null;
}

async function pollAgnesVideoStatus(
  videoId: string,
  apiKey: string,
  ws: WebSocket,
  taskId: string
): Promise<void> {
  // ~20–25 min total: video gen often takes 2–8+ min under load
  const delays = [3000, 5000, 8000, 10000, 15000, 20000, 30000];
  const maxAttempts = 60;
  let lastLogTime = 0;
  let activeId = videoId;
  const startedAt = Date.now();

  const sendProgress = (message: string, status: string, progress?: number) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "progress",
        taskId,
        step: "video",
        status,
        message,
        progress: progress ?? 0,
      })
    );
  };

  sendProgress(`📡 Polling ${activeId} (agnesapi + legacy)...`, "queued", 0);
  let missingUrlRetries = 0;

  const finishWithUrl = async (videoUrl: string) => {
    try {
      if (currentSessionDir && videoUrl.startsWith("http")) {
        const filename = `video_${Date.now()}.mp4`;
        const filepath = path.join(currentSessionDir, filename);
        downloadFile(videoUrl, filepath).catch(() => {});
      }
    } catch {}
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "done", taskId, url: videoUrl, videoId: activeId }));
    }
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`[Video Poll] WS closed for ${taskId}, stopping`);
      return;
    }

    if (attempt > 0) {
      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
    }

    if (ws.readyState !== WebSocket.OPEN) return;

    try {
      const rawData = await fetchVideoStatus(activeId, apiKey);
      if (!rawData) {
        if (Date.now() - lastLogTime > 20000) {
          sendProgress("⏳ Waiting for Agnes status (no response yet)...", "pending");
          lastLogTime = Date.now();
        }
        continue;
      }

      // Upgrade to a distinct video_ id when API returns one
      if (
        rawData.video_id &&
        typeof rawData.video_id === "string" &&
        rawData.video_id.startsWith("video_") &&
        activeId !== rawData.video_id
      ) {
        console.log(`[Video Poll] upgrading poll id ${activeId} → ${rawData.video_id}`);
        activeId = rawData.video_id;
        sendProgress(`🔄 Resolved video_id: ${activeId}`, rawData.status || "in_progress", rawData.progress);
      }

      const status = String(rawData.status || rawData.state || "unknown").toLowerCase();
      const progress = typeof rawData.progress === "number" ? rawData.progress : 0;
      let videoUrl = extractVideoUrl(rawData);
      const elapsedMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const via = rawData.__poll_via ? ` via ${String(rawData.__poll_via).replace("https://apihub.agnes-ai.com", "")}` : "";

      const statusMessages: Record<string, string> = {
        not_start: "⏳ Queued, waiting to start...",
        queued: "⏳ In queue...",
        pending: "⏳ Pending...",
        processing: "⚙️ Generating video...",
        running: "⚙️ Generating video...",
        in_progress: "⚙️ Generating video (in_progress)...",
        completed: "✅ Generation complete!",
        success: "✅ Generation complete!",
        succeeded: "✅ Generation complete!",
        done: "✅ Generation complete!",
        failed: "❌ Generation failed",
      };

      const progressMsg = statusMessages[status] || `📡 Status: ${status}`;
      const now = Date.now();

      if (
        now - lastLogTime > 12000 ||
        attempt === 0 ||
        isTerminalSuccess(status) ||
        isTerminalFailure(status)
      ) {
        const pct = progress > 0 ? ` ${progress}%` : "";
        sendProgress(`${progressMsg}${pct} (~${elapsedMin}min)${via}`, status, progress);
        lastLogTime = now;
        console.log(
          `[Video Poll] ${activeId} status=${status} progress=${progress} hasUrl=${!!videoUrl}${via}`
        );
      }

      if (isTerminalSuccess(status) || (progress >= 100 && !isTerminalFailure(status))) {
        if (videoUrl) {
          await finishWithUrl(videoUrl);
          return;
        }

        // Log raw keys to diagnose missing URL shape
        const keys = Object.keys(rawData).filter((k) => !k.startsWith("__"));
        console.warn(
          `[Video Poll] completed without URL. keys=[${keys.join(",")}] sample=${JSON.stringify(rawData).slice(0, 800)}`
        );
        sendProgress(
          `⚠️ Completed 100% but no URL in JSON — trying content download / other endpoints...`,
          "completed",
          99
        );

        // Aggressive second pass: re-fetch all endpoints for URL only
        const again = await fetchVideoStatus(activeId, apiKey);
        videoUrl = again ? extractVideoUrl(again) : undefined;
        if (videoUrl) {
          await finishWithUrl(videoUrl);
          return;
        }

        // OpenAI-style binary content download → host under /uploads
        missingUrlRetries++;
        if (missingUrlRetries <= 4) {
          const local = await tryDownloadVideoContent(activeId, apiKey);
          if (local) {
            await finishWithUrl(local);
            return;
          }
          // Brief wait then continue loop — URL sometimes appears late on CDN
          sendProgress(
            `⚠️ Still no URL (retry ${missingUrlRetries}/4). Waiting for CDN / content endpoint...`,
            "completed",
            99
          );
          continue;
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "error",
              taskId,
              message: `Video status is completed but Agnes returned no playable URL. id=${activeId}. Response keys: ${keys.join(", ")}. Try again or check Agnes console.`,
            })
          );
        }
        return;
      }

      if (isTerminalFailure(status)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "error",
              taskId,
              message: extractErrorMessage(rawData),
            })
          );
        }
        return;
      }
    } catch (err: any) {
      console.warn("[Video Poll] loop error:", err?.message || err);
      if (err.name === "TimeoutError" || err.name === "AbortError") continue;
    }
  }

  // Final desperate attempt before timeout
  try {
    const finalData = await fetchVideoStatus(activeId, apiKey);
    const finalUrl = finalData ? extractVideoUrl(finalData) : undefined;
    if (finalUrl) {
      await finishWithUrl(finalUrl);
      return;
    }
    const local = await tryDownloadVideoContent(activeId, apiKey);
    if (local) {
      await finishWithUrl(local);
      return;
    }
  } catch {}

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "error",
        taskId,
        message: `Polling timeout after ~${Math.round((Date.now() - startedAt) / 60000)}min. Task may still complete — check id: ${activeId}`,
      })
    );
  }
}

// ==========================================
// 4.6 AD PRODUCT API
// ==========================================

// Fallback logo prompts so image generation can always proceed even if chat JSON fails
function buildFallbackLogoPrompts(product: any, count: number): string[] {
  const name = product?.name || "Brand";
  const desc = product?.description || "product brand";
  const style = product?.style || "modern";
  const styles = [
    `minimalist clean modern professional logo for "${name}", ${desc}, simple geometric icon, flat design, monochrome or two-tone, vector-style, white background, sharp, 4k`,
    `vibrant bold energetic logo for "${name}", ${desc}, dynamic shapes, bright color palette, eye-catching, contemporary branding, vector-style, clean background, sharp, 4k`,
    `premium luxury elegant logo for "${name}", ${desc}, sophisticated typography, gold/black accents, high-end brand identity, refined icon, vector-style, clean background, sharp, 4k`,
    `playful creative colorful logo for "${name}", ${desc}, friendly rounded shapes, approachable brand mark, fun palette, vector-style, white background, sharp, 4k`,
    `corporate professional trustworthy logo for "${name}", ${desc}, established brand look, balanced layout, blue/gray palette, vector-style, clean background, sharp, 4k`,
    `natural organic earthy logo for "${name}", ${desc}, sustainable aesthetic, soft greens and browns, handcrafted feel, vector-style, clean background, sharp, 4k`,
    `futuristic tech innovative logo for "${name}", ${desc}, neon accents, geometric precision, digital brand identity, vector-style, dark or white background, sharp, 4k`,
    `vintage retro classic logo for "${name}", ${desc}, nostalgic badge style, timeless typography, muted palette, vector-style, clean background, sharp, 4k`,
    `artistic expressive unique logo for "${name}", ${desc}, memorable custom mark, creative composition, distinctive brand, vector-style, clean background, sharp, 4k`,
  ];
  // lightly inject product style preference into first prompts
  return styles.slice(0, count).map((p, i) =>
    i === 0 ? `${p}, brand style: ${style}` : p
  );
}

function normalizeLogoVariants(raw: any, product: any, count: number): string[] {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw?.variants)) list = raw.variants;
  else if (typeof raw?.variants === "string") list = [raw.variants];

  const normalized = list
    .map((v) => {
      if (typeof v === "string") return v.trim();
      if (v && typeof v === "object") {
        const p = v.prompt || v.text || v.description || v.content;
        if (typeof p === "string") return p.trim();
      }
      return "";
    })
    .filter((s) => s.length > 8);

  if (normalized.length >= count) return normalized.slice(0, count);
  const fallback = buildFallbackLogoPrompts(product, count);
  return [...normalized, ...fallback].slice(0, count);
}

function extractJsonObject(text: string): any | null {
  if (!text) return null;
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonStr = fence[1].trim();
  // Try direct parse
  try {
    return JSON.parse(jsonStr);
  } catch {}
  // Try first {...} block
  const brace = jsonStr.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      return JSON.parse(brace[0]);
    } catch {}
  }
  // Try array of strings
  const arr = jsonStr.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      const parsed = JSON.parse(arr[0]);
      if (Array.isArray(parsed)) return { variants: parsed };
    } catch {}
  }
  return null;
}

// Generate logo design prompts
app.post("/api/logo/generate", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const { product, variantCount = 3 } = req.body;
  if (!product || !product.name) {
    return res.status(400).json({ error: "Missing product info" });
  }

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");
  if (isDemo) {
    return res.status(400).json({ error: "Demo key detected. Please enter a real Agnes API key." });
  }

  const count = Math.min(Math.max(Number(variantCount) || 3, 1), 9);
  const fallback = buildFallbackLogoPrompts(product, count);

  const systemPrompt = `You are a professional brand identity designer. Generate ${count} different logo design prompts for a product.

Product: ${product.name}
Description: ${product.description}
Category: ${product.category}
Brand Style: ${product.style}
Target Platform: ${product.targetPlatform}

Generate ${count} prompts, each with a DIFFERENT style approach.
Each prompt must be a detailed English image generation prompt for creating a logo.

CRITICAL: Reply with ONLY valid JSON, no markdown, no commentary:
{"prompt":"overview","variants":["prompt1","prompt2","prompt3"]}`;

  try {
    const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        model: "agnes-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate ${count} logo design prompts for: ${product.name} - ${product.description || ""}` },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[logo/generate] chat API ${response.status}, using fallback prompts. ${errText.slice(0, 200)}`);
      // Never block the pipeline — image gen can still run on fallbacks
      return res.json({
        prompt: `Logo concepts for ${product.name}`,
        variants: fallback,
        fallback: true,
        warning: `Chat API ${response.status}; used template prompts`,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log(`[logo/generate] raw content length=${content.length}`);

    const parsed = extractJsonObject(content);
    const variants = normalizeLogoVariants(parsed ?? content, product, count);

    return res.json({
      prompt: parsed?.prompt || `Logo concepts for ${product.name}`,
      variants,
      fallback: !parsed || variants === fallback,
    });
  } catch (error: any) {
    console.error("[logo/generate] error, using fallback:", error?.message || error);
    return res.json({
      prompt: `Logo concepts for ${product.name}`,
      variants: fallback,
      fallback: true,
      warning: error?.message || "chat failed",
    });
  }
});

// Generate product marketing image prompts
function buildFallbackMarketingPrompts(product: any, textDesc?: string): string[] {
  const name = product?.name || "Product";
  const desc = textDesc || product?.description || "premium product";
  const style = product?.style || "modern";
  return [
    `professional e-commerce product photo of ${name}, ${desc}, centered product on clean white seamless background, soft studio softbox lighting, sharp focus, commercial catalog style, ${style} brand aesthetic, 4k, high detail, no text watermark`,
    `lifestyle social media marketing photo featuring ${name}, ${desc}, natural everyday scene, trendy aesthetic, soft daylight, shallow depth of field, Douyin/Xiaohongshu style composition, ${style} mood, photorealistic, 4k`,
    `cinematic brand poster for ${name}, ${desc}, dramatic lighting, premium composition, bold negative space for headline, high-end advertising look, ${style} color grade, ultra detailed, 4k commercial photography`,
  ];
}

app.post("/api/product-image/generate", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const { product, imageUrl, textDesc } = req.body;
  if (!product || !product.name) {
    return res.status(400).json({ error: "Missing product info" });
  }

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");
  if (isDemo) {
    return res.status(400).json({ error: "Demo key detected. Please enter a real Agnes API key." });
  }

  const fallback = buildFallbackMarketingPrompts(product, textDesc);
  // Never put huge base64 into the chat prompt — just note that a reference image exists
  const hasRef =
    typeof imageUrl === "string" &&
    (imageUrl.startsWith("http") || imageUrl.startsWith("data:image"));
  const inputDesc = hasRef
    ? "User provided a product reference image (img2img will use it later). Keep product appearance exact."
    : `Product description: ${textDesc || product.description || ""}`;

  const systemPrompt = `You are a professional marketing visual designer. Generate 3 different marketing image prompts for a product.

Product: ${product.name}
Description: ${product.description || ""}
Category: ${product.category || ""}
Brand Style: ${product.style || ""}
Target Platform: ${product.targetPlatform || "general"}
Input: ${inputDesc}

Generate 3 prompts for DIFFERENT scenes:
1. E-commerce main image
2. Social media lifestyle
3. Brand poster

CRITICAL: Reply with ONLY valid JSON, no markdown:
{"prompt":"overview","variants":["ecommerce prompt","social prompt","poster prompt"]}`;

  try {
    const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        model: "agnes-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 3 marketing image prompts for: ${product.name}` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[product-image/generate] chat ${response.status}, using fallback. ${errText.slice(0, 200)}`);
      return res.json({
        prompt: `Marketing images for ${product.name}`,
        variants: fallback,
        fallback: true,
        warning: `Chat API ${response.status}`,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(content);
    // Normalize strings only (do not pad with logo-style fallbacks)
    let list: any[] = [];
    if (Array.isArray(parsed?.variants)) list = parsed.variants;
    else if (Array.isArray(parsed)) list = parsed;
    const fromAi = list
      .map((v) => {
        if (typeof v === "string") return v.trim();
        if (v && typeof v === "object" && typeof v.prompt === "string") return v.prompt.trim();
        return "";
      })
      .filter((s) => s.length > 8);
    const finalVariants = [...fromAi, ...fallback].slice(0, 3);

    return res.json({
      prompt: parsed?.prompt || `Marketing images for ${product.name}`,
      variants: finalVariants,
      fallback: fromAi.length < 3,
    });
  } catch (error: any) {
    console.error("[product-image/generate] error:", error?.message || error);
    return res.json({
      prompt: `Marketing images for ${product.name}`,
      variants: fallback,
      fallback: true,
      warning: error?.message || "chat failed",
    });
  }
});

// Generate ad video prompt
app.post("/api/ad-video/generate-prompt", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const { product, imageUrl, adCopy, characterName, dialogue } = req.body;
  if (!product || !product.name) {
    return res.status(400).json({ error: "Missing product info" });
  }

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");
  if (isDemo) {
    return res.status(400).json({ error: "Demo key detected. Please enter a real Agnes API key." });
  }

  const characterSection = characterName ? `
Character: ${characterName}
${product.description ? `Character description: ${product.description}` : ''}
Dialogue: ${dialogue || 'No dialogue'}` : 'No character - product-only video';

  const systemPrompt = `You are a professional video advertising creative director specializing in product commercial videos. Generate a product ad video prompt.

Product: ${product.name}
Description: ${product.description}
Category: ${product.category}
Brand Style: ${product.style}
Ad Copy: ${adCopy}
${characterSection}

═══ CRITICAL VIDEO PROMPT RULES (from professional product video guide) ═══

HIGHEST PRIORITY - Product Integrity:
- Product MUST maintain 100% original appearance in ALL frames
- ABSOLUTELY FORBIDDEN: Any distortion, deformation, stretching, compression
- ABSOLUTELY FORBIDDEN: Product changing shape, structure, or packaging
- ABSOLUTELY FORBIDDEN: Impossible dynamics (e.g. solid product spraying liquid)
- ABSOLUTELY FORBIDDEN: Product behaving inconsistently with its physical properties
- MUST PRESERVE: Original appearance, color, material, shape exactly as in reference image
- Design principle: Enhance display through camera work, lighting, and scene — NOT by altering the product

═══ AD SCRIPT STRUCTURE (from professional script template) ═══

The video prompt must follow this 4-part structure:

1. OPENING (first 20% of duration):
   - Grab attention, establish brand/product concept
   - Create initial atmosphere
   - Product may not appear yet, focus on mood

2. SHOWCASE (next 35% of duration):
   - Multi-angle product display
   - Highlight core appearance features
   - Show usage场景

3. SELLING POINTS (next 30% of duration):
   - Deep dive into 1-3 core advantages
   - Connect features to user benefits
   - Solve user pain points

4. ENDING (last 15% of duration):
   - Reinforce brand memory
   - Clear call-to-action (CTA)
   - Brand logo / purchase guidance

Duration Allocation:
- 15s video: Opening 3s → Showcase 5s → Selling 5s → Ending 2s
- 30s video: Opening 6s → Showcase 10s → Selling 10s → Ending 4s

Writing Guidelines:
- Keep sentences short (under 15 words each)
- Use conversational tone, avoid jargon
- Create emotional connection with viewer
- Every second must carry visual information — no dead frames

Camera Movement (recommended, in priority order):
1. Push In (slow): Reveal product details from wide to close
2. Rotation: Show 360-degree view of the product
3. Pan (smooth): Lateral or vertical movement across scene
4. Orbit: Circle around product center for 3D feel
5. Static: Product completely still, most conservative option

Product Animation Rules:
- Product stays STATIC or has only minimal natural movement
- If clothing: allow gentle fabric sway in wind
- All other products: NO movement, only camera moves
- Character (if any): natural gestures, facial expressions, subtle movements

Scene & Lighting:
- Match scene to actual product usage environment
- Lighting enhances texture and material quality
- Background supports but never overpowers the product
- Color palette consistent with brand style

Style Keywords by Category:
- Digital/Tech: modern, sleek, minimalist, professional, futuristic
- Fashion: elegant, stylish, lifestyle, authentic, comfortable
- Food: appetizing, fresh, warm, natural, inviting
- Home: cozy, clean, organized, harmonious, peaceful
- Beauty: luminous, radiant, delicate, premium, sophisticated

Output a DETAILED prompt in English that follows the 4-part structure above. The prompt should describe the visual sequence with timing cues (e.g. "Opening 3s: ...", "Showcase 5s: ...").

Output format (JSON):
{
  "videoPrompt": "Detailed video prompt in English with 4-part structure and timing cues",
  "duration": 15
}`;

  try {
    const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        model: "agnes-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a 15-second video prompt for: ${product.name} - ${adCopy}` },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Agnes API error: ${errText}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return res.json(parsed);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse AI response as JSON", raw: content });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate ad video prompt" });
  }
});

// ==========================================
// ==========================================
// 4.6 VIDEO TRIM API
// ==========================================

app.post("/api/video/trim", async (req, res) => {
  const { videoUrl, startTime, endTime } = req.body;

  if (!videoUrl || startTime === undefined || endTime === undefined) {
    return res.status(400).json({ error: "Missing videoUrl, startTime, or endTime" });
  }

  try {
    // Download video
    const tempDir = path.join(UPLOADS_DIR, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
    const outputPath = path.join(UPLOADS_DIR, `trimmed_${Date.now()}.mp4`);

    await downloadFile(videoUrl, inputPath);

    // Use FFmpeg to trim
    const { execSync } = await import("child_process");
    const duration = endTime - startTime;
    const ffmpegCmd = `ffmpeg -i "${inputPath}" -ss ${startTime} -t ${duration} -c copy "${outputPath}" -y`;

    execSync(ffmpegCmd, { stdio: "pipe" });

    // Clean up temp file
    fs.unlinkSync(inputPath);

    // Return trimmed video URL
    const trimmedFilename = path.basename(outputPath);
    const trimmedUrl = `/uploads/${trimmedFilename}`;

    return res.json({ trimmedUrl, duration });
  } catch (error: any) {
    console.error("Video trim error:", error);
    return res.status(500).json({ error: error.message || "Failed to trim video" });
  }
});

// ==========================================
// VIDEO LAST-FRAME — chain continuity
// Extract final frame so next video segment can use it as reference image
// ==========================================
app.post("/api/video/last-frame", async (req, res) => {
  const { videoUrl } = req.body;
  if (!videoUrl || typeof videoUrl !== "string") {
    return res.status(400).json({ error: "Missing videoUrl" });
  }

  const tempDir = path.join(UPLOADS_DIR, "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const ts = Date.now();
  const inputPath = path.join(tempDir, `chain_in_${ts}.mp4`);
  const framePath = path.join(UPLOADS_DIR, `lastframe_${ts}.jpg`);

  try {
    // Resolve local vs remote video sources
    let resolvedInput: string;
    const bareUrl = videoUrl.split("?")[0];

    // Resolve full localhost/LAN URLs to local file paths
    let localBare = bareUrl;
    try {
      const u = new URL(bareUrl);
      const isLocalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1" || /^192\.168\./.test(u.hostname);
      if (isLocalHost && (u.pathname.startsWith("/uploads/") || u.pathname.startsWith("/outputs/"))) {
        localBare = u.pathname;
      }
    } catch {}

    if (localBare.startsWith("/uploads/") || localBare.startsWith("/outputs/")) {
      const localPath = path.join(process.cwd(), localBare.replace(/^\//, ""));
      if (!fs.existsSync(localPath)) {
        return res.status(404).json({ error: `Local video not found: ${localBare}` });
      }
      resolvedInput = localPath;
    } else if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
      // Keep query string — some CDNs require signed/cache-bust params
      await downloadFile(videoUrl, inputPath);
      if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
        throw new Error("Downloaded video file is empty");
      }
      resolvedInput = inputPath;
    } else {
      return res.status(400).json({ error: "videoUrl must be http(s) or /uploads|/outputs path" });
    }

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    // Seek near end (-sseof -0.05) and grab one frame
    try {
      await execFileAsync(
        "ffmpeg",
        ["-hide_banner", "-loglevel", "error", "-sseof", "-0.05", "-i", resolvedInput, "-frames:v", "1", "-q:v", "2", framePath, "-y"],
        { timeout: 60000 }
      );
    } catch (firstErr: any) {
      // Fallback: last keyframe approach via duration seek
      console.warn("[last-frame] -sseof failed, trying -ss near end:", firstErr?.message || firstErr);
      await execFileAsync(
        "ffmpeg",
        ["-hide_banner", "-loglevel", "error", "-sseof", "-1", "-i", resolvedInput, "-update", "1", "-q:v", "2", framePath, "-y"],
        { timeout: 60000 }
      );
    }

    if (!fs.existsSync(framePath) || fs.statSync(framePath).size === 0) {
      throw new Error("ffmpeg produced empty frame file");
    }

    const localUrl = `/uploads/${path.basename(framePath)}`;
    const frameBuffer = fs.readFileSync(framePath);
    const base64 = `data:image/jpeg;base64,${frameBuffer.toString("base64")}`;

    // Try to get a public URL (Agnes image-to-video needs reachable image URLs)
    let publicUrl: string | undefined;
    try {
      const formData = new FormData();
      formData.append("source", new Blob([frameBuffer], { type: "image/jpeg" }), `lastframe_${ts}.jpg`);
      formData.append("type", "file");
      formData.append("action", "upload");
      formData.append("key", "6d207e02198a847aa98d0a2a901485a5");

      const uploadResp = await fetch("https://freeimage.host/api/1/upload", {
        method: "POST",
        body: formData,
      });
      if (uploadResp.ok) {
        const uploadData: any = await uploadResp.json();
        publicUrl = uploadData.image?.url || uploadData.image?.display_url;
      } else {
        console.warn("[last-frame] freeimage upload failed:", await uploadResp.text());
      }
    } catch (uploadErr: any) {
      console.warn("[last-frame] public upload error:", uploadErr?.message || uploadErr);
    }

    // Prefer public URL for frameUrl (used as next-segment reference)
    const frameUrl = publicUrl || localUrl;

    // Also save into session output folder if active
    try {
      if (currentSessionDir) {
        const sessionFrame = path.join(currentSessionDir, `lastframe_${ts}.jpg`);
        fs.copyFileSync(framePath, sessionFrame);
      }
    } catch {}

    // Cleanup downloaded temp video
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}

    console.log(`[last-frame] extracted ${frameUrl}${publicUrl ? " (public)" : " (local only)"}`);
    return res.json({ frameUrl, publicUrl, localUrl, base64 });
  } catch (error: any) {
    console.error("Last-frame extraction error:", error);
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    return res.status(500).json({ error: error.message || "Failed to extract last frame" });
  }
});

// ==========================================
// 4.8 TASK REGISTRY — persistent task tracking
// ==========================================
const TASKS_FILE = path.join(process.cwd(), "data", "tasks.json");

interface TaskRecord {
  id: string;               // task_id from Agnes API
  type: "video" | "image";  // task type
  prompt: string;
  imageUrl?: string;        // reference image for video
  videoUrl?: string;        // completed video URL
  status: string;           // queued, processing, completed, failed
  createdAt: number;        // timestamp
  updatedAt: number;
  error?: string;
  extra?: Record<string, any>;
}

function loadTasks(): TaskRecord[] {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveTasks(tasks: TaskRecord[]) {
  const dir = path.dirname(TASKS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

// Save or update a task
app.post("/api/tasks", (req, res) => {
  const { id, type, prompt, imageUrl, videoUrl, status, error, extra } = req.body;
  if (!id) return res.status(400).json({ error: "Missing task id" });

  const tasks = loadTasks();
  const now = Date.now();
  const existing = tasks.find((t) => t.id === id);

  if (existing) {
    existing.status = status || existing.status;
    existing.videoUrl = videoUrl || existing.videoUrl;
    existing.error = error || existing.error;
    existing.updatedAt = now;
  } else {
    tasks.unshift({
      id,
      type: type || "video",
      prompt: prompt || "",
      imageUrl,
      videoUrl,
      status: status || "queued",
      createdAt: now,
      updatedAt: now,
      error,
      extra,
    });
  }

  // Keep last 100 tasks
  saveTasks(tasks.slice(0, 100));
  res.json({ ok: true, count: tasks.length });
});

// List all tasks
app.get("/api/tasks", (_req, res) => {
  res.json(loadTasks());
});

// Query live status from Agnes API and update registry
app.get("/api/tasks/:id/status", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

  // Skip pending tasks — they haven't been submitted to Agnes yet
  if (id.startsWith("pending_")) {
    return res.json({ status: "submitting", videoUrl: null });
  }

  try {
    // CRITICAL: Use /agnesapi?video_id= for polling (NOT /v1/video/generations/{task_id})
    const response = await fetch(`https://apihub.agnes-ai.com/agnesapi?video_id=${id}`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();
    if (!response.ok) {
      const isExpired = text.includes("task_not_exist") || text.includes("task not found");
      if (isExpired) {
        const tasks = loadTasks();
        const task = tasks.find((t) => t.id === id);
        if (task) {
          task.status = "expired";
          task.updatedAt = Date.now();
          saveTasks(tasks);
        }
        return res.json({ status: "expired", videoUrl: null });
      }
      return res.status(response.status).json({ error: `Agnes API: ${response.status} — ${text}` });
    }

    const data = JSON.parse(text);
    // /agnesapi response: { status, progress, video_url, remixed_from_video_id, error }
    const status = data.status?.toLowerCase() || "unknown";
    const progress = data.progress ?? 0;
    const videoUrl = data.remixed_from_video_id || data.video_url || data.url
                  || data.urls?.[0];

    // Update registry
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.status = status;
      task.extra = { ...task.extra, progress };
      if (videoUrl) task.videoUrl = videoUrl;
      task.updatedAt = Date.now();
      saveTasks(tasks);
    }

    res.json({ status, progress, videoUrl, raw: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to query status" });
  }
});

// Delete a task from registry
app.delete("/api/tasks/:id", (req, res) => {
  const tasks = loadTasks().filter((t) => t.id !== req.params.id);
  saveTasks(tasks);
  res.json({ ok: true, count: tasks.length });
});

// ==========================================
// 4.7 API KEY SYNC — share key between web UI and CLI
// ==========================================
const MFILM_CONFIG = path.join(os.homedir(), ".mfilm", "config.json");

// GET API key — CLI calls this to auto-sync the key from server config
app.get("/api/get-api-key", (_req, res) => {
  try {
    if (fs.existsSync(MFILM_CONFIG)) {
      const config = JSON.parse(fs.readFileSync(MFILM_CONFIG, "utf-8"));
      if (config.api_key && !config.api_key.includes("••••") && !config.api_key.toLowerCase().includes("demo")) {
        return res.json({ api_key: config.api_key });
      }
    }
  } catch {}
  res.json({ api_key: null });
});

app.post("/api/sync-cli-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: "Missing apiKey" });

  try {
    const dir = path.dirname(MFILM_CONFIG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let config: Record<string, string> = {};
    if (fs.existsSync(MFILM_CONFIG)) {
      config = JSON.parse(fs.readFileSync(MFILM_CONFIG, "utf-8"));
    }
    config.api_key = apiKey;
    fs.writeFileSync(MFILM_CONFIG, JSON.stringify(config, null, 2));
    res.json({ ok: true, message: "CLI config updated" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sync-cli-tasks", (req, res) => {
  const tasksDir = path.join(os.homedir(), ".mfilm", "tasks");
  if (!fs.existsSync(tasksDir)) return res.json({ tasks: [] });

  try {
    const files = fs.readdirSync(tasksDir).filter(f => f.endsWith(".json"));
    const tasks = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(tasksDir, f), "utf-8"));
      return data;
    });
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. VITE MIDDLEWARE & STATIC SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const taskId = url.searchParams.get("taskId") || url.pathname.split("/").pop() || "";

    if (!taskId) {
      ws.close(1008, "Missing taskId");
      return;
    }

    if (!videoProgressClients.has(taskId)) {
      videoProgressClients.set(taskId, new Set());
    }
    videoProgressClients.get(taskId)!.add(ws);

    ws.on("close", () => {
      const clients = videoProgressClients.get(taskId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) videoProgressClients.delete(taskId);
      }
    });

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "subscribe" && data.videoId && data.apiKey) {
          ws.send(JSON.stringify({ type: "subscribed", taskId, videoId: data.videoId }));
          pollAgnesVideoStatus(data.videoId, data.apiKey, ws, taskId);
        }
      } catch {}
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
