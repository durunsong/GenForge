const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/renderer/app.ts'), 'utf8');

function options(selectId) {
  const block = html.match(new RegExp(`<select id="${selectId}"[\\s\\S]*?</select>`));
  assert(block, selectId);
  return [...block[0].matchAll(/<option value="([^"]*)">/g)].map(match => match[1]).filter(Boolean);
}

const shortNameSource = app.match(/shortName\(model = ''\) \{([\s\S]*?)\n        \},/);
assert(shortNameSource, 'BrandUI.shortName');
const shortName = new Function('model', shortNameSource[1]);

const imagePresets = [
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
  'gpt-image-2',
  'gpt-image-1.5',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
  'grok-imagine-image-2.0',
  'grok-imagine-image-quality',
  'grok-imagine-image',
];

test('image provider presets list the current OpenAI and Gemini image models', () => {
  assert.deepEqual(options('p-model-select'), imagePresets);
});

test('model short names distinguish Image 2.5 from Image 2', () => {
  assert.equal(shortName('gpt-image-2.5-flare'), 'GPT Image 2.5 Flare');
  assert.equal(shortName('gpt-image-2.5-sunburst'), 'GPT Image 2.5 Sunburst');
  assert.equal(shortName('gpt-image-2'), 'GPT Image 2');
  assert.equal(shortName('gemini-3.1-flash-image'), 'Gemini 3.1 Flash');
  assert.equal(shortName('gemini-3-pro-image'), 'Gemini 3 Pro');
  assert.equal(shortName('gemini-3-pro-image-preview'), 'Gemini 3 Pro');
  assert.equal(shortName('grok-imagine-image-2.0'), 'Grok Imagine 2.0');
  assert.equal(shortName('grok-imagine-image-quality'), 'Grok Imagine Quality');
  assert.equal(shortName('grok-imagine-image'), 'Grok Imagine');
  assert.equal(shortName('grok-2-image-1212'), 'Grok Image');
});
