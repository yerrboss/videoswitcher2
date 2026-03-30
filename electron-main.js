const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// --- IMPROVED AUTO-RELOAD ---
try {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron.cmd'),
    hardResetMethod: 'exit',
    forceHardReset: true,
    watchRenderer: true
  });
} catch (err) {
  console.log("Reloader active.");
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#050213',
    webPreferences: {
      nodeIntegration: true, // Note: You are using contextIsolation: false
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index copy 2.html');
}

// --- MEDIA FILE BRIDGE (UNIFIED) ---
// This handles the request from your UI "LOCAL MEDIA" button
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Media for Vcam Slot',
        properties: ['openFile'],
        filters: [
            { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] },
            { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
        ]
    });

    if (canceled) {
        return null;
    } else {
        console.log("🎬 File selected:", filePaths[0]);
        return filePaths[0]; // Returns path to your UI main.js
    }
});

// App Lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});