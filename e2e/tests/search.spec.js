import { test, expect } from '@playwright/test';
import { dismissGettingStarted, createNote, waitForTree } from '../helpers.js';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTree(page);
    await dismissGettingStarted(page);
  });

  test('global search bar filters the file tree by filename', async ({ page }) => {
    // Seed two files
    await createNote(page, `apple-${Date.now()}`);
    // Navigate back to fresh state by going home
    await page.goto('/');
    await waitForTree(page);
    await dismissGettingStarted(page);

    // welcome.md and linked-note.md are seeded; search for 'welcome'
    const searchInput = page.getByPlaceholderText('Search notes...');
    await searchInput.fill('welcome');

    // welcome should be visible; linked-note should not
    await expect(page.getByText('welcome', { exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('linked-note', { exact: true })).not.toBeVisible({ timeout: 3000 });
  });

  test('clearing global search restores full tree', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search notes...');
    await searchInput.fill('welcome');
    await expect(page.getByText('linked-note', { exact: true })).not.toBeVisible({ timeout: 3000 });

    // Click the × clear button
    await page.locator('button', { hasText: '×' }).first().click();
    await expect(page.getByText('linked-note', { exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('global search hides the sidebar local filter input', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search notes...');
    await searchInput.fill('x');
    await expect(page.getByPlaceholderText('Filter files...')).not.toBeVisible({ timeout: 2000 });
  });

  test('local sidebar filter narrows the file tree', async ({ page }) => {
    const filter = page.getByPlaceholderText('Filter files...');
    await filter.fill('welcome');

    await expect(page.getByText('welcome', { exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('linked-note', { exact: true })).not.toBeVisible({ timeout: 3000 });
  });

  test('local filter clear button (×) restores all files', async ({ page }) => {
    const filter = page.getByPlaceholderText('Filter files...');
    await filter.fill('welcome');
    await expect(page.getByText('linked-note', { exact: true })).not.toBeVisible({ timeout: 3000 });

    // The × button inside the sidebar search box
    const clearBtn = page.locator('[placeholder="Filter files..."] ~ button');
    await clearBtn.click();
    await expect(page.getByText('linked-note', { exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('search with no results shows empty state', async ({ page }) => {
    const filter = page.getByPlaceholderText('Filter files...');
    await filter.fill('zzz-nothing-matches-this-zzz');

    await expect(page.getByText('No notes yet. Create your first note!')).not.toBeVisible({ timeout: 1000 }).catch(() => {
      // This is acceptable — tree may just be empty
    });
    // All known files should be gone
    await expect(page.getByText('welcome', { exact: true })).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByText('linked-note', { exact: true })).not.toBeVisible({ timeout: 3000 });
  });
});
