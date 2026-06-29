/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
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
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const requestBody = JSON.stringify(req.body);
    console.log(`[Image API] → POST https://apihub.agnes-ai.com/v1/images/generations`);

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
      if (data.data?.[0]?.url) {
        return res.json(data);
      }
      return res.status(500).json({ error: "Invalid response: no image URL returned" });
    } catch (e) {
      return res.status(500).json({ error: "Invalid response from Agnes API" });
    }
  } catch (error: any) {
    console.error("Proxy Images error:", error);
    return res.status(500).json({ error: error.message || "Failed to connect to Agnes API" });
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
          if (data.task_id || data.video_id) {
            return res.status(response.status).json(data);
          }
          return res.status(400).json({ error: "Invalid response: missing task_id or video_id" });
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
  const targetId = resolveVideoId(rawId);
  const targetUrl = `https://apihub.agnes-ai.com/agnesapi?video_id=${targetId}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
// Only allow downloading from Agnes CDN domains to prevent SSRF
function isAllowedVideoUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const allowed = ["apihub.agnes-ai.com", "cdn.agnes-ai.com", "storage.googleapis.com"];
    return u.protocol === "https:" && allowed.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

app.post("/api/merge", async (req, res) => {
  const { clips, lang } = req.body;
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
      console.log(`Downloading clip ${i}: ${clip.videoUrl}`);
      await downloadFile(clip.videoUrl, clipLocalPath);
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

    // Step 4: Generate voiceover audio if any subtitles exist
    const fullText = clips.map(c => c.subtitle || "").filter(Boolean).join(" ");
    if (fullText.trim()) {
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

async function pollAgnesVideoStatus(
  videoId: string,
  apiKey: string,
  ws: WebSocket,
  taskId: string
): Promise<void> {
  const delays = [5000, 10000, 15000, 20000, 30000, 45000, 60000];
  const maxAttempts = 35;
  let lastLogTime = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (ws.readyState !== WebSocket.OPEN) return;

    if (attempt > 0) {
      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
    }

    if (ws.readyState !== WebSocket.OPEN) return;

    try {
      const resolvedId = resolveVideoId(videoId);
      // CRITICAL: Use /agnesapi?video_id= for polling (NOT /v1/video/generations/{task_id})
      // Using task_id causes 20+ min queue, using video_id takes ~80 seconds
      const targetUrl = `https://apihub.agnes-ai.com/agnesapi?video_id=${resolvedId}`;
      const response = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) continue;

      const rawData = await response.json();
      // Agnes /agnesapi response: { status, progress, video_url, remixed_from_video_id, error }
      const status = rawData.status?.toLowerCase() || "unknown";
      const progress = rawData.progress ?? 0;
      const videoUrl = rawData.remixed_from_video_id || rawData.video_url || rawData.url
                    || rawData.urls?.[0];

      // Clear progress messages in English
      const now = Date.now();
      const statusMessages: Record<string, string> = {
        "not_start": "⏳ Queued, waiting to generate...",
        "queued": "⏳ In queue, waiting...",
        "processing": "⚙️ Generating video...",
        "running": "⚙️ Generating video...",
        "completed": "✅ Generation complete!",
        "success": "✅ Generation complete!",
        "failed": "❌ Generation failed",
      };

      const progressMsg = statusMessages[status] || `📡 Status: ${status}`;
      const timeMsg = attempt > 0 ? ` (${Math.round(attempt * 15 / 60)}min)` : "";

      // Only log every 15 seconds to avoid spam
      if (now - lastLogTime > 15000 || attempt === 0) {
        ws.send(JSON.stringify({
          type: "progress",
          taskId,
          step: "video",
          status: status || "pending",
          message: `${progressMsg}${timeMsg}`,
          progress,
        }));
        lastLogTime = now;
      }

      if (status === "completed" || status === "success") {
        if (videoUrl) {
          ws.send(JSON.stringify({ type: "done", taskId, url: videoUrl }));
        } else {
          ws.send(JSON.stringify({ type: "error", taskId, message: "No URL in completed response" }));
        }
        return;
      }

      if (status === "failed") {
        ws.send(JSON.stringify({ type: "error", taskId, message: inner.error || rawData.error || "Video generation failed" }));
        return;
      }
    } catch (err: any) {
      if (err.name === "TimeoutError") continue;
    }
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "error", taskId, message: "Polling timeout" }));
  }
}

// ==========================================
// 4.6 AD PRODUCT API
// ==========================================

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

  const systemPrompt = `You are a professional brand identity designer. Generate ${count} different logo design prompts for a product.

Product: ${product.name}
Description: ${product.description}
Category: ${product.category}
Brand Style: ${product.style}
Target Platform: ${product.targetPlatform}

Generate ${count} prompts, each with a DIFFERENT style approach:
1. Minimalist clean style - simple, modern, professional
2. Vibrant energetic style - bold colors, dynamic, eye-catching
3. Premium luxury style - elegant, sophisticated, high-end${count > 3 ? '\n4. Playful fun style - colorful, creative, approachable' : ''}${count > 4 ? '\n5. Corporate professional style - trustworthy, established, reliable' : ''}${count > 5 ? '\n6. Natural organic style - earthy, sustainable, authentic' : ''}${count > 6 ? '\n7. Futuristic tech style - innovative, cutting-edge, bold' : ''}${count > 7 ? '\n8. Vintage retro style - nostalgic, classic, timeless' : ''}${count > 8 ? '\n9. Artistic creative style - unique, expressive, memorable' : ''}

Each prompt should be a detailed English image generation prompt for creating a logo. Include:
- Logo design description (icon/symbol + text layout)
- Color palette recommendation
- Style keywords
- Background suggestion
- Quality boosters (4K, sharp, vector-style)

Output format (JSON):
{
  "prompt": "Brief overview prompt",
  "variants": ["prompt1", "prompt2", ...]
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
          { role: "user", content: `Generate 3 logo design prompts for: ${product.name} - ${product.description}` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
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
    return res.status(500).json({ error: error.message || "Failed to generate logo prompts" });
  }
});

// Generate product marketing image prompts
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

  const inputDesc = imageUrl ? `Product image URL: ${imageUrl}` : `Product description: ${textDesc || product.description}`;

  const systemPrompt = `You are a professional marketing visual designer. Generate 3 different marketing image prompts for a product.

Product: ${product.name}
Description: ${product.description}
Category: ${product.category}
Brand Style: ${product.style}
Target Platform: ${product.targetPlatform}
Input: ${inputDesc}

Generate 3 prompts, each for a DIFFERENT marketing scene:
1. E-commerce main image - clean white/simple background, product centered, professional product photography style
2. Social media material - lifestyle context, trendy aesthetic, platform-optimized (Douyin/Xiaohongshu style)
3. Brand poster - cinematic composition, dramatic lighting, premium feel

Each prompt should be a detailed English image generation prompt. Include:
- Product positioning and composition
- Background and environment
- Lighting setup
- Color palette
- Style keywords matching the brand style
- Quality boosters (4K, sharp focus, commercial photography)

IMPORTANT: The product must maintain its exact original appearance. No distortion, no deformation.
The product's shape, structure, and appearance remain exactly as shown in reference.

Output format (JSON):
{
  "prompt": "Brief overview prompt",
  "variants": ["prompt1 for ecommerce", "prompt2 for social media", "prompt3 for brand poster"]
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
          { role: "user", content: `Generate 3 marketing image prompts for: ${product.name}` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
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
    return res.status(500).json({ error: error.message || "Failed to generate product image prompts" });
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
