const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// Run after build:renderer with Playwright on NODE_PATH. Only synthetic settings are used.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../dist/renderer/index.html')).href);
    await page.waitForSelector('.session-item');
    await page.locator('.provider-collapse > summary').click();
    const trigger = id => page.locator(`#${id}-trigger`);
    await trigger('provider-select').waitFor({ timeout: 2000 });
    assert(await page.getByText('尚无渠道', { exact: true }).isVisible());
    assert(await page.getByRole('button', { name: '删除渠道', exact: true }).isDisabled());

    async function choose(id, label) {
      await trigger(id).click();
      await page.getByRole('option', { name: label, exact: true }).click();
      assert.equal(await trigger(id).getAttribute('aria-expanded'), 'false');
    }

    await page.locator('.provider-content').getByLabel('渠道名称', { exact: true }).fill('Primary');
    await choose('p-type', 'OpenAI 兼容接口');
    await choose('p-openai-mode', 'Images API');
    await page.locator('.provider-content').getByLabel('Base URL', { exact: true }).fill('https://images.test');
    await page.locator('.provider-content').getByLabel('API Key', { exact: true }).fill('test-only');
    await choose('p-model-select', 'gpt-image-1.5');
    assert.equal(await page.locator('.provider-content').getByLabel('模型名称', { exact: true }).inputValue(), 'gpt-image-1.5');
    await page.getByRole('button', { name: '保存渠道', exact: true }).click();
    assert.equal(await page.locator('.provider-item').count(), 1);
    assert.match(await trigger('provider-select').textContent(), /Primary/);

    await page.locator('.provider-item').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.provider-content').getByLabel('渠道名称', { exact: true }).inputValue(), 'Primary');
    assert.match(await trigger('p-openai-mode').textContent(), /Images API/);
    assert.equal(await page.locator('.provider-item').getAttribute('aria-pressed'), 'true');
    await page.locator('.provider-content').getByLabel('渠道名称', { exact: true }).fill('Primary updated');
    await page.getByRole('button', { name: '保存渠道', exact: true }).click();
    assert.match(await page.locator('.provider-item').textContent(), /Primary updated/);

    await trigger('provider-select').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#provider-select').inputValue(), 'random');
    await trigger('provider-select').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    assert.equal(await trigger('provider-select').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#provider-select').inputValue(), 'random', 'Escape must not commit a choice');
    await trigger('provider-select').click();
    await page.locator('.settings-header h2').click();
    assert.equal(await trigger('provider-select').getAttribute('aria-expanded'), 'false', 'Outside click dismisses the menu');

    await trigger('p-model-select').focus();
    await page.keyboard.press('g');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#p-model').inputValue(), 'gpt-image-2', 'Type-ahead must select a matching option');
    await page.getByRole('button', { name: '清空并新增渠道', exact: true }).click();
    assert.equal(await page.locator('#p-model').inputValue(), '');
    assert.equal(await trigger('p-model-select').textContent(), '选择预设');
    await page.reload();
    await page.waitForSelector('.session-item');
    await page.locator('.provider-collapse > summary').click();
    assert.match(await page.locator('.provider-item').textContent(), /Primary updated/);
    assert.equal(await page.locator('#provider-select').inputValue(), 'random');

    // Duplicate names and long model IDs must remain independently editable and fit the panel.
    await page.evaluate(() => {
      const provider = ProviderManager.providers[0];
      ProviderManager.providers.push({ ...provider, id: 'other', model: 'custom-image-model-with-a-very-long-name-for-layout-checks' });
      ProviderManager.renderUI();
    });
    await page.locator('.provider-item').last().click();
    assert.equal(await page.locator('.provider-item[aria-pressed="true"]').count(), 1);
    assert.equal(await page.locator('#p-id').inputValue(), 'other');
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      if (width < 768) await page.evaluate(() => { document.getElementById('right-sidebar').classList.add('open'); });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { if (document.documentElement.getAttribute('data-theme') !== theme) toggleTheme(); }, theme);
        await trigger('provider-select').click();
        const menu = page.getByRole('listbox').filter({ visible: true });
        const box = await menu.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900);
        assert(await menu.evaluate(el => el.scrollWidth <= el.clientWidth), 'Options must wrap without horizontal overflow');
        assert(await page.locator('#right-sidebar').evaluate(el => el.scrollWidth <= el.clientWidth), 'Form must fit the sidebar');
        if (process.env.PROVIDER_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.PROVIDER_SCREENSHOTS, `providers-${width}-${theme}.png`), animations: 'disabled' });
        await page.keyboard.press('Escape');
      }
    }
    await page.locator('.provider-item').last().click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '删除渠道', exact: true }).click();
    assert.equal(await page.locator('.provider-item').count(), 1);
    assert(await page.getByRole('button', { name: '删除渠道', exact: true }).isDisabled());
    assert.deepEqual(errors, []);
    console.log('Provider checks passed: create/edit/delete, persistence, duplicate names, keyboard selection, dismissal, themes and responsive menus.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
