const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../dist/renderer/index.html')).href);
    await page.waitForSelector('.session-item');
    assert.equal(await page.locator('.app-select-trigger').count(), await page.locator('select').count(), 'Every select must use the shared menu');
    assert.equal(await page.locator('select:visible').count(), 0);

    async function choose(id, name) {
      await page.locator(`#${id}-trigger`).click();
      await page.getByRole('option', { name, exact: true }).click();
    }
    await choose('image-count', '3 张');
    assert.equal(await page.evaluate(() => state.imageCount), 3);
    await page.locator('#context-toggle').check();
    await choose('context-count', '最近 10 条对话');
    await page.reload();
    await page.waitForSelector('.session-item');
    assert.match(await page.locator('#image-count-trigger').textContent(), /3 张/);
    assert.match(await page.locator('#context-count-trigger').textContent(), /最近 10/);

    await page.getByRole('button', { name: 'XHS 灵感实验室', exact: true }).click();
    await page.getByRole('button', { name: '文案设置', exact: true }).click();
    await page.locator('#xhs-text-model-quick-trigger').click();
    assert(await page.getByRole('group', { name: 'OpenAI', exact: true }).isVisible());
    await page.getByRole('option', { name: 'gpt-5.1', exact: true }).click();
    assert.equal(await page.locator('#xhs-text-model').inputValue(), 'gpt-5.1');
    await page.locator('#xhs-text-model').fill('my-custom-model');
    await page.getByRole('button', { name: '添加', exact: true }).click();
    await choose('xhs-text-model-quick', 'my-custom-model');
    assert.equal(await page.locator('#xhs-text-model').inputValue(), 'my-custom-model');
    await choose('xhs-text-model-select', 'gemini-3-pro-image-preview');
    assert.equal(await page.locator('#xhs-text-model').inputValue(), 'gemini-3-pro-image-preview');
    await page.getByRole('button', { name: '文案设置', exact: true }).click();
    await choose('xhs-paint-ratio', '16:9');
    await choose('xhs-paint-quality', '4K (超清)');
    assert.equal(await page.locator('#xhs-paint-quality').inputValue(), '4K');
    await page.evaluate(() => {
      const group = document.createElement('optgroup');
      group.label = 'Unavailable';
      group.disabled = true;
      group.appendChild(new Option('Disabled quality', 'disabled'));
      document.getElementById('xhs-paint-quality').appendChild(group);
    });
    await page.locator('#xhs-paint-quality-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#xhs-paint-quality').inputValue(), '4K');
    await page.locator('#xhs-paint-quality-trigger').click();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#xhs-paint-quality-trigger').getAttribute('aria-expanded'), 'false');
    await page.evaluate(() => document.querySelector('#xhs-paint-quality optgroup').remove());
    await page.getByRole('button', { name: '关闭灵感实验室', exact: true }).click();
    await page.locator('#toast').waitFor({ state: 'hidden' });

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { if (document.documentElement.getAttribute('data-theme') !== theme) toggleTheme(); }, theme);
        for (const view of ['main', 'xhs', 'prompts', 'custom', 'slicer']) {
          await page.evaluate(view => {
            XHSCreator.close(); BananaTool.close(); CustomPromptTool.close(); SlicerTool.close();
            if (view === 'xhs') XHSCreator.open();
            if (view === 'prompts') {
              BananaTool.data = []; BananaTool.filteredData = [];
              BananaTool.modal.classList.add('active');
              document.getElementById('banana-loading').style.display = 'none';
              document.getElementById('banana-error').style.display = 'block';
            }
            if (view === 'custom') CustomPromptTool.open();
            if (view === 'slicer') SlicerTool.openLocal();
          }, view);
          const surface = page.locator(view === 'main' ? 'body' : view === 'xhs' ? '#xhs-modal' : view === 'prompts' ? '#banana-modal' : view === 'custom' ? '#custom-prompt-modal' : '#slice-modal');
          assert(await surface.evaluate(el => el.scrollWidth <= el.clientWidth), `${view} must fit at ${width}`);
          if (view === 'prompts') assert(await surface.evaluate(el => !getComputedStyle(el).backgroundColor.includes('rgba')), 'Tool view must not reveal the underlying page');
          if (view === 'slicer') assert((await page.locator('#slice-empty-msg').boundingBox()).width >= 200, 'Empty uploader must remain usable');
          if (view === 'xhs') {
            await page.locator('#xhs-paint-quality-trigger').click();
            const box = await page.locator('.app-select-menu:popover-open').boundingBox();
            assert(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900);
          }
          if (process.env.UI_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.UI_SCREENSHOTS, `${view}-${width}-${theme}.png`), animations: 'disabled' });
          await page.keyboard.press('Escape');
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('UI checks passed: every select enhanced, grouped/dynamic/disabled options, persisted settings, XHS controls and all tool layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
