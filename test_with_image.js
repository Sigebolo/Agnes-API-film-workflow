const API_KEY = "sk-xQQADhAKS00yNPgKc0dSUX3dXfVcHrZ7NoUN0WvSZUJdp0AJ";

async function main() {
  console.log("Submitting video WITH image...");
  const resp = await fetch("https://apihub.agnes-ai.com/v1/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "agnes-video-v2.0",
      prompt: "The woman slowly turns and smiles, gentle camera pan, flowing hair",
      image: "https://platform-outputs.agnes-ai.space/images/agnes-image-v2.0/img_a3e4e9c95c8e8f2c8f0ba0fc94a8709f.jpg",
      num_frames: 121,
      frame_rate: 24,
    }),
  });
  const data = await resp.json();
  console.log("Response:", JSON.stringify(data));
  const videoId = data.video_id;
  console.log(`video_id: ${videoId}`);

  console.log("\nPolling...");
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const r = await fetch(`https://apihub.agnes-ai.com/agnesapi?video_id=${videoId}`, {
      headers: { "Authorization": `Bearer ${API_KEY}` },
    });
    if (!r.ok) { console.log(`[${i+1}] HTTP ${r.status}`); continue; }
    const d = await r.json();
    const status = d.status?.toLowerCase() || "unknown";
    const progress = d.progress ?? 0;
    console.log(`[${i+1}] Status: ${status}, Progress: ${progress}%`);
    if (status === "completed" || status === "success") {
      const url = d.remixed_from_video_id || d.video_url;
      console.log(`DONE! URL: ${url}`);
      // Download
      const fs = await import("fs");
      const resp2 = await fetch(url);
      const buf = Buffer.from(await resp2.arrayBuffer());
      fs.default.writeFileSync("D:\\mimo code\\Agnesfilm\\test_with_image.mp4", buf);
      console.log(`Saved: test_with_image.mp4 (${buf.length} bytes)`);
      return;
    }
    if (status === "failed") { console.log(`FAILED: ${d.error}`); return; }
  }
  console.log("TIMEOUT");
}
main();
