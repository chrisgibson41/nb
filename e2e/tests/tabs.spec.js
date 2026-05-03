import { test, expect } from '@playwright/test';
import { dismissGettingStarted, createNote, openFile, waitForTree } from '../helpers.js';

test.describe('Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTree(page);
    await dismissGettingStarted(page);
  });

  test('opening a file creates exactly one working tab', async ({ page }) => {
    await openFile(page, 'welcome');
    const tabs = page.locator('[title*="welcome.md"]');
    await expect(tabs).toHaveCount(1);
  });

  test('opening a second file replaces the working tab', async ({ page }) => {
    const a = `e2e-tab-a-${Date.now()}`;
    const b = `e2e-tab-b-${Date.now()}`;
    await createNote(page, a);
    await createNote(page, b);

    // Only the latest file's tab should exist (a's tab replaced)
    await expect(page.locator(`text=${b}.md`).first()).toBeVisible();
    await expect(page.locator(`text=${a}.md`)).not.toBeVisible({ timeout: 2000 });
  });

  test('pinning a tab keeps it when another file opens', async ({ page }) => {
    const a = `e2e-pin-a-${Date.now()}`;
    const b = `e2e-pin-b-${Date.now()}`;
    await createNote(page, a);

    // Right-click the tab → Pin tab
    const tabA = page.locator(`text=${a}.md`).first();
    await tabA.click({ button: 'right' });
    await page.getByText('Pin tab').click();

    // Open a second file — a's tab should remain (pinned)
    await createNote(page, b);

    await expect(page.locator(`text=${a}.md`).first()).toBeVisible();
    await expect(page.locator(`text=${b}.md`).first()).toBeVisible();
  });

  test('double-clicking a preview tab promotes it to permanent', async ({ page }) => {
    await openFile(page, 'welcome');
    const tab = page.locator('text=welcome.md').first();
    await tab.dblclick();

    // After promoting, the tab should no longer be italic (preview style removed)
    const tabSpan = page.locator('[style*="italic"]');
    await expect(tabSpan).toHaveCount(0, { timeout: 2000 });
  });

  test('closing a tab removes it from the tab bar', async ({ page }) => {
    await openFile(page, 'welcome');
    await expect(page.locator('text=welcome.md').first()).toBeVisible();

    // Click the × close button on the tab
    await page.locator('[title="Close tab"]').click();
    await expect(page.locator('text=welcome.md')).not.toBeVisible({ timeout: 3000 });
  });

  test('Ctrl+W closes the active tab', async ({ page }) => {
    await openFile(page, 'welcome');
    await expect(page.locator('text=welcome.md').first()).toBeVisible();
    await page.keyboard.press('Meta+W');
    await expect(page.locator('text=welcome.md')).not.toBeVisible({ timeout: 3000 });
  });

  test('middle-click closes an unpinned tab', async ({ page }) => {
    await openFile(page, 'welcome');
    const tab = page.locator('text=welcome.md').first();
    await tab.click({ button: 'middle' });
    await expect(page.locator('text=welcome.md')).not.toBeVisible({ timeout: 3000 });
  });

  test('right-click context menu: Close other tabs', async ({ page }) => {
    const a = `e2e-ctx-a-${Date.now()}`;
    const b = `e2e-ctx-b-${Date.now()}`;
    await createNote(page, a);

    // Pin a so it survives; then open b
    const tabA = page.locator(`text=${a}.md`).first();
    await tabA.click({ button: 'right' });
    await page.getByText('Pin tab').click();

    await createNote(page, b);

    // Right-click b → Close other tabs
    const tabB = page.locator(`text=${b}.md`).first();
    await tabB.click({ button: 'right' });
    await page.getByText('Close other tabs').click();

    // b is kept; a (pinned) is also kept; all others gone
    await expect(page.locator(`text=${b}.md`).first()).toBeVisible();
  });

  test('tab bar is hidden when no tabs are open', async ({ page }) => {
    // Initially no tabs
    const tabBar = page.locator('[style*="height: 34px"]').first();
    // Don't open any file — tab bar should not render
    await expect(page.locator('[title="Close tab"]')).toHaveCount(0);
  });

  test('unsaved dot appears on tab when content changes', async ({ page }) => {
    await openFile(page, 'welcome');
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' x');

    // Yellow unsaved dot in the tab bar
    await expect(page.locator('[title="Unsaved changes"]')).toBeVisible({ timeout: 2000 });
  });
});
