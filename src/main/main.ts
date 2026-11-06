import {
  app,
  BrowserWindow,
  shell,
  Menu,
  session,
  nativeImage,
  dialog,
  ipcMain,
} from "electron";
import fs from "fs";
import path from "path";
import { setupAutoUpdater } from "./updater";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

app.setName("GenForge");
// Reuse earlier profiles without moving their settings, credentials or conversations.
const legacyProfiles = isDev
  ? ["gemini-image-studio", "Gemini绘图工作台"]
  : ["Gemini绘图工作台", "gemini-image-studio"];
const profilePaths = ["GenForge", ...legacyProfiles].map((name) =>
  path.join(app.getPath("appData"), name),
);
const userDataPath =
  profilePaths.find((candidate) => fs.existsSync(candidate)) ?? profilePaths[0];
app.setPath("userData", userDataPath);
app.setPath("sessionData", userDataPath);

function resolveAppIcon(): string {
  const candidates = [
    path.join(__dirname, "../renderer/assets/icon.png"),
    path.join(__dirname, "../../build/icon.png"),
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
    title: "GenForge",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webSecurity: true,
    },
  });

  mainWindow = win;

  if (process.platform === "darwin" && !icon.isEmpty()) {
    app.dock?.setIcon(icon);
  }

  win.once("ready-to-show", () => {
    win.show();
    if (isDev) {
      // win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  return win;
}

function setupMenu(): void {
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "编辑",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "pasteAndMatchStyle" },
            { role: "delete" },
            { role: "selectAll" },
          ],
        },
        {
          label: "视图",
          submenu: [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
          ],
        },
        {
          label: "窗口",
          submenu: [
            { role: "minimize" },
            { role: "zoom" },
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "close" },
          ],
        },
        {
          role: "help",
          submenu: [
            {
              label: "GitHub 仓库",
              click: () => {
                void shell.openExternal(
                  "https://github.com/durunsong/GenForge",
                );
              },
            },
            {
              label: "下载更新 / Releases",
              click: () => {
                void shell.openExternal(
                  "https://github.com/durunsong/GenForge/releases",
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

function imagePathInside(directory: string, filename: string): string | null {
  const root = path.resolve(directory);
  const safeName = path.basename(filename);
  if (!safeName || safeName === "." || safeName === "..") return null;
  const target = path.resolve(root, safeName);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    return null;
  return target;
}

function registerSaveDirectory(): void {
  ipcMain.handle("save:pick-directory", async () => {
    const parent = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const options = {
      properties: ["openDirectory", "createDirectory"] as (
        | "openDirectory"
        | "createDirectory"
      )[],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    "save:directory-exists",
    async (_event, directory: unknown) => {
      try {
        const stat = await fs.promises.stat(String(directory || ""));
        return stat.isDirectory();
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle(
    "save:write-image",
    async (
      _event,
      payload: { directory?: string; filename?: string; dataUrl?: string },
    ) => {
      const directory = String(payload?.directory || "");
      const filename = String(payload?.filename || "");
      const dataUrl = String(payload?.dataUrl || "");
      const target = imagePathInside(directory, filename);
      const comma = dataUrl.indexOf(",");
      const encoded = comma >= 0 ? dataUrl.slice(comma + 1) : "";
      if (!target || !dataUrl.startsWith("data:") || !encoded) {
        return { ok: false, message: "保存参数无效" };
      }
      try {
        const stat = await fs.promises.stat(path.dirname(target));
        if (!stat.isDirectory())
          return { ok: false, message: "保存目录不存在" };
        await fs.promises.writeFile(target, Buffer.from(encoded, "base64"));
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "保存失败";
        return { ok: false, message };
      }
    },
  );
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    callback({ responseHeaders: headers });
  });

  registerSaveDirectory();
  setupMenu();
  createWindow();
  setupAutoUpdater(() => mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
