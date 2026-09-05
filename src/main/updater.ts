import { BrowserWindow, app, ipcMain } from 'electron';
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater';

const isDev = !app.isPackaged;

type Sendable = {
  send: (channel: string, ...args: unknown[]) => void;
};

function getTargetWindow(win: BrowserWindow | null): Sendable | null {
  if (win && !win.isDestroyed()) return win.webContents;
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused.webContents;
  const all = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  return all?.webContents ?? null;
}

function send(win: BrowserWindow | null, channel: string, payload?: unknown): void {
  const target = getTargetWindow(win);
  if (!target) return;
  target.send(channel, payload);
}

function focusMainWindow(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('update:get-version', () => app.getVersion());

  if (isDev) {
    console.log('[updater] skipped in development');
    ipcMain.handle('update:check', async () => ({ ok: false, message: '开发模式不检查更新' }));
    ipcMain.handle('update:download', async () => ({ ok: false, message: '开发模式不下载更新' }));
    ipcMain.handle('update:install', () => ({ ok: false }));
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    send(getMainWindow(), 'update:checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    focusMainWindow(getMainWindow);
    send(getMainWindow(), 'update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? '',
      releaseName: info.releaseName ?? '',
      releaseDate: info.releaseDate ?? '',
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    send(getMainWindow(), 'update:not-available', {
      version: info.version,
    });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    send(getMainWindow(), 'update:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    focusMainWindow(getMainWindow);
    send(getMainWindow(), 'update:downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err: Error) => {
    send(getMainWindow(), 'update:error', {
      message: err?.message || String(err),
    });
  });

  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        ok: true,
        version: result?.updateInfo?.version ?? app.getVersion(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message };
    }
  });

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  // Delay first check so UI can load; then recheck every 6 hours
  const check = () => {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[updater] check failed:', err);
    });
  };
  setTimeout(check, 4000);
  setInterval(check, 6 * 60 * 60 * 1000);
}
