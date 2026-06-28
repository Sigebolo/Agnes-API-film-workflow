# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: single-clip.spec.ts >> Single-Clip Pipeline (Real Agnes API) >> full pipeline: optimize prompt → generate image → generate video
- Location: tests\e2e\single-clip.spec.ts:28:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Dispatched Agnes Job ID')
Expected: visible
Timeout: 180000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 180000ms
  - waiting for locator('text=Dispatched Agnes Job ID')

```

```yaml
- banner:
  - text: A
  - heading "Agnes AI Generation Studio" [level=1]
  - paragraph: v2.0-flash • Multi-modal cinematic generation workflow engine.
  - button "Storyboard Mode"
- main:
  - complementary:
    - heading "Agnes Canvas" [level=1]
    - text: AI Cinematic Studio Agnes API Credentials
    - link "Get Key":
      - /url: https://platform.agnes-ai.com/
    - textbox "Enter Agnes API Key...": sk-xQQADhAKS00yNPgKc0dSUX3dXfVcHrZ7NoUN0WvSZUJdp0AJ
    - button "Save" [disabled]
    - paragraph: Real API key — calls Agnes API directly.
    - heading "Scene Manager" [level=3]
    - text: 1 Scenes
    - 'button "Scene #1: We have finally esta..."'
    - button "+ Create New Scene"
    - heading "Face & Style Consistency" [level=4]
    - paragraph: "In AI cinematic editing, maintaining continuous character representation across scenes is vital:"
    - list:
      - listitem: Keep a uniform detailed character description (age, hair, clothes, glasses) across all prompts.
      - listitem: Anchor composition elements (e.g. cinematic, 35mm lens, volumetric light).
      - listitem: Feed the output image of the previous scene as the reference image to the next scene.
    - text: Studio Ready Agnes SDK v2.0
  - button "Prompt & Anchor"
  - button "Generate Image"
  - button "Create Video"
  - button "Timeline Merge"
  - button
  - heading "3. Transform Keyframe to Video" [level=2]
  - paragraph: Animate your visual base frame with customized movie-grade camera trajectories.
  - text: Agnes Video v2.0 Reference Base Frame
  - img "Reference keyframe"
  - text: Motion Guidance Prompt
  - textbox "e.g., Camera slow pan-right, soft volumetric lighting flickering, ultra-high realism...": "Animate subtle camera movement, cinematic panning, emphasizing details from the scene: masterpiece, best quality, ultra-detailed, 8k UHD, photorealistic, sharp focus, professional photography, award-winning, highres, absurdres, incredibly detailed, intricate details, lone astronaut, bulky white EVA space suit with reflective gold visor, weathered texture, heavy boots, walking away from camera, slow deliberate stride, red planet surface, rust-colored rocky terrain, jagged boulders, fine red dust kicking up behind boots, distant crater rim, barren landscape, Martian sunset, sky gradient transitioning from deep orange to purple, large dark silhouette of Phobos visible in sky, volumetric god rays cutting through thin atmosphere, dramatic lighting, high contrast, warm amber tones mixed with cool shadows, cinematic composition, wide shot, low angle, 24mm lens, deep depth of field, sense of isolation, epic scale, sci-fi realism, highly detailed textures"
  - text: Speech script / Subtitles
  - textbox "e.g., We have successfully established base contact on the red planet.": We have finally established our first colony on the red planet.
  - paragraph: This text will be synthesized as audio voiceover and displayed as synced subtitles in the timeline step.
  - text: Duration
  - combobox [disabled]:
    - option "5s" [selected]
    - option "10s"
    - option "15s"
  - button "Processing..." [disabled]
  - text: "JOB ID: CREATING..."
  - heading "Generating Cinematic Motion" [level=3]
  - text: ⚡ Submitting task to Agnes AI...
  - paragraph: Agnes's video engine is generating 121 high-definition frames at 24fps with cinematic temporal flow.
  - text: RENDER PIPELINE LOGS LIVE TRACKING [1] 🔄 Initializing video generation pipeline... [2] 📡 Constructing Frame-to-Video parameters... [3] 🌐 Compressing reference keyframe for faster upload... [4] ⚠️ Compression failed, using original image [5] 🌐 Uploading reference keyframe to Agnes neural cluster...
  - button "Cancel"
```

# Test source

```ts
  44  |     // Green "Real API key" indicator appears immediately after typing
  45  |     await expect(page.locator('text=Real API key')).toBeVisible({ timeout: 5000 });
  46  | 
  47  |     await page.locator('button:has-text("Save")').click();
  48  |     await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });
  49  | 
  50  |     await page.screenshot({ path: 'test-results/single-clip-01-api-key-saved.png' });
  51  | 
  52  |     // -----------------------------------------------------------------------
  53  |     // 1. Prompt & Character Anchor — run the optimization pipeline
  54  |     //
  55  |     //    The raw-prompt textarea uses the "A red-haired astronaut drinking coffee"
  56  |     //    placeholder, distinguishing it from the character-description textarea and
  57  |     //    the optimized-prompt textareas that live in the same step.
  58  |     //
  59  |     //    KEY BEHAVIOUR: while the pipeline runs the button text changes to
  60  |     //    "Optimizing Prompt…" / "Extracting Character…" / "Generating Character Anchor…"
  61  |     //    so the "Run Pipeline" locator returns 0 elements during execution.
  62  |     //    We wait for the locator to disappear (started) then reappear (done).
  63  |     // -----------------------------------------------------------------------
  64  |     const rawPromptTextarea = page.locator(
  65  |       'textarea[placeholder*="A red-haired astronaut drinking coffee"]'
  66  |     );
  67  |     await expect(rawPromptTextarea).toBeVisible({ timeout: 5000 });
  68  |     await rawPromptTextarea.fill('A lone astronaut walks on Mars at sunset');
  69  | 
  70  |     const runPipelineBtn = page.locator('button:has-text("Run Pipeline")');
  71  |     await expect(runPipelineBtn).toBeEnabled({ timeout: 5000 });
  72  | 
  73  |     await page.screenshot({ path: 'test-results/single-clip-02-before-pipeline.png' });
  74  |     await runPipelineBtn.click();
  75  | 
  76  |     // Pipeline started: button text changed away from "Run Pipeline"
  77  |     await expect(runPipelineBtn).not.toBeVisible({ timeout: 10000 });
  78  | 
  79  |     // Pipeline finished: button text reverted to "Run Pipeline (Optimize → Extract → Anchor)"
  80  |     await expect(runPipelineBtn).toBeVisible({ timeout: 90000 });
  81  | 
  82  |     await page.screenshot({ path: 'test-results/single-clip-03-pipeline-done.png' });
  83  | 
  84  |     // -----------------------------------------------------------------------
  85  |     // 2. Generate Base Image
  86  |     //    Click the step indicator bar → click "Generate Keyframe" → wait for image.
  87  |     // -----------------------------------------------------------------------
  88  |     await page.locator('button:has-text("Generate Image")').first().click();
  89  |     await expect(page.locator('text=2. Generate Base Image')).toBeVisible({ timeout: 5000 });
  90  | 
  91  |     // Set up response listener BEFORE clicking to avoid missing a fast response
  92  |     const imageApiResponsePromise = page.waitForResponse(
  93  |       (resp) =>
  94  |         resp.url().includes('/api/proxy/images') &&
  95  |         resp.request().method() === 'POST',
  96  |       { timeout: 90000 }
  97  |     );
  98  | 
  99  |     const generateKeyframeBtn = page.locator('button:has-text("Generate Keyframe")');
  100 |     await expect(generateKeyframeBtn).toBeEnabled({ timeout: 5000 });
  101 | 
  102 |     await page.screenshot({ path: 'test-results/single-clip-04-before-image-gen.png' });
  103 |     await generateKeyframeBtn.click();
  104 | 
  105 |     // Right-panel heading confirms we are in the generation loading state
  106 |     await expect(page.locator('text=Synthesizing High-Detail Frame')).toBeVisible({
  107 |       timeout: 15000,
  108 |     });
  109 |     await page.screenshot({ path: 'test-results/single-clip-05-image-generating.png' });
  110 | 
  111 |     const imageApiResponse = await imageApiResponsePromise;
  112 |     expect(imageApiResponse.ok()).toBeTruthy();
  113 | 
  114 |     // Generated keyframe image renders once isGenerating flips back to false
  115 |     await expect(page.locator('img[alt="Generated keyframe"]')).toBeVisible({ timeout: 15000 });
  116 |     await page.screenshot({ path: 'test-results/single-clip-06-image-done.png' });
  117 | 
  118 |     // -----------------------------------------------------------------------
  119 |     // 3. Transform Keyframe to Video
  120 |     //    Three-phase wait:
  121 |     //      3a. Task creation  — Agnes accepts the job and dispatches a Job ID
  122 |     //      3b. Processing     — WebSocket delivers first status update from Agnes
  123 |     //      3c. Completion     — "Go to Timeline Step" button appears when videoUrl is set
  124 |     // -----------------------------------------------------------------------
  125 |     const goToVideoBtn = page.locator('button:has-text("Step 3: Turn Image to Video")');
  126 |     await expect(goToVideoBtn).toBeVisible({ timeout: 5000 });
  127 |     await goToVideoBtn.click();
  128 | 
  129 |     await expect(page.locator('text=3. Transform Keyframe to Video')).toBeVisible({ timeout: 5000 });
  130 | 
  131 |     const renderMovieBtn = page.locator('button:has-text("Render Movie Clip")');
  132 |     await expect(renderMovieBtn).toBeEnabled({ timeout: 5000 });
  133 | 
  134 |     await page.screenshot({ path: 'test-results/single-clip-07-before-video-gen.png' });
  135 |     await renderMovieBtn.click();
  136 | 
  137 |     // 3a. Heading "Generating Cinematic Motion" confirms the right-panel entered loading state
  138 |     await expect(page.locator('text=Generating Cinematic Motion')).toBeVisible({ timeout: 60000 });
  139 |     await page.screenshot({ path: 'test-results/single-clip-08-video-task-creating.png' });
  140 | 
  141 |     // 3b. "Dispatched Agnes Job ID" appears in the render-pipeline logs once the
  142 |     //     POST /api/proxy/videos call returns successfully with a task ID.
  143 |     //     Agnes's server can retry on 503 (up to 3× 30 s = 90 s), so allow 3 minutes.
> 144 |     await expect(page.locator('text=Dispatched Agnes Job ID')).toBeVisible({ timeout: 180000 });
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  145 |     await page.screenshot({ path: 'test-results/single-clip-09-video-job-dispatched.png' });
  146 | 
  147 |     // 3c. "Video status:" text confirms the WebSocket received the first Agnes status
  148 |     //     update (proving bi-directional connectivity).  Allow 2 minutes.
  149 |     await expect(page.locator('text=Video status:')).toBeVisible({ timeout: 120000 });
  150 | 
  151 |     // 3d. "Go to Timeline Step" only renders when activeClip.videoUrl is set, meaning
  152 |     //     Agnes has finished rendering and the WebSocket received a "done" event.
  153 |     //     Agnes video generation can take 5–15 minutes on a busy server; allow 15 min.
  154 |     await expect(
  155 |       page.locator('button:has-text("Go to Timeline Step")')
  156 |     ).toBeVisible({ timeout: 900000 });
  157 | 
  158 |     // The <video> element itself must also be present and visible
  159 |     await expect(page.locator('video')).toBeVisible({ timeout: 10000 });
  160 |     await page.screenshot({ path: 'test-results/single-clip-10-video-done.png' });
  161 |   });
  162 | });
  163 | 
```