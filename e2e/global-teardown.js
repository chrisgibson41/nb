import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalTeardown() {
  const testNotesDir     = path.join(__dirname, 'test-notes');
  const testTemplatesDir = path.join(__dirname, 'test-templates');

  if (fs.existsSync(testNotesDir))     fs.rmSync(testNotesDir,     { recursive: true });
  if (fs.existsSync(testTemplatesDir)) fs.rmSync(testTemplatesDir, { recursive: true });

  console.log('[E2E teardown] cleaned up test notes dir');
}
