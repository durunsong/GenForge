export {};

declare global {
  interface Window {
    desktop?: {
      platform: NodeJS.Platform;
      isElectron: true;
      versions: {
        electron: string;
        chrome: string;
        node: string;
      };
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{ ok: boolean; version?: string; message?: string }>;
      downloadUpdate: () => Promise<{ ok: boolean; message?: string }>;
      installUpdate: () => Promise<{ ok: boolean }>;
      onUpdateEvent: (
        channel:
          | 'update:checking'
          | 'update:available'
          | 'update:not-available'
          | 'update:progress'
          | 'update:downloaded'
          | 'update:error',
        listener: (payload?: unknown) => void,
      ) => () => void;
    };
    UpdateUI?: {
      init: () => void;
      check: (manual?: boolean) => Promise<void>;
    };
  }
}
