import { app, BrowserWindow, shell, Menu, session, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { setupAutoUpdater } from './updater';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function resolveAppIcon(): string {
  const candidates = [
    path.join(__dirname, '../renderer/assets/icon.png'),
    path.join(__dirname, '../../build/icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function createWindow(): BrowserWindow {
  const iconPath = resolveAppIcon();
  const icon = nativeImage.createFromPath(iconPath);

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'Gemini 绘图工作台',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webSecurity: true,
    },
  });

  mainWindow = win;

  if (process.platform === 'darwin' && !icon.isEmpty()) {
    app.dock?.setIcon(icon);
  }

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) {
      // win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}

function setupMenu(): void {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        {
          label: '编辑',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
          ],
        },
        {
          label: '视图',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ],
        },
        {
          label: '窗口',
          submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'close' },
          ],
        },
        {
          role: 'help',
          submenu: [
            {
              label: 'GitHub 仓库',
              click: () => {
                void shell.openExternal('https://github.com/durunsong/GenForge');
              },
            },
            {
              label: '下载更新 / Releases',
              click: () => {
                void shell.openExternal(
                  'https://github.com/durunsong/GenForge/releases',
                );
              },
            },
          ],
        },
      ]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    callback({ responseHeaders: headers });
  });

  setupMenu();
  createWindow();
  setupAutoUpdater(() => mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
