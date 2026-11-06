import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

export type UpdateInfoPayload = {
  version: string;
  releaseNotes?: string | string[] | null;
  releaseName?: string;
  releaseDate?: string;
};

export type UpdateProgressPayload = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export type DesktopBridge = {
  platform: NodeJS.Platform;
  isElectron: true;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{
    ok: boolean;
    version?: string;
    message?: string;
  }>;
  downloadUpdate: () => Promise<{ ok: boolean; message?: string }>;
  installUpdate: () => Promise<{ ok: boolean; message?: string }>;
  pickSaveDirectory: () => Promise<string | null>;
  saveDirectoryExists: (directory: string) => Promise<boolean>;
  saveImageFile: (payload: {
    directory: string;
    filename: string;
    dataUrl: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  onUpdateEvent: (
    channel:
      | "update:checking"
      | "update:available"
      | "update:not-available"
      | "update:progress"
      | "update:downloaded"
      | "update:error",
    listener: (payload?: unknown) => void,
  ) => () => void;
};

const bridge: DesktopBridge = {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  getAppVersion: () => ipcRenderer.invoke("update:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  pickSaveDirectory: () => ipcRenderer.invoke("save:pick-directory"),
  saveDirectoryExists: (directory) =>
    ipcRenderer.invoke("save:directory-exists", directory),
  saveImageFile: (payload) => ipcRenderer.invoke("save:write-image", payload),
  onUpdateEvent: (channel, listener) => {
    const handler = (_event: IpcRendererEvent, payload?: unknown) =>
      listener(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld("desktop", bridge);
