const API_KEY = "sk-xQQADhAKS00yNPgKc0dSUX3dXfVcHrZ7NoUN0WvSZUJdp0AJ";
const AGNES_SUBMIT = "https://apihub.agnes-ai.com/v1/videos";
const AGNES_POLL = "https://apihub.agnes-ai.com/agnesapi";

async function submitTask(prompt, imageUrl) {
  const body = {
    model: "agnes-video-v2.0",
    prompt: prompt,
    num_frames: 121,
    frame_rate: 24,
  };
  if (imageUrl) body.image = imageUrl;

  console.log(`Submitting: "${prompt}" ${imageUrl ? "(with image)" : "(no image)"}`);

  const resp = await fetch(AGNES_SUBMIT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (!resp.ok) {
    throw new Error(`Submit failed: ${resp.status}`);
  }

  // CRITICAL: Use video_id for polling, NOT task_id!
  const videoId = data.video_id || data.id;
  const taskId = data.task_id;
  console.log(`video_id: ${videoId}`);
  console.log(`task_id: ${taskId}`);
  return videoId;
}

async function pollTask(videoId, label) {
  console.log(`\nPolling: ${label} (video_id: ${videoId})`);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 10000));

    // CRITICAL: Use /agnesapi?video_id= NOT /v1/video/generations/{task_id}
    const resp = await fetch(`${AGNES_POLL}?video_id=${videoId}`, {
      headers: { "Authorization": `Bearer ${API_KEY}` },
    });
    if (!resp.ok) {
      console.log(`[${i+1}] HTTP ${resp.status}`);
      continue;
    }

    const data = await resp.json();
    const status = data.status?.toLowerCase() || "unknown";
    const progress = data.progress ?? 0;
    const elapsed = Math.round((i + 1) * 10);
    console.log(`[${i+1}] Status: ${status}, Progress: ${progress}% (${elapsed}s)`);

    if (status === "completed" || status === "success") {
      const url = data.remixed_from_video_id || data.video_url || data.url;
      console.log(`DONE! URL: ${url}`);
      return url;
    }
    if (status === "failed") {
      console.log(`FAILED: ${data.error || "unknown"}`);
      return null;
    }
  }
  console.log("TIMEOUT");
  return null;
}

async function download(url, path) {
  const fs = await import("fs");
  const resp = await fetch(url);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.default.writeFileSync(path, buf);
  console.log(`Saved: ${path} (${buf.length} bytes)`);
  return buf.length;
}

async function main() {
  // Test 1: No image - beautiful girl dancing
  console.log("========== TEST 1: NO IMAGE - Beautiful girl dancing ==========");
  const id1 = await submitTask("A beautiful young woman in a red dress dancing gracefully in a sunlit garden, flowing fabric, cinematic slow motion, golden hour lighting");
  const url1 = await pollTask(id1, "No image");
  if (url1) {
    const size1 = await download(url1, "D:\\mimo code\\Agnesfilm\\test_girl_dancing.mp4");
    console.log(`TEST 1 PASS: ${size1} bytes`);
  } else {
    console.log("TEST 1 FAIL");
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Girl dancing (no image): ${url1 ? "PASS" : "FAIL"}`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
