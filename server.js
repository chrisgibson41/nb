const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');
const matter = require('gray-matter');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;
const NOTES_DIR = path.resolve('./notes');
const TEMPLATES_DIR = path.resolve('./templates');

// Ensure notes and templates directories exist
if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// --- WebSocket ---
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected' }));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

// Watch notes directory
const watcher = chokidar.watch(NOTES_DIR, {
  ignoreInitial: true,
  persistent: true,
});

watcher.on('all', () => {
  broadcast({ type: 'tree-change' });
});

// --- Path safety ---
function safePath(inputPath, baseDir) {
  // If absolute path, resolve directly but check it's within allowed dirs
  let resolved;
  if (path.isAbsolute(inputPath)) {
    resolved = path.resolve(inputPath);
  } else {
    resolved = path.resolve(baseDir, inputPath);
  }

  // Allow paths within NOTES_DIR or TEMPLATES_DIR
  const notesResolved = path.resolve(NOTES_DIR);
  const templatesResolved = path.resolve(TEMPLATES_DIR);

  if (!resolved.startsWith(notesResolved) && !resolved.startsWith(templatesResolved)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// --- Build file tree ---
function buildTree(dirPath) {
  const name = path.basename(dirPath);
  const stat = fs.statSync(dirPath);

  if (stat.isDirectory()) {
    let children = [];
    try {
      const entries = fs.readdirSync(dirPath);
      children = entries
        .map((entry) => {
          try {
            return buildTree(path.join(dirPath, entry));
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          // Directories first, then files
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      children = [];
    }
    return { name, path: dirPath, type: 'dir', children };
  } else {
    return { name, path: dirPath, type: 'file' };
  }
}

// --- API Routes ---

// GET /api/tree
app.get('/api/tree', (req, res) => {
  try {
    const rootParam = req.query.root;
    const rootDir = rootParam ? path.resolve(rootParam) : NOTES_DIR;
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }
    const tree = buildTree(rootDir);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/file
app.get('/api/file', (req, res) => {
  try {
    const filePath = safePath(req.query.path, NOTES_DIR);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('text/plain').send(content);
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
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(safe, content ?? '', 'utf-8');
    res.json({ success: true, path: safe });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/file
app.delete('/api/file', (req, res) => {
  try {
    const filePath = safePath(req.query.path, NOTES_DIR);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true });
    } else {
      fs.unlinkSync(filePath);
    }
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
    if (!fs.existsSync(safeOld)) {
      return res.status(404).json({ error: 'Source not found' });
    }
    const newDir = path.dirname(safeNew);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    fs.renameSync(safeOld, safeNew);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/search
app.get('/api/search', (req, res) => {
  try {
    const { q, root } = req.query;
    if (!q) return res.json([]);
    const searchDir = root ? path.resolve(root) : NOTES_DIR;
    const results = [];
    const query = q.toLowerCase();

    function searchDir_(dir) {
      let entries;
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
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
          } catch {
            // skip unreadable files
          }
          if (nameMatch || contentMatch) {
            results.push({ path: fullPath, name: entry, snippet });
          }
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
    if (!fs.existsSync(TEMPLATES_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.md'));
    const templates = files.map((f) => ({
      name: f.replace(/\.md$/, ''),
      filename: f,
      path: path.join(TEMPLATES_DIR, f),
    }));
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
    if (!fs.existsSync(templateFile)) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let content = fs.readFileSync(templateFile, 'utf-8');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const datetime = `${date} ${time}`;
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = weekdays[now.getDay()];
    const year = String(now.getFullYear());
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const title = vars?.title || 'Untitled';

    const replacements = {
      '{{date}}': date,
      '{{time}}': time,
      '{{datetime}}': datetime,
      '{{title}}': title,
      '{{year}}': year,
      '{{month}}': month,
      '{{day}}': day,
      '{{weekday}}': weekday,
      ...(vars || {}),
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.split(placeholder).join(value);
    }

    const safeOut = safePath(outputPath, NOTES_DIR);
    const outDir = path.dirname(safeOut);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(safeOut, content, 'utf-8');
    res.json({ success: true, path: safeOut, content });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
