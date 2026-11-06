const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(
  path.join(root, "src/renderer/index.html"),
  "utf8",
);
const app = fs.readFileSync(path.join(root, "src/renderer/app.ts"), "utf8");

function options(selectId) {
  const block = html.match(
    new RegExp(`<select id="${selectId}"[\\s\\S]*?</select>`),
  );
  assert(block, selectId);
  return [...block[0].matchAll(/<option value="([^"]*)">/g)]
    .map((match) => match[1])
    .filter(Boolean);
}

const shortNameSource = app.match(
  /shortName\(model = ""\) \{([\s\S]*?)\n  \},/,
);
assert(shortNameSource, "BrandUI.shortName");
const shortName = new Function("model", shortNameSource[1]);

const extractSource = app.match(
  /function extractModelIds\(payload\) \{([\s\S]*?)\n\}/,
);
assert(extractSource, "extractModelIds");
const extractModelIds = new Function("payload", extractSource[1]);
const sendSource = app.match(
  /function shouldSendOnEnter\(event, composing, swallowEnter\) \{([\s\S]*?)\n\}/,
);
assert(sendSource, "shouldSendOnEnter");
const shouldSendOnEnter = new Function(
  "event",
  "composing",
  "swallowEnter",
  sendSource[1],
);

test("model lists are loaded from the provider instead of hardcoded options", () => {
  assert.deepEqual(options("p-model-select"), []);
  assert.deepEqual(options("xhs-text-model-select"), []);
  assert.equal(html.includes('value="gpt-image-2.5-flare"'), false);
  assert.match(app, /\/v1\/models/);
  assert.match(app, /\/v1beta\/models/);
  assert.deepEqual(
    extractModelIds({
      data: [
        { id: "gpt-image-2.5-sunburst" },
        { id: "gpt-image-2" },
        { id: "gpt-image-2" },
      ],
    }),
    ["gpt-image-2", "gpt-image-2.5-sunburst"],
  );
  assert.deepEqual(
    extractModelIds({
      models: [
        { name: "models/gemini-3-pro-image" },
        { name: "models/gemini-2.5-flash-image" },
      ],
    }),
    ["gemini-2.5-flash-image", "gemini-3-pro-image"],
  );
  assert.deepEqual(extractModelIds({}), []);
});

test("confirming an IME candidate with Enter does not send", () => {
  const enter = { key: "Enter", isComposing: false, keyCode: 13 };
  assert.equal(
    shouldSendOnEnter(
      { key: "Enter", isComposing: true, keyCode: 229 },
      true,
      false,
    ),
    false,
  );
  assert.equal(shouldSendOnEnter(enter, true, false), false);
  assert.equal(shouldSendOnEnter(enter, false, true), false);
  assert.equal(
    shouldSendOnEnter({ ...enter, shiftKey: true }, false, false),
    false,
  );
  assert.equal(shouldSendOnEnter(enter, false, false), true);
});

test("model short names distinguish Image 2.5 from Image 2", () => {
  assert.equal(shortName("gpt-image-2.5-flare"), "GPT Image 2.5 Flare");
  assert.equal(shortName("gpt-image-2.5-sunburst"), "GPT Image 2.5 Sunburst");
  assert.equal(shortName("gpt-image-2"), "GPT Image 2");
  assert.equal(shortName("gemini-3.1-flash-image"), "Gemini 3.1 Flash");
  assert.equal(shortName("gemini-3-pro-image"), "Gemini 3 Pro");
  assert.equal(shortName("gemini-3-pro-image-preview"), "Gemini 3 Pro");
  assert.equal(shortName("grok-imagine-image-2.0"), "Grok Imagine 2.0");
  assert.equal(shortName("grok-imagine-image-quality"), "Grok Imagine Quality");
  assert.equal(shortName("grok-imagine-image"), "Grok Imagine");
  assert.equal(shortName("grok-2-image-1212"), "Grok Image");
});
