import { test, expect } from '@playwright/test';

test.describe('Agnes Canvas - Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('loads the app and shows API key input', async ({ page }) => {
    await expect(page.locator('text=Agnes Canvas')).toBeVisible();
    await expect(page.locator('text=Agnes API Credentials')).toBeVisible();
  });

  test('can enter and save API key', async ({ page }) => {
    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await keyInput.fill('test-api-key-12345');
    
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 3000 });
  });

  test('shows demo mode warning for demo keys', async ({ page }) => {
    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await keyInput.fill('demo-key-agnes');
    
    await expect(page.locator('text=Demo mode')).toBeVisible();
  });
});

test.describe('Prompt Optimization Step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Enter API key
    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await keyInput.fill('test-api-key-12345');
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    await page.waitForTimeout(500);
  });

  test('shows prompt input area', async ({ page }) => {
    await expect(page.getByText('Your Idea (English or 中文)')).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5000 });
  });

  test('run pipeline button is disabled when prompt is empty', async ({ page }) => {
    const runButton = page.locator('button:has-text("Run Pipeline")');
    await expect(runButton).toBeDisabled();
  });

  test('run pipeline button enables when prompt entered', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('a beautiful sunset over the ocean');
    
    const runButton = page.locator('button:has-text("Run Pipeline")');
    await expect(runButton).toBeEnabled();
  });
});

test.describe('Step Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Enter API key
    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await keyInput.fill('test-api-key-12345');
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    await page.waitForTimeout(500);
  });

  test('can navigate between steps using sidebar', async ({ page }) => {
    // Click on Step 2 using sidebar button
    await page.locator('button:has-text("Generate Image")').first().click();
    await expect(page.locator('text=2. Generate Base Image')).toBeVisible();

    // Click on Step 3 using sidebar button
    await page.locator('button:has-text("Create Video")').first().click();
    await expect(page.locator('text=3.')).toBeVisible();
  });
});
