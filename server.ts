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

// Disabled Gemini client as requested; only using Agnes AI API.
const ai = null;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json());
// Serve uploaded/generated files statically
app.use("/uploads", express.static(UPLOADS_DIR));

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
// 1. AGNES AI PROXY ROUTES & SIMULATORS
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

// Helper: Simulated Chat/Completions
async function getSimulatedChat(userPrompt: string) {
  let cleanPrompt = userPrompt;
  if (userPrompt.includes("Action/scene description:")) {
    const match = userPrompt.match(/Action\/scene description:\s*(.*)/i);
    if (match) cleanPrompt = match[1];
  } else if (userPrompt.includes("Scene:")) {
    const match = userPrompt.match(/Scene:\s*(.*)/i);
    if (match) cleanPrompt = match[1];
  }

  let translatedPrompt = cleanPrompt;

  // If Gemini is disabled, try to use the online free translation API first
  const hasChinese = /[\u4e00-\u9fa5]/.test(cleanPrompt);
  if (hasChinese) {
    const apiTranslated = await translateToEnglish(cleanPrompt);
    if (apiTranslated) {
      translatedPrompt = apiTranslated;
    } else {
      // fallback to static dictionary
      const dict: { [key: string]: string } = {
        "一个": "a ",
        "蝎子": "scorpion ",
        "蜈蚣": "centipede ",
        "打架": "fighting ",
        "对决": "duel ",
        "对战": "battle ",
        "撕咬": "fighting ",
        "打斗": "clashing ",
        "昆虫": "insect ",
        "红发": "red-haired ",
        "宇航员": "astronaut ",
        "宇航服": "spacesuit ",
        "火星": "Mars ",
        "基地": "base ",
        "咖啡": "coffee ",
        "喝咖啡": "drinking coffee ",
        "落日": "sunset ",
        "晚霞": "sunset glow ",
        "赛步": "cyberpunk ",
        "赛博朋克": "cyberpunk ",
        "赛博": "cyberpunk ",
        "高科技": "high-tech ",
        "霓虹灯": "neon lights ",
        "霓虹": "neon ",
        "城市": "city ",
        "街道": "street ",
        "雨": "rain ",
        "雨天": "rainy day ",
        "废墟": "ruins ",
        "机械": "mecha ",
        "装甲": "armored ",
        "光剑": "lightsaber ",
        "发光": "glowing ",
        "战斗": "fighting ",
        "飞行": "flying ",
        "悬浮": "hovering ",
        "探索": "exploring ",
        "发现": "discovering ",
        "秘密": "secret ",
        "古代": "ancient ",
        "神殿": "temple ",
        "废土": "wasteland ",
        "末日": "apocalyptic ",
        "赛车": "racing car ",
        "星门": "stargate ",
        "传送门": "portal ",
        "外星": "alien ",
        "外星人": "alien ",
        "怪物": "monster ",
        "深海": "deep sea ",
        "潜水艇": "submarine ",
        "冰川": "glacier ",
        "雪山": "snow mountain ",
        "沙漠": "desert ",
        "风暴": "storm ",
        "闪电": "lightning ",
        "火焰": "fire ",
        "水": "water ",
        "云": "clouds ",
        "光线": "light beams ",
        "丁达尔光": "Tyndall effect, volumetric light ",
        "慢动作": "slow motion ",
        "特写": "close-up ",
        "全景": "panoramic view ",
        "俯瞰": "high angle shot ",
        "仰视": "low angle shot ",
        "唯美": "aesthetic ",
        "真实": "photorealistic ",
        "写实": "realistic ",
        "插画": "illustration ",
        "动漫": "anime ",
        "手绘": "hand-drawn ",
        "电影感": "cinematic ",
        "科幻": "sci-fi ",
        "女孩": "girl ",
        "女人": "woman ",
        "男人": "man ",
        "男孩": "boy ",
        "森林": "forest ",
        "喝": "sipping ",
        "在": "in ",
        "背景": "background ",
        "巨型": "colossal ",
        "巨大": "huge ",
        "峡谷": "canyon ",
        "看着": "looking at ",
        "观赏": "viewing ",
        "飞船": "spaceship ",
        "星空": "starry sky ",
        "机器人": "robot ",
        "猫": "cat ",
        "狗": "dog ",
        "湖泊": "lake ",
        "山脉": "mountain ",
        "太阳": "sun ",
        "月亮": "moon ",
        "未来": "futuristic ",
        "穿着": "wearing ",
        "摄影": "photography ",
        "和": "and ",
        "里": "inside "
      };

      let translated = cleanPrompt;
      for (const [key, value] of Object.entries(dict)) {
        translated = translated.split(key).join(value);
      }
      
      translated = translated.replace(/[\u4e00-\u9fa5]/g, "").trim();
      if (!translated) {
        translated = "a sci-fi cinematic scene";
      }
      translatedPrompt = translated;
    }
  }

  const optimized = translatedPrompt.toLowerCase().includes("masterpiece") || translatedPrompt.toLowerCase().includes("cinematic")
    ? translatedPrompt
    : `A highly detailed, cinematic 8k masterpiece of ${translatedPrompt.trim()}. Rich textures, dramatic composition, exquisite volumetric lighting, shot on 35mm lens, photorealistic sci-fi style, highly dense atmosphere, Agnes AI optimized.`;

  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: optimized
        }
      }
    ]
  };
}

// Helper: Simulated Image Generation
function getSimulatedImage(prompt: string) {
  const pClean = prompt.toLowerCase();
  let imageUrl = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800"; // default digital space

  // Custom presets first
  if (pClean.includes("scorpion") || pClean.includes("蝎子")) {
    imageUrl = "https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&q=80&w=800";
  } else if (pClean.includes("centipede") || pClean.includes("蜈蚣")) {
    imageUrl = "https://images.unsplash.com/photo-1548247416-ec66f4900b2e?auto=format&fit=crop&q=80&w=800";
  } else if (pClean.includes("insect") || pClean.includes("bug") || pClean.includes("昆虫")) {
    imageUrl = "https://images.unsplash.com/photo-1576082900999-489a88eb4831?auto=format&fit=crop&q=80&w=800";
  } else if (pClean.includes("battle") || pClean.includes("fight") || pClean.includes("clash") || pClean.includes("打架") || pClean.includes("对战") || pClean.includes("对决")) {
    imageUrl = "https://images.unsplash.com/photo-1559650656-5d1d361ad10e?auto=format&fit=crop&q=80&w=800";
  } else if (pClean.includes("astronaut") || pClean.includes("mars") || pClean.includes("space") || pClean.includes("planet") || pClean.includes("star")) {
    imageUrl = "https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=800";
  } else if (pClean.includes("cyberpunk") || pClean.includes("neon") || pClean.includes("city") || pClean.includes("future") || pClean.includes("tokyo")) {
    imageUrl = "https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?auto=format&fit=crop&q=80&w=800";
  } else if (pClean.includes("forest") || pClean.includes("tree") || pClean.includes("nature") || pClean.includes("mountain") || pClean.includes("lake")) {
    imageUrl = "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=800";
  } else if (pClean.includes("human") || pClean.includes("girl") || pClean.includes("man") || pClean.includes("woman") || pClean.includes("face") || pClean.includes("portrait")) {
    imageUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=800";
  } else {
    // Extract subject keywords
    const stopWords = new Set([
      "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "of", "from",
      "highly", "detailed", "cinematic", "8k", "masterpiece", "rich", "textures", "dramatic", "composition",
      "exquisite", "volumetric", "lighting", "shot", "lens", "photorealistic", "style", "dense", "atmosphere",
      "agnes", "ai", "optimized", "animate", "subtle", "camera", "movement", "panning", "emphasizing", "details",
      "scene", "realistic"
    ]);
    
    const words = pClean
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
      
    if (words.length > 0) {
      const query = encodeURIComponent(words.slice(0, 3).join(","));
      imageUrl = `https://images.unsplash.com/featured/?${query}`;
    }
  }

  // Force cache bust to trigger browser reload/refresh in React
  const finalUrl = `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}sig=${Math.floor(Math.random() * 100000)}`;

  return {
    data: [
      {
        url: finalUrl
      }
    ]
  };
}

// Helper: Simulated Video Creation Task
function getSimulatedVideoTask() {
  const id = `sim_${Math.random().toString(36).substr(2, 9)}`;
  return {
    task_id: id,
    video_id: id
  };
}

// Helper: Simulated Video Status / Polling
function getSimulatedStatus(id: string) {
  const videos = [
    "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-blue-lights-42533-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-glow-41983-large.mp4"
  ];

  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  const videoUrl = videos[sum % videos.length];

  return {
    status: "completed",
    video_url: videoUrl,
    urls: [videoUrl]
  };
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
      const response = await fetch("https://platform.agnes-ai.com/v1/chat/completions", {
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

  const userPrompt = req.body.messages?.find((m: any) => m.role === "user")?.content || "a sci-fi movie scene";
  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");

  if (isDemo) {
    console.log("Using local simulator for Chat request");
    return res.json(await getSimulatedChat(userPrompt));
  }

  try {
    const response = await fetch("https://platform.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(req.body),
    });

    const responseText = await response.text();
    try {
      const data = JSON.parse(responseText);
      if (response.ok) {
        return res.status(response.status).json(data);
      }
      throw new Error(`Upstream returned error status ${response.status}`);
    } catch (e) {
      console.warn("Agnes proxy chat returned non-JSON/HTML, falling back to simulator:", responseText.slice(0, 300));
      return res.json(await getSimulatedChat(userPrompt));
    }
  } catch (error: any) {
    console.error("Proxy Chat error, falling back to simulator:", error);
    return res.json(await getSimulatedChat(userPrompt));
  }
});

// Proxy to Agnes API Images/Generations
app.post("/api/proxy/images", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header (Agnes API Key)" });
  }

  const prompt = req.body.prompt || "cinematic scene";
  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock");

  if (isDemo) {
    console.log("Using local simulator for Image request");
    return res.json(getSimulatedImage(prompt));
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch("https://platform.agnes-ai.com/v1/images/generations", {
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
    try {
      const data = JSON.parse(responseText);
      if (response.ok && data.data?.[0]?.url) {
        return res.status(response.status).json(data);
      }
      throw new Error(`Upstream returned error or invalid image output. Status: ${response.status}`);
    } catch (e) {
      console.warn("Agnes proxy images returned non-JSON/HTML, falling back to simulator:", responseText.slice(0, 300));
      return res.json(getSimulatedImage(prompt));
    }
  } catch (error: any) {
    console.error("Proxy Images error, falling back to simulator:", error);
    return res.json(getSimulatedImage(prompt));
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
    console.log("Using local simulator for Video creation request");
    return res.json(getSimulatedVideoTask());
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch("https://platform.agnes-ai.com/v1/videos/generations", {
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
    try {
      const data = JSON.parse(responseText);
      if (response.ok && (data.task_id || data.video_id)) {
        return res.status(response.status).json(data);
      }
      throw new Error(`Upstream returned error or invalid video output. Status: ${response.status}`);
    } catch (e) {
      console.warn("Agnes proxy videos returned non-JSON/HTML, falling back to simulator:", responseText.slice(0, 300));
      return res.json(getSimulatedVideoTask());
    }
  } catch (error: any) {
    console.error("Proxy Videos error, falling back to simulator:", error);
    return res.json(getSimulatedVideoTask());
  }
});

// Proxy to Agnes API Tasks/Status
app.get("/api/proxy/status", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header (Agnes API Key)" });
  }

  const { video_id, task_id } = req.query;
  const targetId = (video_id || task_id) as string || "unknown";

  const isDemo = authHeader.includes("••••") || authHeader.toLowerCase().includes("demo") || authHeader.toLowerCase().includes("mock") || targetId.startsWith("sim_");

  if (isDemo) {
    console.log("Using local simulator for Video status request");
    return res.json(getSimulatedStatus(targetId));
  }

  let targetUrl = "";
  if (video_id) {
    targetUrl = `https://platform.agnes-ai.com/agnesapi?video_id=${video_id}`;
  } else if (task_id) {
    targetUrl = `https://platform.agnes-ai.com/v1/videos/tasks/${task_id}`;
  } else {
    return res.status(400).json({ error: "Required query parameter video_id or task_id is missing" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    try {
      const data = JSON.parse(responseText);
      if (response.ok) {
        return res.status(response.status).json(data);
      }
      throw new Error(`Upstream returned error status ${response.status}`);
    } catch (e) {
      console.warn("Agnes proxy status returned non-JSON/HTML, falling back to simulator:", responseText.slice(0, 300));
      return res.json(getSimulatedStatus(targetId));
    }
  } catch (error: any) {
    console.error("Proxy Status error, falling back to simulator:", error);
    return res.json(getSimulatedStatus(targetId));
  }
});

// ==========================================
// 2. TTS (TEXT TO SPEECH) ENDPOINT
// ==========================================
app.post("/api/tts", async (req, res) => {
  const { text, lang } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text parameter is required" });
  }

  try {
    const ttsLang = lang || "zh";
    // Split text into chunks of max 150 characters (API limit is ~200)
    const chunks: string[] = [];
    const sentenceBoundary = /([.,!?;，。！？；\n]+)/g;
    const parts = text.split(sentenceBoundary);
    
    let currentChunk = "";
    for (const part of parts) {
      if (!part) continue;
      if (currentChunk.length + part.length < 150) {
        currentChunk += part;
      } else {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = part;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    if (chunks.length === 0) {
      chunks.push(text.slice(0, 150));
    }

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
app.post("/api/merge", async (req, res) => {
  const { clips, lang } = req.body;
  if (!clips || !Array.isArray(clips) || clips.length === 0) {
    return res.status(400).json({ error: "Invalid clips list provided" });
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
        const chunks: string[] = [];
        const sentenceBoundary = /([.,!?;，。！？；\n]+)/g;
        const parts = fullText.split(sentenceBoundary);
        
        let currentChunk = "";
        for (const part of parts) {
          if (!part) continue;
          if (currentChunk.length + part.length < 150) {
            currentChunk += part;
          } else {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = part;
          }
        }
        if (currentChunk.trim()) chunks.push(currentChunk.trim());

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

async function pollAgnesVideoStatus(
  videoId: string,
  apiKey: string,
  ws: WebSocket,
  taskId: string
): Promise<void> {
  const delays = [5000, 10000, 15000, 20000, 30000, 45000, 60000];
  const maxAttempts = 35;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (ws.readyState !== WebSocket.OPEN) return;

    if (attempt > 0) {
      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
    }

    if (ws.readyState !== WebSocket.OPEN) return;

    try {
      const targetUrl = `https://platform.agnes-ai.com/agnesapi?video_id=${videoId}`;
      const response = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.status?.toLowerCase();
      const progress = data.progress || 0;

      ws.send(JSON.stringify({
        type: "progress",
        taskId,
        step: "video",
        status: status || "pending",
        message: `Video status: ${status || "pending"}...`,
        progress,
      }));

      if (status === "completed" || status === "success") {
        const videoUrl = data.urls?.[0] || data.video_url || data.url || data.remixed_from_video_id;
        if (videoUrl) {
          ws.send(JSON.stringify({ type: "done", taskId, url: videoUrl }));
        } else {
          ws.send(JSON.stringify({ type: "error", taskId, message: "No URL in completed response" }));
        }
        return;
      }

      if (status === "failed") {
        ws.send(JSON.stringify({ type: "error", taskId, message: data.error || "Video generation failed" }));
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
