const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const pkg = require('../package.json');

const script = path.join(__dirname, 'prepare-release.cjs');
const tag = `v${pkg.version}`;
function run(...args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('release preflight accepts the package version and rejects mismatched or unsafe tags', () => {
  assert.equal(run(tag).status, 0);
  for (const invalid of ['v0.0.0', pkg.version, 'v1.0.1;echo unsafe', 'v1.0.1-beta.1']) {
    assert.notEqual(run(invalid).status, 0, invalid);
  }
});

test('release preparation checks all platforms, updater hashes and download links', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genforge-release-'));
  const prefix = `GenForge-${pkg.version}`;
  const packages = [
    `${prefix}-win-x64.exe`, `${prefix}-portable.exe`, `${prefix}-win-x64.zip`,
    `${prefix}-mac-universal.dmg`, `${prefix}-mac-universal.zip`,
    `${prefix}-linux-x86_64.AppImage`, `${prefix}-linux-amd64.deb`,
  ];
  const updaterFiles = {
    'latest.yml': packages[0],
    'latest-mac.yml': packages[4],
    'latest-linux.yml': packages[5],
  };
  try {
    for (const name of packages) fs.writeFileSync(path.join(dir, name), 'abc');
    const sha512 = createHash('sha512').update('abc').digest('base64');
    for (const [name, artifact] of Object.entries(updaterFiles)) {
      fs.writeFileSync(path.join(dir, name), `version: ${pkg.version}\nfiles:\n  - url: ${artifact}\n    sha512: ${sha512}\n    size: 3\npath: ${artifact}\nsha512: ${sha512}\n`);
    }
    fs.writeFileSync(path.join(dir, 'builder-debug.yml'), 'private build diagnostics');
    let result = run(tag, dir);
    assert.equal(result.status, 0, result.stderr);
    const notes = fs.readFileSync(path.join(dir, 'RELEASE_NOTES.md'), 'utf8');
    for (const name of packages) assert(notes.includes(`/releases/download/${tag}/${name}`), name);
    assert(notes.includes('Source code'));
    const sums = fs.readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8');
    assert(sums.includes(`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  ${packages[0]}`));
    assert(!sums.includes('builder-debug'));

    fs.writeFileSync(path.join(dir, packages[0]), 'tampered');
    result = run(tag, dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hash|size/i);
    fs.writeFileSync(path.join(dir, packages[0]), 'abc');

    fs.unlinkSync(path.join(dir, packages[3]));
    result = run(tag, dir);
    assert.notEqual(result.status, 0);
    assert(result.stderr.includes(packages[3]));
    fs.writeFileSync(path.join(dir, packages[3]), 'abc');

    fs.writeFileSync(path.join(dir, 'latest-mac.yml'), 'version: 0.0.0\n');
    result = run(tag, dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /version/i);
  } finally {
    for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file));
    fs.rmdirSync(dir);
  }
});
