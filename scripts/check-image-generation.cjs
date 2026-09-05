const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, before, after } = require('node:test');
const { chromium } = require('playwright');

// Run after build:renderer with Playwright available on NODE_PATH.
const appUrl = pathToFileURL(path.resolve(__dirname, '../dist/renderer/index.html')).href;
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });

async function openApp(t, type = 'images', storedCount) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No uncaught renderer errors'));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(({ type, storedCount }) => {
    localStorage.setItem('gemini_providers', JSON.stringify([{
      id: 'test', name: 'Test', type: type === 'gemini' ? 'gemini' : 'openai',
      openaiMode: type === 'chat' ? 'chat' : 'images', host: 'https://images.test',
      key: 'test-only', model: type === 'images' ? 'gpt-image-1.5' : 'gemini-3-pro-image-preview',
    }]));
    localStorage.setItem('gemini_active_provider', 'test');
    if (storedCount !== undefined) localStorage.setItem('image_count', storedCount);
  }, { type, storedCount });
  await page.goto(appUrl);
  await page.waitForSelector('.session-item');
  return page;
}

async function generate(page, count) {
  await page.evaluate(count => { state.imageCount = count; }, count);
  await page.locator('#user-input').fill('Generate a red square');
  await page.locator('#send-btn').click();
}

async function waitForMessages(page, count) {
  await page.waitForFunction(count => document.querySelectorAll('.message-row.bot[data-message-id]').length === count, count);
  await page.waitForFunction(() => activeGenerations.size === 0);
}

test('Images API sends the selected count and keeps every result in history and auto-save', async t => {
  const page = await openApp(t);
  const requests = [];
  await page.route('https://images.test/v1/images/generations', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: Array.from({ length: 4 }, () => ({ b64_json: png })) } });
  });
  await page.evaluate(() => {
    window.savedFiles = [];
    FileSystemManager.isEnabled = true;
    FileSystemManager.directoryHandle = {
      queryPermission: async () => 'granted',
      getFileHandle: async name => ({ createWritable: async () => ({
        write: async blob => window.savedFiles.push({ name, size: blob.size }), close: async () => {},
      }) }),
    };
  });
  await generate(page, 4);
  await waitForMessages(page, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].n, 4);
  assert.equal(await page.locator('.message-row.bot img.generated-image').count(), 4);
  const stored = await page.evaluate(async () => (await getSessionMessages(currentSessionId)).at(-1));
  assert.equal(stored.images.length, 4);
  await page.waitForFunction(() => window.savedFiles.length === 4);
  const files = await page.evaluate(() => window.savedFiles);
  assert.equal(new Set(files.map(file => file.name)).size, 4, 'Auto-save filenames must not collide');
  assert(files.every(file => file.size > 0));
  await page.reload();
  await page.waitForSelector('.message-row.bot img.generated-image');
  assert.equal(await page.locator('.message-row.bot img.generated-image').count(), 4);
});

test('Count control defaults to one, persists choices, and rejects invalid stored counts', async t => {
  const page = await openApp(t);
  const control = page.locator('#image-count');
  await page.locator('#image-count-trigger').waitFor({ timeout: 3000 });
  assert.equal(await control.inputValue(), '1');
  for (const count of ['2', '3', '4']) {
    await page.locator('#image-count-trigger').click();
    await page.getByRole('option', { name: `${count} 张`, exact: true }).click();
    assert.equal(await page.evaluate(() => state.imageCount), Number(count));
  }
  await page.reload();
  await page.waitForSelector('.session-item');
  assert.equal(await control.inputValue(), '4');
  for (const invalid of ['0', '5', '2.5', 'bad']) {
    await page.evaluate(value => localStorage.setItem('image_count', value), invalid);
    await page.reload();
    await page.waitForSelector('.session-item');
    assert.equal(await control.inputValue(), '1');
  }
});

test('Reference-image edits include the count in multipart form data', async t => {
  const page = await openApp(t);
  let body = '';
  await page.route('https://images.test/v1/images/edits', async route => {
    body = route.request().postDataBuffer().toString();
    await route.fulfill({ json: { data: [{ b64_json: png }, { b64_json: png }, { b64_json: png }] } });
  });
  await page.evaluate(png => useAsReference(`data:image/png;base64,${png}`), png);
  await generate(page, 3);
  await waitForMessages(page, 1);
  assert.match(body, /name="n"\r\n\r\n3\r\n/);
  assert.match(body, /name="image\[\]"/);
  assert.equal(await page.locator('.message-row.bot img.generated-image').count(), 3);
});

test('Image streams collect all completed images, including the final unterminated line', async t => {
  const page = await openApp(t);
  let request;
  await page.route('https://images.test/v1/images/generations', async route => {
    request = route.request().postDataJSON();
    const events = [
      { type: 'image_generation.partial_image', b64_json: png, partial_image_index: 0 },
      { type: 'image_generation.completed', b64_json: png, output_format: 'png' },
      { type: 'image_generation.completed', data: [{ b64_json: png }, { b64_json: png }], output_format: 'png' },
    ];
    await route.fulfill({ contentType: 'text/event-stream', body: events.map(event => `data: ${JSON.stringify(event)}`).join('\r\n\r\n') });
  });
  await page.locator('#stream-toggle').check();
  await generate(page, 3);
  await waitForMessages(page, 1);
  assert.equal(request.n, 3);
  assert.equal(request.stream, true);
  assert.equal(await page.locator('.message-row.bot img.generated-image').count(), 3);
  assert.equal(await page.locator('[id^="stream-image-preview-"]').count(), 0);
});

for (const type of ['gemini', 'chat']) {
  test(`${type} generates four attempts with a fixed context and retains successes after one failure`, async t => {
    const page = await openApp(t, type);
    const requests = [];
    await page.route('https://images.test/**', async route => {
      const payload = route.request().postDataJSON();
      requests.push(payload);
      if (requests.length === 1) {
        await page.evaluate(() => {
          state.imageCount = 1; state.resolution = '4K'; state.aspectRatio = '9:16';
          state.useContext = false;
        });
      }
      if (requests.length === 2) {
        await route.fulfill({ status: 503, json: { error: { message: 'Temporary generation failure' } } });
      } else if (type === 'gemini') {
        await route.fulfill({ json: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] } });
      } else {
        await route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content: `![square](data:image/png;base64,${png})` } }] })}\n\ndata: [DONE]\n\n` });
      }
    });
    await page.evaluate(async () => {
      await saveMessage(currentSessionId, 'user', 'Earlier prompt');
      await saveMessage(currentSessionId, 'bot', 'Earlier reply');
      state.useContext = true;
    });
    if (type === 'chat') await page.locator('#stream-toggle').check();
    await generate(page, 4);
    await page.waitForFunction(() => document.querySelectorAll('.message-row.bot[data-message-id]').length >= 4);
    await page.waitForFunction(() => activeGenerations.size === 0);
    assert.equal(requests.length, 4);
    requests.slice(1).forEach(request => assert.deepEqual(request, requests[0], 'Batch settings and context must stay fixed'));
    assert.equal(await page.locator('.message-row.bot img.generated-image').count(), 3);
    assert.match(await page.locator('#chat-history').textContent(), /Temporary generation failure/);
    const messages = await page.evaluate(() => getSessionMessages(currentSessionId));
    assert.equal(messages.filter(message => message.role === 'user').length, 2, 'Batch prompt is stored only once');
    assert.equal(messages.reduce((sum, message) => sum + message.images.length, 0), 3);
  });
}

test('Empty image responses show an error and release generation state', async t => {
  const page = await openApp(t);
  await page.route('https://images.test/v1/images/generations', route => route.fulfill({ json: { data: [] } }));
  await generate(page, 2);
  await waitForMessages(page, 1);
  const messages = await page.evaluate(() => getSessionMessages(currentSessionId));
  assert.equal(messages.at(-1).content, 'Error');
  assert.equal(await page.locator('.message-row.bot img.generated-image').count(), 0);
});

test('A short response preserves available images and reports the missing count', async t => {
  const page = await openApp(t);
  await page.route('https://images.test/v1/images/generations', route => route.fulfill({ json: { data: [{ b64_json: png }] } }));
  await generate(page, 4);
  await waitForMessages(page, 1);
  assert.equal(await page.locator('.message-row.bot img.generated-image').count(), 1);
  assert.match(await page.locator('.message-row.bot').textContent(), /1\/4/);
});

test('An invalid runtime count falls back to one and repeated sends cannot duplicate a batch', async t => {
  const page = await openApp(t);
  const requests = [];
  let finish;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  await page.route('https://images.test/v1/images/generations', route => {
    requests.push(route.request().postDataJSON());
    finish = () => route.fulfill({ json: { data: [{ b64_json: png }] } });
    markStarted();
  });
  await generate(page, 99);
  await started;
  assert.equal(requests.length, 1);
  assert.equal(requests[0].n, 1);
  await page.locator('#user-input').fill('Next prompt');
  await page.evaluate(() => { void sendMessage(); });
  assert.equal(await page.locator('#user-input').inputValue(), 'Next prompt');
  await finish();
  await waitForMessages(page, 1);
  assert.equal(requests.length, 1);
  assert.equal(await page.locator('.message-row.user').count(), 1);
});

test('A background batch error cannot remove the visible conversation stream', async t => {
  const page = await openApp(t);
  let failRequest;
  const started = new Promise(resolve => {
    page.route('https://images.test/v1/images/generations', route => {
      failRequest = () => route.fulfill({ status: 503, json: { error: { message: 'Background failure' } } });
      resolve();
    });
  });
  await generate(page, 2);
  await started;
  await page.evaluate(async () => {
    await createNewSession('Foreground');
    const response = new Response(new ReadableStream({ start(controller) {
      window.foregroundController = controller;
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Foreground preview"}}]}\n\n'));
    } }));
    window.foregroundStream = parseStreamResponse(response, null, currentSessionId);
  });
  await page.getByText('Foreground preview', { exact: true }).waitFor();
  await failRequest();
  await page.waitForFunction(() => activeGenerations.size === 0);
  assert(await page.getByText('Foreground preview', { exact: true }).isVisible());
  await page.evaluate(async () => { window.foregroundController.close(); await window.foregroundStream; });
});

test('A stream failure retains images that already completed and reports the error', async t => {
  const page = await openApp(t);
  await page.route('https://images.test/v1/images/generations', route => route.fulfill({
    contentType: 'text/event-stream',
    body: [
      { type: 'image_generation.completed', b64_json: png },
      { type: 'error', error: { message: 'Remaining images failed' } },
    ].map(event => `data: ${JSON.stringify(event)}\n\n`).join(''),
  }));
  await page.locator('#stream-toggle').check();
  await generate(page, 3);
  await waitForMessages(page, 1);
  const stored = await page.evaluate(async () => (await getSessionMessages(currentSessionId)).at(-1));
  assert.equal(stored.images.length, 1);
  assert.match(stored.rawHtml, /Remaining images failed/);
  assert.match(stored.rawHtml, /1\/3/);
});
