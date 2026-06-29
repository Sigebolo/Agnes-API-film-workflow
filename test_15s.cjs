const API_KEY = "sk-xQQADhAKS00yNPgKc0dSUX3dXfVcHrZ7NoUN0WvSZUJdp0AJ";
const fs = require("fs");
const path = require("path");

const OUTPUTS_DIR = "D:\\mimo code\\Agnesfilm\\outputs";

function createOutputFolder(topic) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "-");
  const safeTopic = topic.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_").slice(0, 30);
  const folderName = `${date}_${time}_${safeTopic}`;
  const folderPath = path.join(OUTPUTS_DIR, folderName);
  fs.mkdirSync(folderPath, { recursive: true });
  return folderPath;
}

async function submitVideo(prompt, imageUrl) {
  const body = {
    model: "agnes-video-v2.0",
    prompt: prompt,
    num_frames: 361,
    frame_rate: 24,
  };
  if (imageUrl) body.image = imageUrl;

  const resp = await fetch("https://apihub.agnes-ai.com/v1/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return data.video_id;
}

async function pollVideo(videoId) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const resp = await fetch(`https://apihub.agnes-ai.com/agnesapi?video_id=${videoId}`, {
      headers: { "Authorization": `Bearer ${API_KEY}` },
    });
    if (!resp.ok) continue;
    const data = await resp.json();
    const status = data.status?.toLowerCase();
    const progress = data.progress ?? 0;
    const elapsed = Math.round((i + 1) * 10);
    console.log(`[${elapsed}s] Status: ${status}, Progress: ${progress}%`);
    if (status === "completed" || status === "success") {
      return data.remixed_from_video_id || data.video_url;
    }
    if (status === "failed") {
      throw new Error(`Failed: ${JSON.stringify(data.error)}`);
    }
  }
  throw new Error("Timeout");
}

async function downloadVideo(url, destPath) {
  const resp = await fetch(url);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function main() {
  const topic = "girl_dancing";
  const prompt = "A beautiful young woman in a red dress dancing gracefully in a sunlit garden, flowing fabric, cinematic slow motion, golden hour lighting";

  console.log("Creating output folder...");
  const folder = createOutputFolder(topic);
  console.log(`Output: ${folder}`);

  console.log("\nSubmitting 15s video...");
  const videoId = await submitVideo(prompt);
  console.log(`video_id: ${videoId}`);

  console.log("\nPolling...");
  const url = await pollVideo(videoId);
  console.log(`\nVideo URL: ${url}`);

  const filename = `video_${Date.now()}.mp4`;
  const filepath = path.join(folder, filename);
  const size = await downloadVideo(url, filepath);
  console.log(`\nSaved: ${filepath} (${size} bytes)`);

  // Also save metadata
  const meta = {
    topic,
    prompt,
    videoId,
    url,
    filename,
    size,
    duration: "15s",
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(folder, "metadata.json"), JSON.stringify(meta, null, 2));
  console.log(`Metadata: ${path.join(folder, "metadata.json")}`);
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
