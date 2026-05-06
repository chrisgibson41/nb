# NB

A fast, local-first Markdown note-taking app. Notes are plain `.md` files stored wherever you want — back them up with Git, sync with any file-sync service, or open them in any text editor.

## Features

- **Markdown editor** with live inline rendering (headings, bold, italic, code blocks, tables, blockquotes)
- **Interactive checkboxes** — click to tick/untick without editing raw Markdown
- **Wiki links** — `[[Note Name]]` renders as a clickable pill and navigates between notes
- **Tags** — YAML front-matter tags managed via a tag bar at the bottom of the editor
- **Templates** — reusable note templates with shortcut buttons for quick entry insertion
- **Tabs** — working tab + pinnable permanent tabs, middle-click to close
- **Outline panel** — auto-appears when a note has 2+ headings; click to jump to a section
- **File history** — browse and restore git snapshots of any note
- **Full-text search** across file names; local sidebar filter for quick narrowing
- **Drag & drop** files between folders in the sidebar
- **Auto-save** 800 ms after the last keystroke; `Ctrl/⌘+S` saves immediately

## Requirements

- [Node.js](https://nodejs.org/) 18+
- npm 9+

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Create your config file

```bash
cp config.example.json config.json
```

Edit `config.json` to point at your notes directory:

```json
{
  "notesDir": "~/notes",
  "templatesDir": "~/notes/templates",

  "templatePaths": {
    "daily-note": "Daily/{{date}}.md",
    "meeting-note": "Meetings/{{date}}-{{slug}}.md",
    "blank": "{{title}}.md"
  }
}
```

`config.json` is gitignored — it never gets committed.

## Running

### Development

Runs the Express API server and the Vite dev server concurrently. Open **`http://localhost:5173`**.

```bash
npm run dev
```

### Production

Builds the React client, then starts a single Express process that serves both the app and the API. Open **`http://localhost:3001`**.

```bash
npm start
```

## Custom config path

By default both commands look for `config.json` next to `server.js`. Override this with a CLI flag or environment variable:

```bash
# CLI flag
node server.js --config /path/to/my-config.json

# Environment variable
NB_CONFIG=/path/to/my-config.json node server.js
```

Priority order: `--config` flag → `NB_CONFIG` env var → `config.json` in the repo root.

The server will exit with a clear error if the config file is not found.

## Project structure

```
nb/
├── server.js            # Express API + WebSocket server
├── config.json          # Your local config (gitignored)
├── config.example.json  # Safe defaults to copy from
├── client/              # React frontend (Vite)
│   └── src/
│       ├── App.jsx
│       └── components/
├── notes/               # Default notes directory (if using repo-local paths)
├── templates/           # Default templates directory
└── e2e/                 # Playwright end-to-end tests
```

## Testing

```bash
# Unit tests (Vitest)
npm run test:unit

# End-to-end tests (Playwright) — requires the server to be running
npm run test:e2e

# Both
npm run test:all
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘+S` | Save immediately |
| `Ctrl/⌘+T` | New note from template |
| `Ctrl/⌘+W` | Close current tab |
| Auto-save | Saves 800 ms after last keystroke |
