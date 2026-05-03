const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');
const matter = require('gray-matter');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;

// --- Config ---
const CONFIG_FILE = path.resolve('./config.json');

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {
      notesDir: './notes',
      templatesDir: './templates',
      templatePaths: {
        'daily-note': 'Daily/{{date}}.md',
        'meeting-note': 'Meetings/{{date}}-{{slug}}.md',
        'blank': '{{title}}.md',
      },
    };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// Remove a top-level YAML key (and its indented children) from a frontmatter
// block using line-by-line text manipulation — no YAML parse/stringify, so date
// strings, special values etc. are never coerced to JS types and back.
function stripFrontmatterKey(raw, key) {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) return raw;
  const closeIdx = raw.indexOf('\n---', 4);
  if (closeIdx === -1) return raw;

  const fmLines = raw.slice(4, closeIdx).split('\n');
  const after   = raw.slice(closeIdx); // keeps the '\n---\n' and body

  const keyRe = new RegExp(`^${key}\\s*:`);
  const filtered = [];
  let skipping = false; // currently inside the block to remove

  for (let i = 0; i < fmLines.length; i++) {
    const line = fmLines[i];

    if (!skipping) {
      if (keyRe.test(line)) { skipping = true; continue; }
      filtered.push(line);
      continue;
    }

    // Inside the block: skip blank lines and any line that is indented
    // (blank lines can appear inside YAML literal/folded block scalars)
    if (line.trim() === '') continue;
    if (/^[ \t]/.test(line)) continue;

    // Non-empty, non-indented line — we've left the block
    skipping = false;
    filtered.push(line);
  }

  return '---\n' + filtered.join('\n') + after;
}

// Mutable — updated live when config is changed via the settings UI
let cfg = loadConfig();
// Env-var overrides allow the test runner to point at an isolated directory
let NOTES_DIR = process.env.NB_NOTES_DIR
  ? path.resolve(process.env.NB_NOTES_DIR)
  : path.resolve(expandHome(cfg.notesDir));
let TEMPLATES_DIR = process.env.NB_TEMPLATES_DIR
  ? path.resolve(process.env.NB_TEMPLATES_DIR)
  : path.resolve(expandHome(cfg.templatesDir));

function ensureDirs() {
  if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}
ensureDirs();

app.use(cors());
app.use(express.json());

// --- WebSocket ---
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected' }));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

// --- File watcher (re-created when notes dir changes) ---
let watcher = null;

function startWatcher(dir) {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (!fs.existsSync(dir)) return;
  watcher = chokidar.watch(dir, { ignoreInitial: true, persistent: true });
  watcher.on('all', () => broadcast({ type: 'tree-change' }));
}

startWatcher(NOTES_DIR);

// --- Git auto-commit ---
// Commit each file save. Uses the git repo that contains NOTES_DIR.

function gitCommitFile(filePath) {
  // Use NOTES_DIR as the -C dir; git walks up to find the repo root automatically.
  const repoDir = NOTES_DIR;
  const rel = path.relative(repoDir, filePath);

  // Step 1: stage the file
  exec(`git -C ${JSON.stringify(repoDir)} add ${JSON.stringify(filePath)}`, (addErr, _out, addStderr) => {
    if (addErr) {
      console.error('[git] add failed:', (addStderr || addErr.message).trim());
      return;
    }
    // Step 2: check whether anything is actually staged before committing
    exec(`git -C ${JSON.stringify(repoDir)} diff --cached --quiet`, (diffErr) => {
      // exit 0 = nothing staged (file unchanged) — skip silently
      if (!diffErr) return;
      // exit 1 = staged changes exist — commit
      const msg = `notes: update ${rel}`;
      exec(`git -C ${JSON.stringify(repoDir)} commit -m ${JSON.stringify(msg)}`, (commitErr, _o, commitStderr) => {
        if (commitErr) {
          console.error('[git] commit failed:', (commitStderr || commitErr.message).trim());
          return;
        }
        console.log('[git] committed:', rel);
      });
    });
  });
}

// --- Path safety ---
function safePath(inputPath, baseDir) {
  let resolved;
  if (path.isAbsolute(inputPath)) {
    resolved = path.resolve(inputPath);
  } else {
    resolved = path.resolve(baseDir, inputPath);
  }
  // Read current dirs each call so changes take effect immediately
  const notesResolved = path.resolve(NOTES_DIR);
  const templatesResolved = path.resolve(TEMPLATES_DIR);
  if (!resolved.startsWith(notesResolved) && !resolved.startsWith(templatesResolved)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// --- Build file tree ---
// skipPaths: Set of absolute paths to exclude (e.g. templatesDir)
// Only .md files are included; hidden entries (starting with '.') are always skipped.
function buildTree(dirPath, skipPaths) {
  const name = path.basename(dirPath);
  if (name.startsWith('.')) return null; // skip .git, .DS_Store, etc.
  const stat = fs.statSync(dirPath);
  if (stat.isDirectory()) {
    if (skipPaths && skipPaths.has(dirPath)) return null;
    let children = [];
    try {
      children = fs.readdirSync(dirPath)
        .map((entry) => {
          try { return buildTree(path.join(dirPath, entry), skipPaths); } catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    } catch { children = []; }
    return { name, path: dirPath, type: 'dir', children };
  }
  // Only show markdown and canvas files
  if (!name.endsWith('.md') && !name.endsWith('.canvas')) return null;
  return { name, path: dirPath, type: 'file' };
}

// --- API Routes ---

// GET /api/config
app.get('/api/config', (req, res) => {
  try {
    res.json({ ...loadConfig(), _resolved: { notesDir: NOTES_DIR, templatesDir: TEMPLATES_DIR } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config — saves config and applies directory changes live
app.put('/api/config', (req, res) => {
  try {
    const incoming = req.body;
    // Preserve templatePaths and any other keys not sent by the UI
    const current = loadConfig();
    const merged = { ...current, ...incoming };
    saveConfig(merged);
    cfg = merged;

    const newNotesDir = path.resolve(expandHome(cfg.notesDir));
    const newTemplatesDir = path.resolve(expandHome(cfg.templatesDir));
    const notesDirChanged = newNotesDir !== NOTES_DIR;

    NOTES_DIR = newNotesDir;
    TEMPLATES_DIR = newTemplatesDir;
    ensureDirs();

    if (notesDirChanged) {
      startWatcher(NOTES_DIR);
      broadcast({ type: 'tree-change' });
    }

    res.json({ success: true, notesDir: NOTES_DIR, templatesDir: TEMPLATES_DIR });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/resolve?name=NoteName — find a note file by name (for wiki links)
app.get('/api/resolve', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name required' });
  function search(dir) {
    try {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            const found = search(full);
            if (found) return found;
          } else if (
            entry === name ||
            entry === name + '.md' ||
            entry.replace(/\.md$/, '') === name
          ) {
            return full;
          }
        } catch { continue; }
      }
    } catch { }
    return null;
  }
  const found = search(NOTES_DIR);
  if (found) res.json({ path: found });
  else res.status(404).json({ error: 'Note not found' });
});

// GET /api/tree
app.get('/api/tree', (req, res) => {
  try {
    const rootParam = req.query.root;
    const rootDir = rootParam ? path.resolve(rootParam) : NOTES_DIR;
    if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });
    // Exclude the templates directory — it's shown separately in the sidebar
    const skipPaths = new Set([path.resolve(TEMPLATES_DIR)]);
    res.json(buildTree(rootDir, skipPaths));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/file
app.get('/api/file', (req, res) => {
  try {
    const filePath = safePath(req.query.path, NOTES_DIR);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/file
app.put('/api/file', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    const safe = safePath(filePath, NOTES_DIR);
    const dir = path.dirname(safe);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(safe, content ?? '', 'utf-8');
    res.json({ success: true, path: safe });
    // Commit asynchronously — don't block the save response
    gitCommitFile(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/file
app.delete('/api/file', (req, res) => {
  try {
    const filePath = safePath(req.query.path, NOTES_DIR);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true });
    else fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/mkdir
app.post('/api/mkdir', (req, res) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'path required' });
    const safe = safePath(dirPath, NOTES_DIR);
    fs.mkdirSync(safe, { recursive: true });
    res.json({ success: true, path: safe });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rename
app.post('/api/rename', (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });
    const safeOld = safePath(oldPath, NOTES_DIR);
    const safeNew = safePath(newPath, NOTES_DIR);
    if (!fs.existsSync(safeOld)) return res.status(404).json({ error: 'Source not found' });
    const newDir = path.dirname(safeNew);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(safeOld, safeNew);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/search
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const searchDir = NOTES_DIR;
    const results = [];
    const query = q.toLowerCase();

    function searchDir_(dir) {
      let entries;
      try { entries = fs.readdirSync(dir); } catch { return; }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        let stat;
        try { stat = fs.statSync(fullPath); } catch { continue; }
        if (stat.isDirectory()) {
          searchDir_(fullPath);
        } else if (entry.endsWith('.md')) {
          const nameMatch = entry.toLowerCase().includes(query);
          let snippet = '';
          let contentMatch = false;
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lower = content.toLowerCase();
            const idx = lower.indexOf(query);
            if (idx !== -1) {
              contentMatch = true;
              const start = Math.max(0, idx - 60);
              const end = Math.min(content.length, idx + query.length + 60);
              snippet = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
            }
          } catch { /* skip */ }
          if (nameMatch || contentMatch) results.push({ path: fullPath, name: entry, snippet });
        }
      }
    }

    searchDir_(searchDir);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/templates
app.get('/api/templates', (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) return res.json([]);
    const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.md'));
    const templates = files.map((f) => {
      const raw = fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf-8');
      const parsed = matter(raw);
      return {
        name: f.replace(/\.md$/, ''),
        filename: f,
        path: path.join(TEMPLATES_DIR, f),
        shortcuts: parsed.data._shortcuts || [],
        tags: parsed.data.tags || [],
      };
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/template
app.post('/api/template', (req, res) => {
  try {
    const { templateName, outputPath, vars } = req.body;
    if (!templateName || !outputPath) {
      return res.status(400).json({ error: 'templateName and outputPath required' });
    }
    const templateFile = path.join(TEMPLATES_DIR, templateName.endsWith('.md') ? templateName : `${templateName}.md`);
    if (!fs.existsSync(templateFile)) return res.status(404).json({ error: 'Template not found' });

    const rawTemplate = fs.readFileSync(templateFile, 'utf-8');

    // Build replacements first
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const replacements = {
      '{{date}}': date,
      '{{time}}': time,
      '{{datetime}}': `${date} ${time}`,
      '{{title}}': vars?.title || 'Untitled',
      '{{year}}': String(now.getFullYear()),
      '{{month}}': pad(now.getMonth() + 1),
      '{{day}}': pad(now.getDate()),
      '{{weekday}}': weekdays[now.getDay()],
    };
    // Allow callers to pass extra {{custom}} vars — keys must already include the braces
    // to avoid accidentally replacing substrings inside already-substituted values.
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        const wrapped = k.startsWith('{{') ? k : `{{${k}}}`;
        if (!replacements[wrapped]) replacements[wrapped] = String(v);
      }
    }

    // Step 1: substitute all {{variables}} on the raw string first, so YAML
    // never sees tokens like {{date}} which it misparses as flow mappings.
    let content = rawTemplate;
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.split(placeholder).join(value);
    }

    // Step 2: strip _shortcuts from the frontmatter using plain text manipulation.
    // We deliberately avoid a parse→delete→stringify roundtrip because gray-matter
    // coerces bare dates (2026-05-01) to JS Date objects, then serialises them back
    // as timestamps — corrupting the frontmatter.
    content = stripFrontmatterKey(content, '_shortcuts');

    const safeOut = safePath(outputPath, NOTES_DIR);

    // Guard against silent overwrites — require explicit ?overwrite=true
    if (fs.existsSync(safeOut) && req.body.overwrite !== true) {
      return res.status(409).json({ error: 'File already exists', path: safeOut });
    }

    const outDir = path.dirname(safeOut);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(safeOut, content, 'utf-8');
    res.json({ success: true, path: safeOut, content });
    // Commit the new file asynchronously
    gitCommitFile(safeOut);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/git/log', (req, res) => {
  try {
    const filePath = safePath(req.query.path, NOTES_DIR);
    const repoDir = NOTES_DIR;
    exec(`git -C ${JSON.stringify(repoDir)} rev-parse --show-toplevel`, (err, topLevel) => {
      if (err) return res.status(500).json({ error: 'Not a git repository' });
      const repoRoot = topLevel.trim();
      const relToRoot = path.relative(repoRoot, filePath);
      exec(`git -C ${JSON.stringify(repoRoot)} log --pretty=format:"%H|%ai|%s" -- ${JSON.stringify(relToRoot)}`, (err2, stdout, stderr2) => {
        if (err2) return res.status(500).json({ error: (stderr2 || err2.message).trim() });
        const commits = stdout.trim().split('\n').filter(Boolean).map(line => {
          const idx1 = line.indexOf('|');
          const idx2 = line.indexOf('|', idx1 + 1);
          return {
            hash: line.slice(0, idx1),
            date: line.slice(idx1 + 1, idx2).trim(),
            message: line.slice(idx2 + 1).trim(),
          };
        });
        res.json(commits);
      });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/git/show', (req, res) => {
  try {
    const filePath = safePath(req.query.path, NOTES_DIR);
    const hash = req.query.hash;
    if (!hash || !/^[0-9a-f]{7,40}$/i.test(hash)) return res.status(400).json({ error: 'Invalid hash' });
    const repoDir = NOTES_DIR;
    exec(`git -C ${JSON.stringify(repoDir)} rev-parse --show-toplevel`, (err, topLevel) => {
      if (err) return res.status(500).json({ error: 'Not a git repository' });
      const repoRoot = topLevel.trim();
      const relToRoot = path.relative(repoRoot, filePath);
      exec(`git -C ${JSON.stringify(repoRoot)} show ${JSON.stringify(hash + ':' + relToRoot)}`, (err2, stdout, stderr2) => {
        if (err2) return res.status(500).json({ error: (stderr2 || err2.message).trim() });
        res.type('text/plain').send(stdout);
      });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`  Notes:     ${NOTES_DIR}`);
  console.log(`  Templates: ${TEMPLATES_DIR}`);
});
