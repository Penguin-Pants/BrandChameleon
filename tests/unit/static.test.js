// Manifest (AC-02) and source privacy rules (AC-33, FR-03, FR-51).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SRC = new URL("../../src/", import.meta.url).pathname;

async function sourceFiles(dir = SRC) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : [join(dir, entry.name)])),
  );
  return files.flat();
}

test("AC-02 manifest keys and permissions", async () => {
  const manifest = JSON.parse(await readFile(join(SRC, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "BrandChameleon: DESIGN.md Generator");
  assert.equal(manifest.version, "0.1.0");
  assert.deepEqual(manifest.permissions, ["activeTab", "downloads", "scripting", "storage"]);
  for (const key of ["host_permissions", "optional_permissions", "optional_host_permissions", "content_scripts"]) {
    assert.ok(!(key in manifest), `${key} must not exist`);
  }
  const gecko = manifest.browser_specific_settings.gecko;
  assert.equal(gecko.id, "brandchameleon@penguin-pants");
  assert.equal(gecko.strict_min_version, "140.0");
  assert.deepEqual(gecko.data_collection_permissions, { required: ["none"] });
  assert.ok(!("gecko_android" in manifest.browser_specific_settings));
  assert.equal(manifest.sidebar_action.open_at_install, false);
  assert.equal(manifest.sidebar_action.default_panel, "sidebar/sidebar.html");
  assert.equal(manifest.action.default_title, "Scan page with BrandChameleon");
  assert.equal(manifest.background.type, "module");
});

test("AC-33 source has no network, eval or HTML injection APIs", async () => {
  const banned = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /\.innerHTML\b/,
    /\.outerHTML\b/,
    /\binsertAdjacentHTML\b/,
    /<script[^>]*\bsrc=["']https?:/i,
  ];
  for (const file of await sourceFiles()) {
    if (!/\.(js|html)$/.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const pattern of banned) assert.ok(!pattern.test(source), `${file} matches ${pattern}`);
  }
});

test("FR-03 source is not minified", async () => {
  for (const file of await sourceFiles()) {
    if (!file.endsWith(".js")) continue;
    const longest = Math.max(...(await readFile(file, "utf8")).split("\n").map((line) => line.length));
    assert.ok(longest < 200, `${file} has a ${longest}-character line`);
  }
});

const ROOT = new URL("../../", import.meta.url).pathname;

async function pngSize(path) {
  const header = await readFile(path);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

test("AC-37 icons, screenshots, listing summary, privacy policy and license", async () => {
  for (const size of [48, 96, 128]) assert.deepEqual(await pngSize(join(SRC, `icons/icon-${size}.png`)), [size, size]);
  for (const shot of ["1-colors.png", "2-typography.png", "3-markdown.png"]) {
    assert.deepEqual(await pngSize(join(ROOT, "amo/screenshots", shot)), [1280, 800]);
  }
  const listing = await readFile(join(ROOT, "amo/listing.md"), "utf8");
  const summary = listing.split("## Summary (250 characters or fewer)\n\n")[1].split("\n")[0];
  assert.ok(summary.length > 0 && summary.length <= 250, `summary is ${summary.length} characters`);
  assert.match(await readFile(join(ROOT, "PRIVACY.md"), "utf8"), /collects no data/);
  assert.match(await readFile(join(ROOT, "LICENSE"), "utf8"), /^MIT License/);
});

test("AC-38 README sections and manual checklist", async () => {
  const readme = await readFile(join(ROOT, "README.md"), "utf8");
  for (const heading of ["## Install", "## Use", "## Development", "## Build and release"]) {
    assert.ok(readme.includes(heading), heading);
  }
  assert.ok(readme.includes("AMO submission"));
  assert.match(await readFile(join(ROOT, "docs/manual-firefox-checklist.md"), "utf8"), /^# Manual Firefox Checklist/);
});

test("AC-39 CI runs lint and tests on pull requests", async () => {
  const ci = await readFile(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /on:\n\s+pull_request:/);
  assert.match(ci, /run: npm run lint/);
  assert.match(ci, /run: npm test/);
});
