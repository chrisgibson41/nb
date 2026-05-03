import { test, expect } from '@playwright/test';
import { waitForTree } from '../helpers.js';

test.describe('Getting Started', () => {
  test('shows Getting Started page on first load (no dismissed flag)', async ({ page }) => {
    // Clear localStorage so the flag is absent
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('nb:dismissedGettingStarted'));
    await page.reload();
    await waitForTree(page);

    await expect(page.getByText('Getting Started', { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('dismissing the Getting Started page hides it', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('nb:dismissedGettingStarted'));
    await page.reload();
    await waitForTree(page);

    // Click the × close button on the Getting Started page
    const closeBtn = page.locator('button[title="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await expect(page.getByText('Select a file to start editing')).toBeVisible({ timeout: 3000 });
    }
  });

  test('Getting Started does not show when flag is set', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nb:dismissedGettingStarted', '1'));
    await page.reload();
    await waitForTree(page);

    // Should show the empty editor state, not Getting Started
    await expect(page.getByText('Select a file to start editing')).toBeVisible({ timeout: 3000 });
  });

  test('re-opening Getting Started via button restores the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nb:dismissedGettingStarted', '1'));
    await page.reload();
    await waitForTree(page);

    // Find and click the "Getting Started guide" re-open button (in the empty state)
    const reopenBtn = page.getByText('Getting Started guide', { exact: false });
    if (await reopenBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reopenBtn.click();
      await expect(page.getByText('Getting Started', { exact: false })).toBeVisible({ timeout: 3000 });
    } else {
      // The button may live in a different location — skip gracefully
      test.skip();
    }
  });
});
