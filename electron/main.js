const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Start the embedded Express + WebSocket server ────────────────────────────
// server.js calls server.listen() at module load — it's ready almost instantly.
require('../server.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
// True when running via `electron .` from the CLI (development).
// False only when the app has been packaged with electron-builder etc.
const isDev = !app.isPackaged;

const VITE_URL = 'http://localhost:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Notes',
    icon: path.join(__dirname, 'icon.icns'),
    show: false, // reveal once content is ready to avoid white flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    win.loadURL(VITE_URL);
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../client/dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  // Fallback: show after 3 s even if ready-to-show never fires
  setTimeout(() => { if (!win.isDestroyed()) win.show(); }, 3000);

  win.webContents.on('did-fail-load', (event, code, desc, url) => {
    console.error('[electron] did-fail-load', code, desc, url);
    // Retry once after a short delay (Vite may still be warming up)
    setTimeout(() => {
      if (!win.isDestroyed()) win.loadURL(isDev ? VITE_URL : `file://${path.join(__dirname, '../client/dist/index.html')}`);
    }, 1500);
  });

  win.webContents.on('console-message', (event, level, message) => {
    console.log('[renderer]', message);
  });

  // Open external links in the system browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

// Show a native Save dialog and write the PNG to disk
ipcMain.handle('save-png', async (event, { base64Data, defaultName }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'diagram.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { success: false };
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return { success: true, filePath };
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS apps stay alive until Cmd+Q even with no windows open
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // Re-open a window on macOS when dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
