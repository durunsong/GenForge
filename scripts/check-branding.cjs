const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const { chromium, _electron: electron } = require('playwright');
const sharp = require('sharp');

// Run after build with Playwright available on NODE_PATH. No real user profiles are accessed.
const root = path.resolve(__dirname, '..');

test('Electron keeps existing profiles and sets the GenForge identity before ready', () => {
  const main = fs.readFileSync(path.join(root, 'dist/main/main.js'), 'utf8');
  const profileRoot = path.join(root, 'synthetic-profiles');
  const cases = [
    { existing: [], packaged: true, expected: 'GenForge' },
    { existing: ['GenForge', 'Gemini绘图工作台'], packaged: true, expected: 'GenForge' },
    { existing: ['Gemini绘图工作台'], packaged: true, expected: 'Gemini绘图工作台' },
    { existing: ['gemini-image-studio'], packaged: false, expected: 'gemini-image-studio' },
    { existing: ['gemini-image-studio'], packaged: true, expected: 'gemini-image-studio' },
    { existing: ['Gemini绘图工作台', 'gemini-image-studio'], packaged: false, expected: 'gemini-image-studio' },
  ];
  for (const scenario of cases) {
    const paths = { appData: profileRoot };
    let name;
    let ready = false;
    const app = {
      isPackaged: scenario.packaged,
      setName(value) { assert(!ready); name = value; },
      getPath: key => paths[key],
      setPath(key, value) { assert(!ready); paths[key] = value; },
      whenReady() { ready = true; return new Promise(() => {}); },
      on() {},
    };
    vm.runInNewContext(main, {
      exports: {}, __dirname: path.join(root, 'dist/main'), process: { platform: 'darwin' },
      require(id) {
        if (id === 'electron') return { app };
        if (id === 'fs') return { existsSync: value => scenario.existing.some(name => value === path.join(profileRoot, name)) };
        if (id === 'path') return path;
        if (id === './updater') return {};
        throw new Error(`Unexpected module: ${id}`);
      },
    });
    assert.equal(name, 'GenForge');
    assert.equal(paths.userData, path.join(profileRoot, scenario.expected));
    assert.equal(paths.sessionData, paths.userData);
  }
});

test('Product identity remains fixed across model selections, themes and viewports', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(pathToFileURL(path.join(root, 'dist/renderer/index.html')).href);
    await page.waitForSelector('.session-item');
    const models = [null, 'random', 'gemini-3-pro-image-preview', 'gpt-image-1.5', 'custom-image-model-with-a-very-long-name'];
    for (const model of models) {
      await page.evaluate(model => {
        ProviderManager.providers = model ? [{ id: 'test', name: 'Test provider', model, type: model.includes('gemini') ? 'gemini' : 'openai' }] : [];
        ProviderManager.activeId = model === 'random' ? 'random' : 'test';
        BrandUI.update();
      }, model);
      assert.equal(await page.title(), 'GenForge');
      for (const id of ['brand-title-mobile', 'brand-title-desktop', 'empty-brand-title']) {
        assert.equal(await page.locator(`#${id}`).textContent(), 'GenForge');
      }
      for (const id of ['brand-logo-mobile', 'brand-logo-desktop', 'empty-brand-logo']) {
        assert(await page.locator(`#${id} img`).evaluate(img => img.complete && img.naturalWidth === 512));
      }
      if (model && model !== 'random') assert.match(await page.locator('#empty-brand-subtitle').textContent(), model.includes('gemini') ? /Gemini 3 Pro/ : model.includes('gpt') ? /GPT Image 1.5/ : /custom-image-model/);
    }
    await page.evaluate(() => { ProviderManager.providers = []; BrandUI.update(); });
    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      for (const mode of ['light', 'dark']) {
        await page.evaluate(mode => { if (document.documentElement.getAttribute('data-theme') !== mode) toggleTheme(); }, mode);
        assert(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), 'Page must not overflow horizontally');
        const heading = await page.locator('#empty-brand-title').boundingBox();
        assert(heading.x >= 0 && heading.x + heading.width <= width);
        if (process.env.BRAND_SCREENSHOTS) {
          await page.screenshot({ path: path.join(process.env.BRAND_SCREENSHOTS, `genforge-${width}-${mode}.png`), animations: 'disabled' });
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('Packaging and raster assets share the GenForge identity', async () => {
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/assets/site.webmanifest'), 'utf8'));
  assert.equal(pkg.name, 'genforge');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(pkg.build.productName, 'GenForge');
  assert.equal(pkg.build.appId, 'io.github.durunsong.genforge');
  assert.equal(pkg.build.nsis.shortcutName, 'GenForge');
  assert.equal(pkg.build.win.signAndEditExecutable, true, 'Windows executable resources must receive the product name and icon');
  assert(pkg.build.artifactName.startsWith('GenForge-'));
  assert(pkg.build.portable.artifactName.startsWith('GenForge-'));
  assert.equal(manifest.name, 'GenForge');
  assert.equal(manifest.short_name, 'GenForge');
  const sizes = { 'icon.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180, 'favicon-32.png': 32, 'favicon-16.png': 16 };
  for (const [file, size] of Object.entries(sizes)) {
    const icon = sharp(path.join(root, 'src/renderer/assets', file));
    const metadata = await icon.metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
    const stats = await icon.stats();
    assert(stats.channels.some(channel => channel.stdev > 40), `${file} must contain a nonblank mark`);
  }
});

test('Desktop startup reopens legacy settings and conversations in an isolated profile', async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'genforge-profile-'));
  const legacyProfile = path.join(temporaryRoot, 'gemini-image-studio');
  fs.mkdirSync(legacyProfile);
  const entry = path.join(temporaryRoot, 'bootstrap.cjs');
  const rendererPath = path.join(root, 'dist/renderer/index.html');
  const mainPath = path.join(root, 'dist/main/main.js');
  fs.writeFileSync(entry, `
    const { app, BrowserWindow } = require('electron');
    app.setPath('appData', ${JSON.stringify(temporaryRoot)});
    if (process.argv.includes('--legacy-fixture')) {
      app.setPath('userData', ${JSON.stringify(legacyProfile)});
      app.setPath('sessionData', ${JSON.stringify(legacyProfile)});
      app.whenReady().then(() => {
        const win = new BrowserWindow({ show: false });
        win.loadFile(${JSON.stringify(rendererPath)});
      });
    } else {
      require(${JSON.stringify(mainPath)});
    }
  `);
  let desktop;
  try {
    desktop = await electron.launch({ executablePath: require('electron'), args: [entry, '--legacy-fixture'] });
    let page = await desktop.firstWindow();
    await page.waitForSelector('.session-item');
    await page.evaluate(async () => {
      localStorage.setItem('gemini_providers', JSON.stringify([{ id: 'legacy', name: 'Saved provider', type: 'gemini', model: 'gemini-3-pro-image-preview' }]));
      localStorage.setItem('gemini_active_provider', 'legacy');
      await createNewSession('Saved conversation');
      await saveMessage(currentSessionId, 'user', 'Saved message');
    });
    await desktop.close();
    desktop = await electron.launch({ executablePath: require('electron'), args: [entry] });
    page = await desktop.firstWindow();
    await page.waitForSelector('.session-item');
    assert.deepEqual(await desktop.evaluate(({ app }) => ({ name: app.name, userData: app.getPath('userData'), sessionData: app.getPath('sessionData') })), {
      name: 'GenForge', userData: legacyProfile, sessionData: legacyProfile,
    });
    assert.equal(await page.title(), 'GenForge');
    assert.equal(await page.evaluate(() => ProviderManager.providers[0].name), 'Saved provider');
    assert.equal(await page.evaluate(() => ProviderManager.activeId), 'legacy');
    assert.equal(await page.evaluate(async () => (await getAllSessions())[0].title), 'Saved conversation');
    assert.equal(await page.evaluate(async () => (await getSessionMessages(currentSessionId))[0].content), 'Saved message');
    assert(!fs.existsSync(path.join(temporaryRoot, 'GenForge')), 'Upgrade must not create an empty replacement profile');
    await desktop.close();
    desktop = undefined;

    // A separate, empty appData directory exercises first launch without touching the real profile.
    const freshRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'genforge-fresh-'));
    const freshEntry = path.join(freshRoot, 'bootstrap.cjs');
    fs.writeFileSync(freshEntry, `require('electron').app.setPath('appData', ${JSON.stringify(freshRoot)}); require(${JSON.stringify(mainPath)});`);
    desktop = await electron.launch({ executablePath: require('electron'), args: [freshEntry] });
    page = await desktop.firstWindow();
    await page.waitForSelector('.session-item');
    assert.equal(await desktop.evaluate(({ app }) => app.getPath('userData')), path.join(freshRoot, 'GenForge'));
  } finally {
    await desktop?.close();
  }
});
