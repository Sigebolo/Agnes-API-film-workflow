const API_KEY = "sk-xQQADhAKS00yNPgKc0dSUX3dXfVcHrZ7NoUN0WvSZUJdp0AJ";

async function main() {
  // Step 1: Generate an image
  console.log("Step 1: Generating image...");
  const imgResp = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "agnes-image-2.1-flash",
      prompt: "A beautiful young woman in a red dress, portrait photo, natural lighting",
      size: "1024x768",
    }),
  });
  const imgData = await imgResp.json();
  console.log("Image response:", JSON.stringify(imgData));
  const imageUrl = imgData.data?.[0]?.url;
  if (!imageUrl) throw new Error("No image URL");
  console.log(`Image URL: ${imageUrl}`);

  // Step 2: Submit video with image
  console.log("\nStep 2: Submitting video with image...");
  const vidResp = await fetch("https://apihub.agnes-ai.com/v1/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "agnes-video-v2.0",
      prompt: "The woman slowly turns and smiles, gentle camera pan, flowing hair",
      image: imageUrl,
      num_frames: 121,
      frame_rate: 24,
    }),
  });
  const vidData = await vidResp.json();
  console.log("Video response:", JSON.stringify(vidData));
  const videoId = vidData.video_id;
  console.log(`video_id: ${videoId}`);

  // Step 3: Poll
  console.log("\nStep 3: Polling...");
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
    if (status === "failed") {
      console.log(`FAILED:`, JSON.stringify(d.error));
      return;
    }
  }
  console.log("TIMEOUT");
}
main();
