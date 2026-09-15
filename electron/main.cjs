const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const isSafeExternalUrl = (value) => {
  try {
    const protocol = new URL(value).protocol;
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(protocol);
  } catch {
    return false;
  }
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 390,
    minHeight: 680,
    backgroundColor: '#071310',
    autoHideMenuBar: true,
    show: false,
    title: 'HealthGenie',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

