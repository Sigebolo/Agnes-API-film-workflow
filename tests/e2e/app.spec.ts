import { test, expect } from '@playwright/test';

test.describe('Agnes Ad Studio - Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('loads the app and shows API key input', async ({ page }) => {
    await expect(page.locator('text=Agnes AI Ad Studio')).toBeVisible();
    await expect(page.locator('text=Agnes API Key')).toBeVisible();
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

  test('defaults to Ad Mode with 4-step workflow', async ({ page }) => {
    await expect(page.locator('text=Ad Mode')).toBeVisible();
    await expect(page.locator('#app-sidebar').getByText('Product Info', { exact: true })).toBeVisible();
    await expect(page.locator('#app-sidebar').getByText('Logo Design', { exact: true })).toBeVisible();
    await expect(page.locator('#app-sidebar').getByText('Product Images', { exact: true })).toBeVisible();
    await expect(page.locator('#app-sidebar').getByText('Ad Video', { exact: true })).toBeVisible();
  });

  test('can switch to Creative Mode', async ({ page }) => {
    const modeBtn = page.locator('button:has-text("Ad Mode")');
    await modeBtn.click();

    await expect(page.locator('text=Creative Mode')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Prompt & Anchor')).toBeVisible();
  });
});

test.describe('Ad Mode - Product Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await keyInput.fill('test-api-key-12345');
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    await page.waitForTimeout(500);
  });

  test('shows product input form', async ({ page }) => {
    await expect(page.getByText('Product Name *')).toBeVisible();
    await expect(page.getByText('Product Description *')).toBeVisible();
  });

  test('next button is disabled when product name is empty', async ({ page }) => {
    const nextBtn = page.locator('button:has-text("Next")');
    await expect(nextBtn).toBeDisabled();
  });
});

test.describe('Creative Mode - Prompt Step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await keyInput.fill('test-api-key-12345');
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    await page.waitForTimeout(300);

    // Switch to Creative Mode
    const modeBtn = page.locator('button:has-text("Ad Mode")');
    await modeBtn.click();
    await page.waitForTimeout(300);
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

test.describe('Creative Mode - Step Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    const keyInput = page.locator('input[placeholder="Enter Agnes API Key..."]');
    await keyInput.fill('test-api-key-12345');
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    await page.waitForTimeout(300);

    // Switch to Creative Mode
    const modeBtn = page.locator('button:has-text("Ad Mode")');
    await modeBtn.click();
    await page.waitForTimeout(300);
  });

  test('can navigate between steps using sidebar', async ({ page }) => {
    await page.locator('button:has-text("Generate Image")').first().click();
    await expect(page.locator('text=2. Generate Base Image')).toBeVisible();

    await page.locator('button:has-text("Create Video")').first().click();
    await expect(page.locator('text=3.')).toBeVisible();
  });
});
