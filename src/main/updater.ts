import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { BrowserWindow, app, ipcMain } from 'electron';
import { autoUpdater, type UpdateDownloadedEvent, type UpdateInfo, type ProgressInfo } from 'electron-updater';
import { buildUnsignedMacUpdateScript, macAppBundleFromExecPath } from './mac-update';

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

function hasDeveloperIdSignature(bundle: string): boolean {
  const result = spawnSync('codesign', ['-dv', bundle], { encoding: 'utf8' });
  return /Authority=Developer ID Application:/.test(`${result.stdout || ''}\n${result.stderr || ''}`);
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

  let downloadedFile = '';
  let downloadedVersion = '';
  let installing = false;
  let replaceOnQuit = false;
  if (process.platform === 'darwin') {
    try {
      replaceOnQuit = !hasDeveloperIdSignature(macAppBundleFromExecPath(process.execPath));
    } catch (error) {
      console.warn('[updater] mac bundle is not replaceable:', error);
    }
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = !replaceOnQuit;
  autoUpdater.allowDowngrade = false;

  const launchUnsignedMacReplace = (bundle: string): void => {
    if (!downloadedFile || !downloadedVersion) throw new Error('更新文件还没有下载完成');
    const directory = app.getPath('temp');
    const script = buildUnsignedMacUpdateScript({
      pid: process.pid,
      zipPath: downloadedFile,
      bundlePath: bundle,
      version: downloadedVersion,
      logPath: path.join(directory, 'genforge-update.log'),
    });
    const scriptPath = path.join(directory, `genforge-update-${process.pid}.sh`);
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    installing = true;
    const child = spawn('/bin/sh', [scriptPath], { detached: true, stdio: 'ignore' });
    child.unref();
  };

  const installDownloadedUpdate = (): { ok: boolean; message?: string } => {
    try {
      if (process.platform === 'darwin') {
        const bundle = macAppBundleFromExecPath(process.execPath);
        if (!hasDeveloperIdSignature(bundle)) {
          if (!installing) launchUnsignedMacReplace(bundle);
          app.quit();
          return { ok: true };
        }
      }
      installing = true;
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (error) {
      installing = false;
      const message = error instanceof Error ? error.message : String(error);
      send(getMainWindow(), 'update:error', { message });
      return { ok: false, message };
    }
  };

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

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    downloadedFile = info.downloadedFile || downloadedFile;
    downloadedVersion = info.version;
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
      const files = await autoUpdater.downloadUpdate();
      if (!downloadedFile && Array.isArray(files) && files[0]) downloadedFile = files[0];
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message };
    }
  });

  ipcMain.handle('update:install', () => installDownloadedUpdate());

  app.on('before-quit', () => {
    if (!replaceOnQuit || installing || !downloadedFile) return;
    try {
      launchUnsignedMacReplace(macAppBundleFromExecPath(process.execPath));
    } catch (error) {
      console.warn('[updater] unsigned install skipped:', error);
    }
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
