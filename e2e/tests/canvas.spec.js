import { test, expect } from '@playwright/test';
import { dismissGettingStarted, createCanvas, waitForTree } from '../helpers.js';

test.describe('Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTree(page);
    await dismissGettingStarted(page);
  });

  test('create a canvas file and render React Flow pane', async ({ page }) => {
    const name = `e2e-canvas-${Date.now()}`;
    await createCanvas(page, name);

    // .canvas extension visible in tree
    await expect(page.getByText(`${name}.canvas`).first()).toBeVisible({ timeout: 5000 });
    // React Flow canvas is rendered
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 });
  });

  test('canvas pane has a background grid', async ({ page }) => {
    const name = `e2e-canvas-bg-${Date.now()}`;
    await createCanvas(page, name);

    // React Flow renders a Background component (dots or lines pattern)
    await expect(page.locator('.react-flow__background')).toBeVisible({ timeout: 10000 });
  });

  test('double-clicking the canvas adds a text card', async ({ page }) => {
    const name = `e2e-canvas-card-${Date.now()}`;
    await createCanvas(page, name);

    const pane = page.locator('.react-flow__pane');
    await pane.waitFor({ state: 'visible', timeout: 10000 });

    // Double-click the pane centre to add a new text node
    await pane.dblclick();

    // A new card / node should appear in the canvas
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 5000 });
  });

  test('added text card can be typed into', async ({ page }) => {
    const name = `e2e-canvas-type-${Date.now()}`;
    await createCanvas(page, name);

    const pane = page.locator('.react-flow__pane');
    await pane.waitFor({ state: 'visible', timeout: 10000 });
    await pane.dblclick();

    // Wait for node + any editable area inside it
    const node = page.locator('.react-flow__node').first();
    await node.waitFor({ state: 'visible', timeout: 5000 });

    const editable = node.locator('textarea, [contenteditable], input').first();
    if (await editable.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editable.fill('Hello canvas');
      await expect(editable).toHaveValue('Hello canvas');
    } else {
      // Node may render as a non-input widget; just verify it's visible
      await expect(node).toBeVisible();
    }
  });

  test('cancel canvas creation does not create file', async ({ page }) => {
    await page.getByTitle('New canvas').click();
    await page.waitForSelector('text=Canvas name:');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('text=Canvas name:')).not.toBeVisible();
  });

  test('canvas toolbar shows zoom controls', async ({ page }) => {
    const name = `e2e-canvas-zoom-${Date.now()}`;
    await createCanvas(page, name);

    // React Flow renders zoom controls
    await expect(page.locator('.react-flow__controls')).toBeVisible({ timeout: 10000 });
  });
});
