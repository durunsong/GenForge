const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../dist/renderer/index.html')).href);
    await page.waitForSelector('.session-item');
    assert.equal(await page.locator('.session-item').count(), 1);

    await page.locator('.new-chat-btn').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.session-item').count(), 1, 'An idle new chat must not create another');
    assert.equal(await page.locator('#toast').textContent(), '当前已是新对话');

    await page.evaluate(() => activeGenerations.add(currentSessionId));
    await page.locator('.new-chat-btn').click();
    await page.waitForFunction(() => document.querySelectorAll('.session-item').length === 2);
    assert.equal(await page.locator('.session-item').count(), 2, 'A running task must allow another new chat');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
