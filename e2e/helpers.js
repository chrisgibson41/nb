/**
 * Shared E2E helpers.
 * Import from test files: import { openFile, createNote, ... } from '../helpers.js'
 */

/** Wait for the file tree to fully load (spinner gone, at least one item visible) */
export async function waitForTree(page) {
  await page.waitForSelector('[title="Refresh"]');
  // Wait for the loading state to clear
  await page.waitForFunction(() => {
    const msg = document.querySelector('[style*="Loading"]');
    return !msg;
  }, { timeout: 5000 }).catch(() => {});
}

/** Click a file by its display name (without extension) in the file tree */
export async function openFile(page, nameWithoutExt) {
  await page.getByText(nameWithoutExt, { exact: true }).first().click();
  // Wait for the tab to appear
  await page.waitForSelector(`[title*="${nameWithoutExt}"]`, { timeout: 5000 });
}

/** Create a new note via the toolbar button → InputModal */
export async function createNote(page, filename) {
  await page.getByTitle('New note').click();
  await page.waitForSelector('text=New file name:');
  const input = page.locator('input').last(); // portal input is last in DOM
  await input.clear();
  await input.fill(filename.replace(/\.md$/, ''));
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForSelector(`text=${filename}`, { timeout: 5000 });
}

/** Create a new folder via the toolbar button */
export async function createFolder(page, folderName) {
  await page.getByTitle('New folder').click();
  await page.waitForSelector('text=New folder name:');
  const input = page.locator('input').last();
  await input.clear();
  await input.fill(folderName);
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForSelector(`text=${folderName}`, { timeout: 5000 });
}

/** Type content into the CodeMirror editor */
export async function typeInEditor(page, text) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await editor.pressSequentially(text, { delay: 20 });
}

/** Select all and replace editor content */
export async function setEditorContent(page, text) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await editor.pressSequentially(text, { delay: 15 });
}

/** Wait for autosave (the dot turns from yellow to grey) */
export async function waitForSave(page) {
  // Saved indicator: text says "Saved" and dot is grey
  await page.waitForSelector('text=Saved', { timeout: 5000 });
}

/** Dismiss the Getting Started page if it appears */
export async function dismissGettingStarted(page) {
  const closeBtn = page.locator('button[title="Close"]').first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForSelector('text=Select a file to start editing', { timeout: 3000 }).catch(() => {});
  }
}
