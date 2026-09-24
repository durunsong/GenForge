const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { macAppBundleFromExecPath, buildUnsignedMacUpdateScript } = require('../dist/main/mac-update.js');

function writeFakeApp(directory, version) {
  const app = path.join(directory, 'GenForge.app');
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>
`);
  return app;
}

function installedVersion(app) {
  return execFileSync('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', path.join(app, 'Contents', 'Info.plist')], {
    encoding: 'utf8',
  }).trim();
}

test('mac update bundle path is the .app that contains the executable', () => {
  assert.equal(
    macAppBundleFromExecPath('/Applications/GenForge.app/Contents/MacOS/GenForge'),
    '/Applications/GenForge.app',
  );
});

test('mac update refuses a disk image or translocated copy', () => {
  assert.throws(
    () => macAppBundleFromExecPath('/Volumes/GenForge/GenForge.app/Contents/MacOS/GenForge'),
    /应用程序/,
  );
  assert.throws(
    () => macAppBundleFromExecPath('/private/var/folders/xx/AppTranslocation/yy/d/GenForge.app/Contents/MacOS/GenForge'),
    /应用程序/,
  );
});

test('unsigned mac update checks the new version before replacing the installed app', () => {
  const script = buildUnsignedMacUpdateScript({
    pid: 42,
    zipPath: "/tmp/GenForge 1.0.7.zip",
    bundlePath: "/Applications/GenForge.app",
    version: '1.0.7',
    logPath: '/tmp/genforge update.log',
  });
  const versionCheck = script.indexOf('CFBundleShortVersionString');
  const moveInstalled = script.indexOf("mv '/Applications/GenForge.app' '/Applications/GenForge.app.previous'");
  assert.equal(script.startsWith('#!/bin/sh\nset -eu\n'), true);
  assert.match(script, /while kill -0 42 /);
  assert.match(script, /ditto -x -k '\/tmp\/GenForge 1\.0\.7\.zip'/);
  assert.ok(versionCheck > 0 && versionCheck < moveInstalled, 'Do not move the installed app before the new version matches');
  assert.match(script, /test "\$found" = '1\.0\.7'/);
  assert.match(script, /mv '\/Applications\/GenForge\.app\.previous' '\/Applications\/GenForge\.app'/);
  assert.match(script, /xattr -cr '\/Applications\/GenForge\.app'/);
  assert.match(script, /open '\/Applications\/GenForge\.app'/);
  assert.match(script, />> '\/tmp\/genforge update\.log'/);
});

test('unsigned mac update installs the matching version and leaves the old app when it does not match', { skip: process.platform !== 'darwin' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'genforge-update-'));
  const installed = writeFakeApp(path.join(root, 'Applications'), '1.0.0');
  const staged = writeFakeApp(path.join(root, 'staged'), '1.0.7');
  const zip = path.join(root, 'GenForge.zip');
  const log = path.join(root, 'update.log');
  execFileSync('ditto', ['-c', '-k', '--keepParent', staged, zip]);
  let unusedPid = 0;
  for (let pid = 100000; pid < 101000; pid += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') {
        unusedPid = pid;
        break;
      }
    }
  }
  assert.ok(unusedPid > 0);

  const run = (version) => {
    const scriptPath = path.join(root, `update-${version}.sh`);
    fs.writeFileSync(scriptPath, buildUnsignedMacUpdateScript({
      pid: unusedPid,
      zipPath: zip,
      bundlePath: installed,
      version,
      logPath: log,
    }), { mode: 0o755 });
    return execFileSync('/bin/sh', [scriptPath], { encoding: 'utf8', timeout: 15000 });
  };

  assert.throws(() => run('9.9.9'));
  assert.equal(installedVersion(installed), '1.0.0');
  assert.equal(fs.existsSync(`${installed}.previous`), false);
  run('1.0.7');
  assert.equal(installedVersion(installed), '1.0.7');
  assert.equal(fs.existsSync(`${installed}.previous`), false);
});
