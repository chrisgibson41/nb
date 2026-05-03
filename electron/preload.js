const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the renderer via the context bridge.
contextBridge.exposeInMainWorld('electronAPI', {
  // Ask the main process to show a native Save dialog and write the PNG.
  savePNG: (base64Data, defaultName) =>
    ipcRenderer.invoke('save-png', { base64Data, defaultName }),
});
