const API_KEY = "sk-xQQADhAKS00yNPgKc0dSUX3dXfVcHrZ7NoUN0WvSZUJdp0AJ";
const BASE_URL = "http://localhost:3000";

async function testVideoWithoutImage() {
  console.log("=== TEST 1: Video WITHOUT reference image ===");
  
  const body = {
    model: "agnes-video-v2.0",
    prompt: "A red ball bouncing on a white table, smooth animation",
    num_frames: 361,
    frame_rate: 24
  };

  console.log("Submitting video task (no image)...");
  const response = await fetch(`${BASE_URL}/api/proxy/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Video submission failed: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const taskId = data.task_id || data.video_id;
  console.log(`Task ID: ${taskId}`);
  return taskId;
}

async function testVideoWithImage() {
  console.log("\n=== TEST 2: Video WITH reference image ===");
  
  // Use a simple test image (1x1 pixel red PNG base64)
  const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
  
  const body = {
    model: "agnes-video-v2.0",
    prompt: "A red ball bouncing on a white table, smooth animation",
    num_frames: 361,
    frame_rate: 24,
    image: testImage
  };

  console.log("Submitting video task (with image)...");
  const response = await fetch(`${BASE_URL}/api/proxy/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Video submission failed: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const taskId = data.task_id || data.video_id;
  console.log(`Task ID: ${taskId}`);
  return taskId;
}

async function pollStatus(taskId, testName) {
  console.log(`\nPolling ${testName}...`);
  const maxPolls = 60;
  
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, 15000));
    
    try {
      const response = await fetch(`${BASE_URL}/api/tasks/${taskId}/status`, {
        headers: { "Authorization": `Bearer ${API_KEY}` }
      });
      
      if (!response.ok) {
        console.log(`[${i+1}] Poll error: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[${i+1}] Status: ${data.status}, Progress: ${data.progress}%`);
      
      if (data.status === "completed" || data.status === "success") {
        console.log(`✓ ${testName} DONE! URL: ${data.videoUrl}`);
        return data.videoUrl;
      }
      if (data.status === "failed") {
        console.log(`✗ ${testName} FAILED!`);
        return null;
      }
    } catch (err) {
      console.log(`[${i+1}] Poll error: ${err.message}`);
    }
  }
  
  console.log(`✗ ${testName} TIMEOUT after ${maxPolls} polls`);
  return null;
}

async function downloadVideo(url, filename) {
  console.log(`\nDownloading ${filename}...`);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const fs = require("fs");
  fs.writeFileSync(filename, Buffer.from(buffer));
  console.log(`✓ Saved: ${filename} (${buffer.byteLength} bytes)`);
  return filename;
}

async function main() {
  try {
    // Test 1: Without image
    const taskId1 = await testVideoWithoutImage();
    const url1 = await pollStatus(taskId1, "Video WITHOUT image");
    if (url1) {
      await downloadVideo(url1, "D:\\mimo code\\Agnesfilm\\test_video_no_image.mp4");
    }

    // Test 2: With image
    const taskId2 = await testVideoWithImage();
    const url2 = await pollStatus(taskId2, "Video WITH image");
    if (url2) {
      await downloadVideo(url2, "D:\\mimo code\\Agnesfilm\\test_video_with_image.mp4");
    }

    console.log("\n=== ALL TESTS COMPLETE ===");
  } catch (err) {
    console.error("TEST ERROR:", err.message);
    process.exit(1);
  }
}

main();
