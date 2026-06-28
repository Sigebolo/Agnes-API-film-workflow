/**
 * E2E tests for the full single-clip pipeline using a real Agnes API key.
 *
 * Flow: enter API key → optimize prompt (Step 1) → generate image (Step 2) → generate video (Step 3)
 *
 * NOTE: Agnes video generation can take 5–20 minutes depending on server load.
 * The test is structured so each phase has its own generous timeout; the overall
 * ceiling is 20 minutes.  If Agnes is unusually busy the video-completion
 * assertion will time out — that is a server issue, not a test bug.
 *
 * Run with:
 *   AGNES_API_KEY=sk-... npx playwright test tests/e2e/single-clip.spec.ts
 */

import { test, expect } from '@playwright/test';

const API_KEY = process.env.AGNES_API_KEY;

test.describe('Single-Clip Pipeline (Real Agnes API)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('full pipeline: optimize prompt → generate image → generate video', async ({ page }) => {
    if (!API_KEY) {
      test.skip(true, 'AGNES_API_KEY environment variable not set — skipping real-API test');
    }

    // 20-minute ceiling.
    // Budget breakdown: ~60s pipeline + ~60s image + ~3 min task creation + ~15 min video render
    test.setTimeout(1_200_000);

    // -----------------------------------------------------------------------
    // 0. Enter API key
    // -----------------------------------------------------------------------
    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await expect(keyInput).toBeVisible({ timeout: 5000 });
    await keyInput.fill(API_KEY!);

    // Green "Real API key" indicator appears immediately after typing
    await expect(page.locator('text=Real API key')).toBeVisible({ timeout: 5000 });

    await page.locator('button:has-text("Save")').click();
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/single-clip-01-api-key-saved.png' });

    // -----------------------------------------------------------------------
    // 1. Prompt & Character Anchor — run the optimization pipeline
    //
    //    The raw-prompt textarea uses the "A red-haired astronaut drinking coffee"
    //    placeholder, distinguishing it from the character-description textarea and
    //    the optimized-prompt textareas that live in the same step.
    //
    //    KEY BEHAVIOUR: while the pipeline runs the button text changes to
    //    "Optimizing Prompt…" / "Extracting Character…" / "Generating Character Anchor…"
    //    so the "Run Pipeline" locator returns 0 elements during execution.
    //    We wait for the locator to disappear (started) then reappear (done).
    // -----------------------------------------------------------------------
    const rawPromptTextarea = page.locator(
      'textarea[placeholder*="A red-haired astronaut drinking coffee"]'
    );
    await expect(rawPromptTextarea).toBeVisible({ timeout: 5000 });
    await rawPromptTextarea.fill('A lone astronaut walks on Mars at sunset');

    const runPipelineBtn = page.locator('button:has-text("Run Pipeline")');
    await expect(runPipelineBtn).toBeEnabled({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/single-clip-02-before-pipeline.png' });
    await runPipelineBtn.click();

    // Pipeline started: button text changed away from "Run Pipeline"
    await expect(runPipelineBtn).not.toBeVisible({ timeout: 10000 });

    // Pipeline finished: button text reverted to "Run Pipeline (Optimize → Extract → Anchor)"
    await expect(runPipelineBtn).toBeVisible({ timeout: 90000 });

    await page.screenshot({ path: 'test-results/single-clip-03-pipeline-done.png' });

    // -----------------------------------------------------------------------
    // 2. Generate Base Image
    //    Click the step indicator bar → click "Generate Keyframe" → wait for image.
    // -----------------------------------------------------------------------
    await page.locator('button:has-text("Generate Image")').first().click();
    await expect(page.locator('text=2. Generate Base Image')).toBeVisible({ timeout: 5000 });

    // Set up response listener BEFORE clicking to avoid missing a fast response
    const imageApiResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/proxy/images') &&
        resp.request().method() === 'POST',
      { timeout: 90000 }
    );

    const generateKeyframeBtn = page.locator('button:has-text("Generate Keyframe")');
    await expect(generateKeyframeBtn).toBeEnabled({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/single-clip-04-before-image-gen.png' });
    await generateKeyframeBtn.click();

    // Right-panel heading confirms we are in the generation loading state
    await expect(page.locator('text=Synthesizing High-Detail Frame')).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({ path: 'test-results/single-clip-05-image-generating.png' });

    const imageApiResponse = await imageApiResponsePromise;
    expect(imageApiResponse.ok()).toBeTruthy();

    // Generated keyframe image renders once isGenerating flips back to false
    await expect(page.locator('img[alt="Generated keyframe"]')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/single-clip-06-image-done.png' });

    // -----------------------------------------------------------------------
    // 3. Transform Keyframe to Video
    //    Three-phase wait:
    //      3a. Task creation  — Agnes accepts the job and dispatches a Job ID
    //      3b. Processing     — WebSocket delivers first status update from Agnes
    //      3c. Completion     — "Go to Timeline Step" button appears when videoUrl is set
    // -----------------------------------------------------------------------
    const goToVideoBtn = page.locator('button:has-text("Step 3: Turn Image to Video")');
    await expect(goToVideoBtn).toBeVisible({ timeout: 5000 });
    await goToVideoBtn.click();

    await expect(page.locator('text=3. Transform Keyframe to Video')).toBeVisible({ timeout: 5000 });

    const renderMovieBtn = page.locator('button:has-text("Render Movie Clip")');
    await expect(renderMovieBtn).toBeEnabled({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/single-clip-07-before-video-gen.png' });
    await renderMovieBtn.click();

    // 3a. Heading "Generating Cinematic Motion" confirms the right-panel entered loading state
    await expect(page.locator('text=Generating Cinematic Motion')).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: 'test-results/single-clip-08-video-task-creating.png' });

    // 3b. "Dispatched Agnes Job ID" appears in the render-pipeline logs once the
    //     POST /api/proxy/videos call returns successfully with a task ID.
    //     Agnes's server can retry on 503 (up to 3× 30 s = 90 s), so allow 3 minutes.
    await expect(page.locator('text=Dispatched Agnes Job ID')).toBeVisible({ timeout: 180000 });
    await page.screenshot({ path: 'test-results/single-clip-09-video-job-dispatched.png' });

    // 3c. "Video status:" text confirms the WebSocket received the first Agnes status
    //     update (proving bi-directional connectivity).  Allow 2 minutes.
    await expect(page.locator('text=Video status:')).toBeVisible({ timeout: 120000 });

    // 3d. "Go to Timeline Step" only renders when activeClip.videoUrl is set, meaning
    //     Agnes has finished rendering and the WebSocket received a "done" event.
    //     Agnes video generation can take 5–15 minutes on a busy server; allow 15 min.
    await expect(
      page.locator('button:has-text("Go to Timeline Step")')
    ).toBeVisible({ timeout: 900000 });

    // The <video> element itself must also be present and visible
    await expect(page.locator('video')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/single-clip-10-video-done.png' });
  });
});
