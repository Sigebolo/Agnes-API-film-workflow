const API_KEY = "sk-xQQADhAKS00yNPgKc0dSUX3dXfVcHrZ7NoUN0WvSZUJdp0AJ";
const AGNES_URL = "https://apihub.agnes-ai.com/v1/video/generations";

async function submitTask(prompt, imageUrl) {
  const body = {
    model: "agnes-video-v2.0",
    prompt: prompt,
    num_frames: 361,
    frame_rate: 24,
  };
  if (imageUrl) body.image = imageUrl;

  console.log(`Submitting: "${prompt}" ${imageUrl ? "(with image)" : "(no image)"}`);

  const resp = await fetch(AGNES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Submit failed: ${resp.status} ${JSON.stringify(data)}`);
  }
  const taskId = data.task_id || data.video_id;
  console.log(`Task ID: ${taskId}`);
  return taskId;
}

async function pollTask(taskId, label) {
  console.log(`\nPolling: ${label}`);
  for (let i = 0; i < 80; i++) {
    await new Promise(r => setTimeout(r, 15000));

    const resp = await fetch(`https://apihub.agnes-ai.com/v1/video/generations/${taskId}`, {
      headers: { "Authorization": `Bearer ${API_KEY}` },
    });
    if (!resp.ok) {
      console.log(`[${i+1}] HTTP ${resp.status}`);
      continue;
    }

    const raw = await resp.json();
    const inner = raw.data?.data || raw.data || raw;
    const status = inner.status?.toLowerCase() || "unknown";
    const progress = inner.progress ?? 0;
    const elapsed = Math.round((i + 1) * 15 / 60 * 10) / 10;
    console.log(`[${i+1}] Status: ${status}, Progress: ${progress}% (${elapsed}min elapsed)`);

    if (status === "completed" || status === "success") {
      const url = inner.remixed_from_video_id
        || inner.urls?.[0]
        || inner.video_url
        || raw.data?.remixed_from_video_id;
      console.log(`DONE! URL: ${url}`);
      return url;
    }
    if (status === "failed") {
      console.log(`FAILED: ${inner.error || raw.data?.error || "unknown"}`);
      return null;
    }
  }
  console.log("TIMEOUT");
  return null;
}

async function download(url, path) {
  const fs = require("fs");
  const resp = await fetch(url);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(path, buf);
  console.log(`Saved: ${path} (${buf.length} bytes)`);
  return buf.length;
}

async function main() {
  // Test 1: No image
  console.log("========== TEST 1: NO IMAGE ==========");
  const id1 = await submitTask("A bright orange cat playing with a yarn ball on a white carpet, soft natural light");
  const url1 = await pollTask(id1, "No image");
  if (url1) {
    const size1 = await download(url1, "D:\\mimo code\\Agnesfilm\\test_no_image.mp4");
    console.log(`TEST 1 PASS: ${size1} bytes`);
  } else {
    console.log("TEST 1 FAIL");
  }

  // Test 2: With image (use a real Agnes output image)
  console.log("\n========== TEST 2: WITH IMAGE ==========");
  // Use the cat image from the old task
  const id2 = await submitTask(
    "A cute orange cat sitting on a wooden table, subtle camera pan, natural lighting",
    "https://platform-outputs.agnes-ai.space/images/agnes-image-v2.0/img_a3e4e9c95c8e8f2c8f0ba0fc94a8709f.jpg"
  );
  const url2 = await pollTask(id2, "With image");
  if (url2) {
    const size2 = await download(url2, "D:\\mimo code\\Agnesfilm\\test_with_image.mp4");
    console.log(`TEST 2 PASS: ${size2} bytes`);
  } else {
    console.log("TEST 2 FAIL");
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Test 1 (no image):   ${url1 ? "PASS" : "FAIL"}`);
  console.log(`Test 2 (with image): ${url2 ? "PASS" : "FAIL"}`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
