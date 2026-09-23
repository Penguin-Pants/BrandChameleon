// Sidebar UI with a mocked `browser` API (AC-04, AC-05, AC-21 to AC-31).
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { analyze } from "../../src/shared/analyze.js";
import { installMockBrowser } from "../support/mock-browser.js";
import { scanFixture } from "../support/scan.js";

const CONTEXT = { scannedAt: "2026-09-23T12:00:00.000Z", extVersion: "0.1.0" };
let model;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  model = analyze(await scanFixture(page, "brand-basic"), CONTEXT);
  await page.close();
});

const done = (scanId = "s1", m = model) => ({ status: "done", scanId, hostname: m.source.hostname, model: m });

async function openSidebar(page, initial = {}, { windowId = 1, width = 360, writeDuringFirstGet = null } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(installMockBrowser, { initial, writeDuringFirstGet });
  await page.goto(`/src/sidebar/sidebar.html?window=${windowId}`);
}

const markdown = (page) => page.locator("#markdown").inputValue();
const setScan = (page, windowId, scan) =>
  page.evaluate(([key, value]) => window.__mock.set({ [key]: value }), [`scan:${windowId}`, scan]);
const stored = (page, key) => page.evaluate((k) => window.__mock.get()[k], key);

async function expectNoSeriousA11yIssues(page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes.map((n) => n.target)]))).toEqual([]);
}

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("AC-04 empty state", async ({ page }) => {
  await openSidebar(page);
  await expect(page.locator("#view-empty")).toBeVisible();
  await expect(page.locator("#view-empty")).toHaveText("Click the BrandChameleon toolbar button to scan the current page.");
});

test("a scan that finishes while the sidebar starts is not missed", async ({ page }) => {
  await openSidebar(page, {}, { writeDuringFirstGet: { "scan:1": done("race") } });
  await expect(page.locator("#view-review")).toBeVisible();
  await expect(page.locator("#name-input")).toHaveValue("Acme Corp");
});

test("AC-05 restricted page error, loading state and sidebar timeout", async ({ page }) => {
  await openSidebar(page, { "scan:1": { status: "error", scanId: "e1", hostname: "", error: "restricted" } });
  await expect(page.locator("#error-text")).toHaveText(
    "BrandChameleon cannot scan this page. Firefox blocks extensions on some pages, for example about: pages and addons.mozilla.org. Click the toolbar button to scan again.",
  );

  await setScan(page, 1, { status: "scanning", scanId: "l1", hostname: "acme.example", startedAt: Date.now() });
  await expect(page.locator("#view-loading")).toBeVisible();
  await expect(page.locator("#loading-text")).toHaveText("Scanning acme.example...");
  await expect(page.locator("#view-loading")).toHaveAttribute("aria-busy", "true");

  await setScan(page, 1, { status: "scanning", scanId: "l2", hostname: "acme.example", startedAt: Date.now() - 21000 });
  await expect(page.locator("#error-text")).toContainText("The scan took too long.");
});

test("AC-21 name edits update the file name; empty name blocks download", async ({ page }) => {
  await openSidebar(page, { "scan:1": done() });
  await expect(page.locator("#filename")).toHaveText("acme-corp_design.md");
  await page.fill("#name-input", "Acme Corp, Inc.");
  await expect(page.locator("#filename")).toHaveText("acme-corp-inc_design.md");
  expect(await markdown(page)).toContain('name: "Acme Corp, Inc."');
  await page.fill("#name-input", "");
  await expect(page.locator("#download")).toBeDisabled();
  await expect(page.locator("#blockers")).toHaveText("Enter a name.");
  await expect(page.locator("#status")).toHaveText("Enter a name.");
});

test("AC-22 color role edits and hex validation", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openSidebar(page, { "scan:1": done() });
  const neutralId = model.roles.neutral;
  await page.selectOption("#role-secondary", neutralId);
  expect(await markdown(page)).toContain('secondary: "#E3E8EE"');

  const before = await markdown(page);
  await page.fill("#hex-tertiary", "#12");
  await expect(page.locator("#hex-tertiary")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#hex-error-tertiary")).toBeVisible();
  await expect(page.locator("#status")).toHaveText("Use #RGB, #RRGGBB or #RRGGBBAA.");
  expect(await markdown(page)).toBe(before);

  await page.fill("#hex-tertiary", "#ff8800");
  expect(await markdown(page)).toContain('tertiary: "#FF8800"');
  expect(await markdown(page)).toContain("- **Tertiary (#FF8800):** Set during review.");
  await expect(page.locator("#role-tertiary")).toHaveValue("custom");

  await page.fill("#hex-tertiary", "#FFFFFF00");
  expect(await markdown(page)).toContain('tertiary: "#FFFFFF00"');

  await page.selectOption("#role-tertiary", "none");
  expect(await markdown(page)).not.toContain("tertiary:");
  expect(errors).toEqual([]);
  await expect(page.locator("#role-primary option[value=none]")).toHaveCount(0);
});

test("AC-23 unchecking a group removes it and records the omission", async ({ page }) => {
  await openSidebar(page, { "scan:1": done() });
  await page.uncheck("#group-rounded");
  const text = await markdown(page);
  expect(text).not.toContain("\nrounded:");
  expect(text).not.toContain("## Shapes");
  expect(text).toContain('  - section: rounded\n    reason: "Excluded during review"');
  expect(text).toContain('rounded: "8px"');
  expect(text).not.toContain("{rounded.");
});

test("AC-24 text edits then a field change ask before regenerating", async ({ page }) => {
  await openSidebar(page, { "scan:1": done() });
  const edited = `${await markdown(page)}\nMy note.\n`;
  await page.fill("#markdown", edited);
  await expect(page.locator("#edited-badge")).toBeVisible();

  await page.uncheck("#group-spacing");
  await expect(page.locator("#dialog")).toBeVisible();
  await expect(page.locator("#dialog-cancel")).toBeFocused();
  await page.click("#dialog-cancel");
  expect(await markdown(page)).toBe(edited);
  await expect(page.locator("#group-spacing")).toBeChecked();
  await expect(page.locator("#group-spacing")).toBeFocused();

  await page.uncheck("#group-spacing");
  await page.click("#dialog-confirm");
  expect(await markdown(page)).not.toContain("My note.");
  expect(await markdown(page)).not.toContain("\nspacing:");
  await expect(page.locator("#edited-badge")).toBeHidden();
});

test("AC-25 download saves the textarea content with the FR-31 name", async ({ page }) => {
  await openSidebar(page, { "scan:1": done() });
  await page.fill("#name-input", "Acme Corp");
  await expect.poll(async () => (await stored(page, "review:1"))?.dirty).toBe(true);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download")]);
  expect(download.suggestedFilename()).toBe("acme-corp_design.md");
  const content = await readFile(await download.path(), "utf8");
  expect(content).toBe(await markdown(page));
  await expect(page.locator("#status")).toHaveText("Download started");
  expect((await stored(page, "review:1")).dirty).toBe(false);
});

test("AC-26 raw check warns and allows download anyway", async ({ page }) => {
  await openSidebar(page, { "scan:1": done() });
  await page.fill("#markdown", "# No front matter\n");
  await page.click("#download");
  await expect(page.locator("#dialog")).toBeVisible();
  await expect(page.locator("#dialog-body")).toContainText("The file must start with a --- line.");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#dialog-confirm")]);
  expect(await readFile(await download.path(), "utf8")).toBe("# No front matter\n");
});

test("AC-27 a new scan asks before replacing a dirty review", async ({ page }) => {
  await openSidebar(page, { "scan:1": done("s1") });
  await page.fill("#name-input", "Edited Name");

  await setScan(page, 1, done("s2"));
  await expect(page.locator("#dialog")).toBeVisible();
  await expect(page.locator("#dialog-body")).toContainText("Discard your edits for 127.0.0.1?");
  await expect(page.locator("#dialog-cancel")).toHaveText("Keep");
  await page.click("#dialog-cancel");
  await expect(page.locator("#name-input")).toHaveValue("Edited Name");

  await setScan(page, 1, done("s3"));
  await page.click("#dialog-confirm");
  await expect(page.locator("#name-input")).toHaveValue("Acme Corp");

  // A clean review is replaced without a dialog.
  await setScan(page, 1, done("s4", { ...model, name: "Other Co" }));
  await expect(page.locator("#name-input")).toHaveValue("Other Co");
  await expect(page.locator("#dialog")).toBeHidden();
});

test("AC-28 reloading restores the review, text edits and dirty flag", async ({ page }) => {
  await openSidebar(page, { "scan:1": done() });
  await page.fill("#markdown", "---\nname: \"Kept\"\n---\n");
  await expect.poll(async () => (await stored(page, "review:1"))?.rawText).toBe('---\nname: "Kept"\n---\n');
  await page.reload();
  await expect(page.locator("#markdown")).toHaveValue("---\nname: \"Kept\"\n---\n");
  await expect(page.locator("#edited-badge")).toBeVisible();
  expect((await stored(page, "review:1")).dirty).toBe(true);
});

test("AC-29 each window keeps its own review", async ({ page }) => {
  const other = { ...model, name: "Window Two" };
  await openSidebar(page, { "scan:1": done("a"), "scan:2": done("b", other) }, { windowId: 2 });
  await expect(page.locator("#name-input")).toHaveValue("Window Two");
  expect(await stored(page, "review:2")).toBeTruthy();
  expect(await stored(page, "review:1")).toBeUndefined();
});

test("AC-30 accessibility in every state and dialog", async ({ page }) => {
  await openSidebar(page);
  await expectNoSeriousA11yIssues(page);
  await setScan(page, 1, { status: "scanning", scanId: "l", hostname: "acme.example", startedAt: Date.now() });
  await expectNoSeriousA11yIssues(page);
  await setScan(page, 1, { status: "error", scanId: "e", hostname: "", error: "changed" });
  await expectNoSeriousA11yIssues(page);
  await setScan(page, 1, done("r"));
  await expect(page.locator("#view-review")).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await page.fill("#markdown", "# edited");
  await page.locator("#group-spacing").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#dialog")).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#group-spacing")).toBeFocused();
});

test("AC-30 keyboard reaches every control in order", async ({ page }) => {
  await openSidebar(page, { "scan:1": done() });
  const expected = await page.evaluate(() =>
    [...document.querySelectorAll("#view-review input, #view-review select, #view-review textarea, #download")]
      .filter((el) => !el.disabled && (el.type !== "radio" || el.checked))
      .map((el) => el.id),
  );
  const reached = [];
  await page.locator("body").focus();
  for (let i = 0; i < expected.length + 5; i += 1) {
    await page.keyboard.press("Tab");
    reached.push(await page.evaluate(() => document.activeElement?.id ?? ""));
  }
  const ordered = reached.filter((id) => expected.includes(id));
  expect(ordered.slice(0, expected.length)).toEqual(expected);
});

test("AC-31 no horizontal scroll at 280 px", async ({ page }) => {
  await openSidebar(page, {}, { width: 280 });
  await expectNoHorizontalScroll(page);
  await setScan(page, 1, { status: "error", scanId: "e", hostname: "", error: "restricted" });
  await expectNoHorizontalScroll(page);
  await setScan(page, 1, done("r"));
  await expect(page.locator("#view-review")).toBeVisible();
  await expectNoHorizontalScroll(page);
});
