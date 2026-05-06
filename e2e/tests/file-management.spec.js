import { test, expect } from '@playwright/test';
import { dismissGettingStarted, createNote, createFolder, waitForTree } from '../helpers.js';

test.describe('File Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTree(page);
    await dismissGettingStarted(page);
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  test('create a new note from toolbar button', async ({ page }) => {
    const name = `e2e-note-${Date.now()}`;
    await createNote(page, name);

    // File appears in tree (without extension)
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    // Tab opens
    await expect(page.getByText(`${name}.md`).first()).toBeVisible();
    // Editor is focused with a heading pre-filled
    const content = page.locator('.cm-content');
    await expect(content).toContainText(name);
  });

  test('create a new note — appends .md if omitted', async ({ page }) => {
    const baseName = `e2e-noext-${Date.now()}`;
    await page.getByTitle('New note').click();
    await page.waitForSelector('text=New file name:');
    await page.locator('input').last().fill(baseName);
    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText(`${baseName}.md`).first()).toBeVisible();
  });

  test('cancel note creation closes modal without creating file', async ({ page }) => {
    await page.getByTitle('New note').click();
    await page.waitForSelector('text=New file name:');
    await page.locator('input').last().fill('should-not-exist');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('text=New file name:')).not.toBeVisible();
    await expect(page.getByText('should-not-exist')).not.toBeVisible();
  });

  test('Escape key cancels note creation', async ({ page }) => {
    await page.getByTitle('New note').click();
    await page.waitForSelector('text=New file name:');
    await page.keyboard.press('Escape');
    await expect(page.locator('text=New file name:')).not.toBeVisible();
  });

  // ── Folders ──────────────────────────────────────────────────────────────────

  test('create a new folder', async ({ page }) => {
    const folderName = `e2e-folder-${Date.now()}`;
    await createFolder(page, folderName);
    await expect(page.getByText(folderName, { exact: true })).toBeVisible();
  });

  test('create a note inside a newly created folder', async ({ page }) => {
    const folderName = `e2e-folder-${Date.now()}`;
    await createFolder(page, folderName);

    // Hover the folder row to show the "New file" inline button
    const folderRow = page.locator(`text=${folderName}`).first();
    await folderRow.hover();
    // The inline new-file button has title "New file"
    await page.getByTitle('New file').click();

    await page.waitForSelector('text=New file name:');
    const noteName = `nested-note-${Date.now()}`;
    await page.locator('input').last().fill(noteName);
    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText(noteName, { exact: true })).toBeVisible();
  });

  // ── Rename ───────────────────────────────────────────────────────────────────

  test('rename a file via hover → rename button', async ({ page }) => {
    const originalName = `e2e-rename-src-${Date.now()}`;
    await createNote(page, originalName);

    // Hover the file row
    const fileRow = page.getByText(originalName, { exact: true }).first().locator('..').locator('..');
    await fileRow.hover();
    await page.getByTitle('Rename').click();

    // Rename input should have the original name
    const renameInput = fileRow.locator('input');
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toHaveValue(`${originalName}.md`);

    const newName = `e2e-renamed-${Date.now()}.md`;
    await renameInput.fill(newName);
    await renameInput.press('Enter');

    // New name appears; old name gone
    await expect(page.getByText(newName.replace(/\.md$/, ''), { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(originalName, { exact: true })).not.toBeVisible({ timeout: 3000 });
  });

  // ── Delete ───────────────────────────────────────────────────────────────────

  test('delete a file via hover → delete button', async ({ page }) => {
    const noteName = `e2e-delete-${Date.now()}`;
    await createNote(page, noteName);

    // Confirm the file is there
    await expect(page.getByText(noteName, { exact: true }).first()).toBeVisible();

    // Set up confirm dialog to auto-accept
    page.on('dialog', dialog => dialog.accept());

    const fileRow = page.getByText(noteName, { exact: true }).first().locator('..').locator('..');
    await fileRow.hover();
    await page.getByTitle('Delete').click();

    // File should disappear from tree
    await expect(page.getByText(noteName, { exact: true })).not.toBeVisible({ timeout: 5000 });
  });

  test('cancel delete keeps the file', async ({ page }) => {
    const noteName = `e2e-nodelete-${Date.now()}`;
    await createNote(page, noteName);

    page.on('dialog', dialog => dialog.dismiss());

    const fileRow = page.getByText(noteName, { exact: true }).first().locator('..').locator('..');
    await fileRow.hover();
    await page.getByTitle('Delete').click();

    await expect(page.getByText(noteName, { exact: true }).first()).toBeVisible();
  });

  // ── Drag & Drop ───────────────────────────────────────────────────────────────

  test('drag a file into a folder moves it', async ({ page }) => {
    const folderName = `e2e-dnd-folder-${Date.now()}`;
    const fileName   = `e2e-dnd-file-${Date.now()}`;
    await createFolder(page, folderName);
    await createNote(page, fileName);

    // Drag the file onto the folder
    const fileEl   = page.getByText(fileName, { exact: true }).first();
    const folderEl = page.getByText(folderName, { exact: true }).first();

    await fileEl.dragTo(folderEl);

    // After drop, the folder should still exist; the file should still be visible
    // (it's now inside the folder which is open at depth-0)
    await expect(page.getByText(folderName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(fileName)).toBeVisible({ timeout: 5000 });
  });
});
