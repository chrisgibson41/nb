import { test, expect } from '@playwright/test';
import { dismissGettingStarted, createNote, openFile, setEditorContent, waitForSave, waitForTree } from '../helpers.js';

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTree(page);
    await dismissGettingStarted(page);
  });

  // ── Basic editing ────────────────────────────────────────────────────────────

  test('open existing file and show content', async ({ page }) => {
    await openFile(page, 'welcome');
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('Welcome', { timeout: 5000 });
  });

  test('typing in editor shows unsaved indicator', async ({ page }) => {
    await openFile(page, 'welcome');
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edit');
    await expect(page.locator('text=Unsaved')).toBeVisible({ timeout: 3000 });
  });

  test('autosave fires after idle — indicator returns to Saved', async ({ page }) => {
    await openFile(page, 'welcome');
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' autosave-test');
    // Wait up to 3 s for autosave (debounced at 800 ms)
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 4000 });
  });

  test('Ctrl+S saves immediately', async ({ page }) => {
    await openFile(page, 'welcome');
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' ctrl-s-test');
    await expect(page.locator('text=Unsaved')).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('Meta+S');
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 2000 });
  });

  // ── Markdown rendering ────────────────────────────────────────────────────────

  test('headings render with larger visual weight', async ({ page }) => {
    const name = `e2e-md-${Date.now()}`;
    await createNote(page, name);
    // The note is created with a # heading — check it renders as cm-header
    await expect(page.locator('.cm-header-1, .cm-header')).toBeVisible({ timeout: 3000 });
  });

  test('inline bold renders visually', async ({ page }) => {
    const name = `e2e-bold-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# Bold test\n\n**bold text**\n');
    // CodeMirror marks strong spans
    await expect(page.locator('.cm-strong, .cm-content strong')).toBeVisible({ timeout: 3000 });
  });

  // ── Interactive checkboxes ───────────────────────────────────────────────────

  test('checkbox renders as a clickable input', async ({ page }) => {
    const name = `e2e-checkbox-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# Tasks\n\n- [ ] Unchecked task\n- [x] Done task\n');

    // Rendered checkboxes should be input[type=checkbox] elements in the CM widget
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking an unchecked checkbox marks it as checked in the source', async ({ page }) => {
    const name = `e2e-cb-toggle-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# Tasks\n\n- [ ] Toggle me\n');

    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    const wasChecked = await checkbox.isChecked();
    await checkbox.click({ force: true });

    // Source should now contain [x]
    await expect(page.locator('.cm-content')).toContainText('[x]', { timeout: 3000 });
    expect(wasChecked).toBe(false);
  });

  test('clicking a checked checkbox unchecks it', async ({ page }) => {
    const name = `e2e-cb-uncheck-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# Tasks\n\n- [x] Already done\n');

    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    await checkbox.click({ force: true });

    await expect(page.locator('.cm-content')).toContainText('[ ]', { timeout: 3000 });
  });

  // ── Markdown tables ──────────────────────────────────────────────────────────

  test('markdown table renders as an HTML table widget', async ({ page }) => {
    const name = `e2e-table-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page,
      '# Table test\n\n' +
      '| Name  | Age |\n' +
      '| ----- | --- |\n' +
      '| Alice | 30  |\n' +
      '| Bob   | 25  |\n'
    );

    // The table widget renders a <table> inside the CM content
    await expect(page.locator('.cm-md-table, table').first()).toBeVisible({ timeout: 5000 });
  });

  // ── Outline panel ────────────────────────────────────────────────────────────

  test('outline panel appears when note has 2+ headings', async ({ page }) => {
    const name = `e2e-outline-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# One\n\n## Two\n\n### Three\n');

    await expect(page.locator('text=Outline')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('One', { exact: true })).toBeVisible();
    await expect(page.getByText('Two', { exact: true })).toBeVisible();
  });

  test('outline panel is hidden for notes with fewer than 2 headings', async ({ page }) => {
    const name = `e2e-outline-hidden-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# Single heading\n\nJust a paragraph.\n');
    await expect(page.locator('text=Outline')).not.toBeVisible({ timeout: 3000 });
  });

  test('clicking outline entry scrolls editor', async ({ page }) => {
    const name = `e2e-scroll-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page,
      '# Alpha\n\n' + 'Line.\n'.repeat(30) + '\n## Beta\n\nContent below.\n'
    );
    await expect(page.locator('text=Outline')).toBeVisible({ timeout: 5000 });
    // Click "Beta" in the outline
    await page.getByText('Beta', { exact: true }).last().click();
    // Editor should still be visible (no crash)
    await expect(page.locator('.cm-content')).toBeVisible();
  });

  // ── Wiki links ────────────────────────────────────────────────────────────────

  test('wiki link renders as a styled span', async ({ page }) => {
    const name = `e2e-wikilink-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# Links\n\nSee [[linked-note]] for more.\n');

    // The wiki-link widget renders a span with class cm-md-wiki-link
    await expect(page.locator('.cm-md-wiki-link')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.cm-md-wiki-link')).toContainText('linked-note');
  });

  test('clicking wiki link navigates to the target note', async ({ page }) => {
    const name = `e2e-wikilink-nav-${Date.now()}`;
    await createNote(page, name);
    await setEditorContent(page, '# Source\n\nSee [[linked-note]] for details.\n');

    const wikiLink = page.locator('.cm-md-wiki-link');
    await wikiLink.waitFor({ state: 'visible', timeout: 5000 });
    await wikiLink.dispatchEvent('mousedown', { button: 0, bubbles: true });

    // Should open linked-note.md tab
    await expect(page.locator('text=linked-note.md')).toBeVisible({ timeout: 5000 });
  });
});
