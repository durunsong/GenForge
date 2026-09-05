const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const lock = require('../package-lock.json');

async function hash(file, algorithm, encoding) {
  const digest = createHash(algorithm);
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest(encoding);
}

async function main() {
  const [tag, directory] = process.argv.slice(2);
  assert(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version), 'Only stable X.Y.Z versions are supported');
  assert.equal(tag, `v${pkg.version}`, 'Tag must match package.json version');
  assert.equal(lock.version, pkg.version, 'package-lock.json version must match');
  assert.equal(lock.packages[''].version, pkg.version, 'Lockfile root version must match');
  if (!directory) return;

  const prefix = `GenForge-${pkg.version}`;
  const downloads = [
    ['Windows x64', '安装版 / Installer', `${prefix}-win-x64.exe`],
    ['Windows x64', '便携版 / Portable', `${prefix}-portable.exe`],
    ['Windows x64', 'ZIP 压缩包 / Archive', `${prefix}-win-x64.zip`],
    ['macOS Intel + Apple Silicon', '通用安装包 / Universal DMG', `${prefix}-mac-universal.dmg`],
    ['macOS Intel + Apple Silicon', 'ZIP / 更新资源', `${prefix}-mac-universal.zip`],
    ['Linux x64', 'AppImage', `${prefix}-linux-x86_64.AppImage`],
    ['Debian / Ubuntu x64', 'DEB 安装包', `${prefix}-linux-amd64.deb`],
  ];
  const updates = {
    'latest.yml': downloads[0][2],
    'latest-mac.yml': downloads[4][2],
    'latest-linux.yml': downloads[5][2],
  };
  const required = [...downloads.map(row => row[2]), ...Object.keys(updates)];
  for (const name of required) {
    const file = path.join(directory, name);
    assert(fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0, `Missing or empty release asset: ${name}`);
  }

  // Reuse electron-builder's installed YAML parser for its update manifests.
  const yaml = require('js-yaml');
  for (const [name, expected] of Object.entries(updates)) {
    const info = yaml.load(fs.readFileSync(path.join(directory, name), 'utf8'));
    assert.equal(info.version, pkg.version, `${name}: wrong version`);
    assert(Array.isArray(info.files) && info.files.some(file => file.url === expected), `${name}: missing update package`);
    for (const entry of info.files) {
      assert(downloads.some(row => row[2] === entry.url), `${name}: unexpected update URL`);
      const file = path.join(directory, entry.url);
      assert.equal(await hash(file, 'sha512', 'base64'), entry.sha512, `${name}: hash mismatch`);
      if (entry.size !== undefined) assert.equal(fs.statSync(file).size, entry.size, `${name}: size mismatch`);
    }
    if (info.path) {
      assert(downloads.some(row => row[2] === info.path), `${name}: unexpected legacy update path`);
      assert.equal(await hash(path.join(directory, info.path), 'sha512', 'base64'), info.sha512, `${name}: legacy hash mismatch`);
    }
  }

  const blockmaps = fs.readdirSync(directory).filter(name => name.endsWith('.blockmap') && required.includes(name.slice(0, -9)));
  const assets = [...required, ...blockmaps].sort();
  const checksums = [];
  for (const name of assets) checksums.push(`${await hash(path.join(directory, name), 'sha256', 'hex')}  ${name}`);
  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`);

  const base = `${pkg.homepage}/releases/download/${tag}`;
  const notes = [
    `# GenForge ${tag}`, '',
    '## 下载安装 / Downloads', '',
    '按操作系统下载下表安装包，无需安装 Node.js。GitHub 自动附带的 Source code 是源码，不是安装包。', '',
    '| 系统 / OS | 类型 / Package | 下载 / Download |',
    '| --- | --- | --- |',
    ...downloads.map(([os, kind, name]) => `| ${os} | ${kind} | [${name}](${base}/${name}) |`), '',
    '## 安装说明 / Installation', '',
    '- Windows：推荐 EXE 安装版；便携版和 ZIP 需手动升级。当前构建未配置代码签名。',
    '- macOS：DMG 同时支持 Intel 和 Apple Silicon，打开后拖入 Applications。当前构建未签名、未公证；如被系统拦截，请在系统设置的隐私与安全性中允许打开。未签名版本请手动下载升级。',
    '- Linux：AppImage 需先执行 `chmod +x 文件名.AppImage`；Debian / Ubuntu 可使用 `sudo apt install ./文件名.deb`。',
    '- `latest*.yml`、macOS ZIP 和 `.blockmap` 是更新资源，请保留在 Release 中。', '',
    '## 文件校验 / Verification', '',
    `[SHA256SUMS.txt](${base}/SHA256SUMS.txt) 包含安装包和更新资源的 SHA-256。`, '',
    'Windows: `Get-FileHash .\\GenForge-*.exe -Algorithm SHA256`', '',
    'macOS: `shasum -a 256 GenForge-*.dmg`', '',
    'Linux: `sha256sum GenForge-*.AppImage`', '',
    '将结果与 SHA256SUMS.txt 中对应文件的值比较。', '',
  ];
  fs.writeFileSync(path.join(directory, 'RELEASE_NOTES.md'), notes.join('\n'));
  fs.writeFileSync(path.join(directory, 'release-assets.json'), JSON.stringify([...assets, 'SHA256SUMS.txt']));
  console.log(`Validated ${assets.length} release assets for ${tag}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
