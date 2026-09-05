const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// Run after build:renderer with Playwright available on NODE_PATH.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.desktop = {
        isElectron: true,
        platform: 'darwin',
        getAppVersion: async () => '1.0.1',
        onUpdateEvent: () => {},
        checkForUpdates: async () => ({ ok: false, message: 'Update service unavailable' }),
      };
    });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../dist/renderer/index.html')).href);
    await page.waitForSelector('.session-item');
    const theme = page.locator('.theme-toggle-btn');
    const themeBox = await theme.boundingBox();
    assert(themeBox.width <= 44 && themeBox.height <= 44, 'Theme control must fit in the settings header');
    const ratioBox = await page.locator('.ratio-grid').boundingBox();
    assert(ratioBox.y + ratioBox.height <= 800, 'Drawing parameters must fit in the initial desktop viewport');

    await theme.click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await theme.getAttribute('aria-pressed'), 'true');
    await page.reload();
    await page.waitForSelector('.session-item');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await theme.getAttribute('aria-pressed'), 'true');
    await theme.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');

    await page.locator('#stream-toggle').check();
    assert(!(await page.locator('#context-options').isVisible()));
    await page.locator('#context-toggle').check();
    assert(await page.locator('#context-options').isVisible());
    await page.locator('#context-count').selectOption('10');
    await page.reload();
    await page.waitForSelector('.session-item');
    assert(await page.locator('#stream-toggle').isChecked());
    assert(await page.locator('#context-toggle').isChecked());
    assert.equal(await page.locator('#context-count').inputValue(), '10');
    await page.locator('.res-btn[data-val="4K"]').focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('.res-btn[data-val="4K"]').evaluate(el => el.classList.contains('active')));
    await page.locator('.ratio-card[data-val="16:9"]').click();
    assert(await page.locator('.ratio-card[data-val="16:9"]').evaluate(el => el.classList.contains('active')));
    await page.locator('#auto-save-toggle').click();
    assert(!(await page.locator('#auto-save-toggle').isChecked()), 'Auto-save must still require a directory');
    await page.locator('#check-update-btn').click();
    assert(await page.locator('#update-status-text').isVisible(), 'Update errors must remain visible');
    assert.equal(await page.locator('#update-status-text').textContent(), 'Update service unavailable');
    await page.locator('.provider-collapse > summary').click();
    assert(await page.locator('#provider-select').isVisible());
    await page.locator('.provider-collapse > summary').click();

    await page.reload();
    await page.waitForSelector('.session-item');
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      if (width < 768) await page.evaluate(() => toggleSettings());
      for (const mode of ['light', 'dark']) {
        if (await page.locator('html').getAttribute('data-theme') !== mode) await theme.click();
        assert(await page.locator('#right-sidebar').evaluate(el => el.scrollWidth <= el.clientWidth), 'Settings must not overflow horizontally');
        const sidebar = await page.locator('#right-sidebar').boundingBox();
        assert(sidebar.x >= 0 && sidebar.x + sidebar.width <= width, 'Settings must fit the viewport');
        if (process.env.SETTINGS_SCREENSHOTS) {
          await page.screenshot({ path: path.join(process.env.SETTINGS_SCREENSHOTS, `settings-${width}-${mode}.png`), animations: 'disabled' });
        }
      }
      if (width < 768) {
        await page.getByRole('button', { name: '关闭设置' }).click();
        assert(!(await page.locator('#right-sidebar').evaluate(el => el.classList.contains('open'))));
      }
    }
    assert.deepEqual(errors, []);
    console.log('Settings checks passed: compact layout, themes, persistence, controls, update errors, desktop/mobile overflow.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
