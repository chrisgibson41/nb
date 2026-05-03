import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  // Create a clean, isolated notes + templates dir for every E2E run
  const testNotesDir     = path.join(__dirname, 'test-notes');
  const testTemplatesDir = path.join(__dirname, 'test-templates');

  // Wipe and recreate
  if (fs.existsSync(testNotesDir))     fs.rmSync(testNotesDir,     { recursive: true });
  if (fs.existsSync(testTemplatesDir)) fs.rmSync(testTemplatesDir, { recursive: true });
  fs.mkdirSync(testNotesDir,     { recursive: true });
  fs.mkdirSync(testTemplatesDir, { recursive: true });

  // Seed a minimal template so the ShortcutsPanel tests have something to work with
  const tplBody = [
    '---',
    'tags: [daily]',
    '_shortcuts:',
    '  - label: Meetings',
    '    singularLabel: Meeting',
    '    section: Meetings',
    '    heading: "{{title}}"',
    '    body: "**Attendees:**\\n\\n**Notes:**\\n"',
    '  - label: Tasks',
    '    singularLabel: Task',
    '    section: Tasks',
    '    heading: "{{title}}"',
    '    body: ""',
    '---',
    '# Daily Note',
    '',
    '## Meetings',
    '',
    '## Tasks',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(testTemplatesDir, 'daily-note.md'), tplBody);

  // Seed a few starter notes
  fs.writeFileSync(
    path.join(testNotesDir, 'welcome.md'),
    '# Welcome\n\nThis is a seed note for E2E tests.\n'
  );
  fs.writeFileSync(
    path.join(testNotesDir, 'linked-note.md'),
    '# Linked Note\n\nThis note is the target of a wiki link.\n'
  );

  // Expose paths to tests via process.env (Playwright forwards these)
  process.env.NB_NOTES_DIR     = testNotesDir;
  process.env.NB_TEMPLATES_DIR = testTemplatesDir;

  console.log('[E2E setup] test notes dir:', testNotesDir);
}
