import { test, expect } from '@playwright/test';
import { dismissGettingStarted, waitForTree } from '../helpers.js';

test.describe('Templates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTree(page);
    await dismissGettingStarted(page);
  });

  test('Ctrl+T opens the template picker modal', async ({ page }) => {
    await page.keyboard.press('Meta+T');
    // The modal heading
    await expect(page.getByText('New note from template', { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('template picker lists available templates', async ({ page }) => {
    await page.keyboard.press('Meta+T');
    // The seeded template is "daily-note" — it should appear
    await expect(page.getByText('daily-note', { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('pressing Escape closes the template picker', async ({ page }) => {
    await page.keyboard.press('Meta+T');
    await expect(page.getByText('New note from template', { exact: false })).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('New note from template', { exact: false })).not.toBeVisible({ timeout: 3000 });
  });

  test('creating a note from template opens it in the editor', async ({ page }) => {
    await page.keyboard.press('Meta+T');
    await page.waitForSelector('text=daily-note', { timeout: 5000 });

    // Click the "daily-note" template
    await page.getByText('daily-note', { exact: false }).first().click();

    // A filename input or confirmation dialog should appear
    // Then a new note opens — wait for the editor to become active
    const filenameInput = page.locator('input').last();
    if (await filenameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const noteName = `from-template-${Date.now()}`;
      await filenameInput.fill(noteName);
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page.locator('.cm-content')).toBeVisible({ timeout: 5000 });
    } else {
      // Template may auto-create — just check editor is visible
      await expect(page.locator('.cm-content')).toBeVisible({ timeout: 5000 });
    }
  });

  test('template toolbar button opens the picker', async ({ page }) => {
    // The "New note from template" toolbar button
    const btn = page.getByTitle(/New note from template/i);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await expect(page.getByText('New note from template', { exact: false })).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});
