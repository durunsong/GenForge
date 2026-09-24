import path from "path";

export function macAppBundleFromExecPath(execPath: string): string {
  const bundle = path.resolve(path.dirname(execPath), "..", "..");
  if (
    !bundle.endsWith(".app") ||
    bundle.startsWith("/Volumes/") ||
    bundle.includes("/AppTranslocation/")
  ) {
    throw new Error(
      "请先把 GenForge 移到「应用程序」文件夹，再从那里打开后更新",
    );
  }
  return bundle;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildUnsignedMacUpdateScript(options: {
  pid: number;
  zipPath: string;
  bundlePath: string;
  version: string;
  logPath: string;
}): string {
  if (!Number.isInteger(options.pid) || options.pid <= 0) {
    throw new Error("无法准备更新：进程号无效");
  }
  if (!/^[0-9A-Za-z._+-]+$/.test(options.version)) {
    throw new Error("无法准备更新：版本号无效");
  }
  const zip = shellQuote(options.zipPath);
  const bundle = shellQuote(options.bundlePath);
  const executable = shellQuote(
    path.join(
      options.bundlePath,
      "Contents",
      "MacOS",
      path.basename(options.bundlePath, ".app"),
    ),
  );
  const previous = shellQuote(`${options.bundlePath}.previous`);
  const version = shellQuote(options.version);
  const log = shellQuote(options.logPath);
  return `#!/bin/sh
set -eu
exec >> ${log} 2>&1
while kill -0 ${options.pid} 2>/dev/null && [ ${options.pid} -ne $$ ]; do
  sleep 0.2
done
dest=$(mktemp -d)
trap 'rm -rf "$dest"' EXIT
ditto -x -k ${zip} "$dest"
app=$(find "$dest" -maxdepth 1 -type d -name '*.app' -print -quit)
test -n "$app"
found=$(plutil -extract CFBundleShortVersionString raw -o - "$app/Contents/Info.plist")
test "$found" = ${version}
rm -rf ${previous}
mv ${bundle} ${previous}
if ! mv "$app" ${bundle}; then
  mv ${previous} ${bundle} || true
  exit 1
fi
rm -rf ${previous}
xattr -cr ${bundle} || true
if [ -x ${executable} ]; then
  open ${bundle} || true
fi
`;
}
