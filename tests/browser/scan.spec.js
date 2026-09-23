// Collector + analysis + generator on real fixture pages in Chromium.
import { test, expect } from "@playwright/test";
import { lint } from "@google/design.md/linter";
import { collectPage } from "../../src/collector/collect-page.js";
import { analyze, ScanError } from "../../src/shared/analyze.js";
import { GROUPS } from "../../src/shared/constants.js";
import { generate } from "../../src/shared/generate.js";
import { initialEdits } from "../../src/shared/review.js";
import { COLLECTOR_OPTIONS, scanFixture } from "../support/scan.js";

const CONTEXT = { scannedAt: "2026-09-23T12:00:00.000Z", extVersion: "0.1.0" };
const FIXTURES = [
  "brand-basic", "mono", "framework-leftover", "overlay", "hidden", "shadow",
  "cross-origin", "sparse", "classify", "large", "logos", "clobber", "wide", "many-props",
];

async function analyzeFixture(page, name) {
  const scan = await scanFixture(page, name);
  const model = analyze(scan, CONTEXT);
  return { scan, model, markdown: generate(model, initialEdits(model)) };
}

const roleHexes = (model) =>
  Object.fromEntries(
    Object.entries(model.roles).map(([role, id]) => [role, id ? model.candidates.find((c) => c.id === id).hex : null]),
  );
const candidateHexes = (model) => model.candidates.map((c) => c.hex);

test("AC-06 brand-basic color roles", async ({ page }) => {
  const { model } = await analyzeFixture(page, "brand-basic");
  expect(roleHexes(model)).toEqual({
    primary: "#635BFF",
    secondary: "#00D4FF",
    tertiary: null,
    neutral: "#E3E8EE",
    surface: "#FFFFFF",
    "on-surface": "#1A1F36",
    "on-primary": "#FFFFFF",
  });
  expect(model.name).toBe("Acme Corp");
  expect(model.candidates.length).toBeLessThanOrEqual(12);
});

test("AC-07 unused framework variables do not set primary", async ({ page }) => {
  const { model } = await analyzeFixture(page, "framework-leftover");
  expect(roleHexes(model).primary).toBe("#E4002B");
});

test("AC-08 monochrome brand uses the button color", async ({ page }) => {
  const { model, markdown } = await analyzeFixture(page, "mono");
  expect(roleHexes(model).primary).toBe("#000000");
  expect(roleHexes(model)["on-primary"]).toBe("#FFFFFF");
  expect(markdown).toContain("The brand palette is monochrome. No saturated color is used on buttons or links.");
});

test("AC-09 consent and chat overlays are skipped, bakery content is kept", async ({ page }) => {
  const { model } = await analyzeFixture(page, "overlay");
  const hexes = candidateHexes(model);
  for (const hex of ["#1F8B24", "#FF00AA", "#FAFAFA", "#333333"]) expect(hexes).not.toContain(hex);
  expect(hexes).toContain("#8B4513");
});

test("AC-10 hidden elements are skipped", async ({ page }) => {
  const { model } = await analyzeFixture(page, "hidden");
  const hexes = candidateHexes(model);
  for (const hex of ["#FF0000", "#00FF00", "#0000FF", "#FFA500"]) expect(hexes).not.toContain(hex);
  // A visible child of a visibility:hidden parent still counts.
  expect(hexes).toContain("#800080");
});

test("AC-11 open shadow roots are read, closed ones are not", async ({ page }) => {
  const { model } = await analyzeFixture(page, "shadow");
  expect(candidateHexes(model)).toContain("#E4002B");
  expect(candidateHexes(model)).not.toContain("#00AA55");
  expect(roleHexes(model).primary).toBe("#E4002B");
});

test("AC-12 cross-origin stylesheets are counted and reported", async ({ page }) => {
  const { scan, markdown } = await analyzeFixture(page, "cross-origin");
  expect(scan.stylesheets).toEqual({ readable: 1, unreadable: 1 });
  expect(scan.customProps.map((p) => p.name)).toEqual(["--local-brand"]);
  expect(markdown).toContain("1 stylesheet could not be read");
});

test("AC-13 typography levels", async ({ page }) => {
  const { model } = await analyzeFixture(page, "brand-basic");
  const pick = (level) => {
    const { family, fontSize, fontWeight, lineHeight, letterSpacing } = model.typography[level];
    return { family, fontSize, fontWeight, lineHeight, letterSpacing };
  };
  expect(pick("headline-lg")).toEqual({ family: "Inter", fontSize: 48, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.02 });
  expect(pick("headline-md")).toEqual({ family: "Inter", fontSize: 32, fontWeight: 600, lineHeight: 1.25, letterSpacing: null });
  expect(pick("headline-sm")).toEqual({ family: "Inter", fontSize: 24, fontWeight: 600, lineHeight: 1.33, letterSpacing: null });
  expect(pick("body-md")).toEqual({ family: "Inter", fontSize: 16, fontWeight: 400, lineHeight: 1.5, letterSpacing: null });
  expect(pick("body-sm")).toEqual({ family: "Inter", fontSize: 14, fontWeight: 400, lineHeight: 1.43, letterSpacing: null });
  expect(pick("label-md")).toEqual({ family: "Inter", fontSize: 15, fontWeight: 600, lineHeight: 1.33, letterSpacing: null });

  const sparse = await analyzeFixture(page, "sparse");
  expect(Object.keys(sparse.model.typography)).toEqual(["body-md"]);
});

test("AC-14 rounded and spacing scales", async ({ page }) => {
  const { model, markdown } = await analyzeFixture(page, "brand-basic");
  expect(model.rounded.scale.map(({ name, px }) => [name, px])).toEqual([["sm", 4], ["md", 8]]);
  expect(model.rounded.full).not.toBeNull();
  expect(markdown).toContain('rounded:\n  sm: "4px"\n  md: "8px"\n  full: "9999px"\n');
  expect(model.spacing.map(({ name, px }) => [name, px])).toEqual([["xs", 8], ["sm", 12], ["md", 16], ["lg", 24], ["xl", 32]]);
});

test("AC-15 components use references and strict padding", async ({ page }) => {
  const { markdown } = await analyzeFixture(page, "brand-basic");
  const yaml = markdown.split("\n---\n")[0];
  const block = (name) => yaml.split(`\n  ${name}:\n`)[1].split(/\n {2}\S/)[0];
  const primary = block("button-primary");
  expect(primary).toContain('backgroundColor: "{colors.primary}"');
  expect(primary).toContain('textColor: "{colors.on-primary}"');
  expect(primary).toContain('rounded: "{rounded.md}"');
  expect(primary).toContain('typography: "{typography.label-md}"');
  expect(primary).not.toContain("padding:");
  expect(markdown).toContain("12px vertical and 24px horizontal padding");
  expect(block("button-secondary")).not.toContain("backgroundColor");
  expect(markdown).toContain("1px solid #635BFF border");
});

test("AC-16 every fixture and every group combination lints with 0 errors", async ({ page }) => {
  for (const name of FIXTURES) {
    const { markdown } = await analyzeFixture(page, name);
    const { summary, findings } = lint(markdown);
    expect(summary.errors, `${name}: ${JSON.stringify(findings)}`).toBe(0);
  }
  const { model } = await analyzeFixture(page, "brand-basic");
  for (let mask = 0; mask < 16; mask += 1) {
    const edits = initialEdits(model);
    GROUPS.forEach((group, i) => {
      edits.groups[group] = Boolean(mask & (1 << i));
    });
    const markdown = generate(model, edits);
    const { summary, findings } = lint(markdown);
    expect(summary.errors, `mask ${mask}: ${JSON.stringify(findings)}`).toBe(0);
    for (const [i, group] of GROUPS.entries()) {
      if (!(mask & (1 << i))) expect(markdown).toContain(`  - section: ${group}\n    reason: "Excluded during review"`);
    }
  }
});

test("AC-17 section order, Brand Assets last, empty sections absent", async ({ page }) => {
  const { markdown } = await analyzeFixture(page, "brand-basic");
  const headings = markdown.match(/^## .+$/gm);
  expect(headings).toEqual([
    "## Overview", "## Colors", "## Typography", "## Layout", "## Elevation & Depth",
    "## Shapes", "## Components", "## Do's and Don'ts", "## Brand Assets",
  ]);
  const sparse = await analyzeFixture(page, "sparse");
  const sparseHeadings = sparse.markdown.match(/^## .+$/gm);
  expect(sparseHeadings).not.toContain("## Elevation & Depth");
  expect(sparseHeadings).not.toContain("## Shapes");
  expect(sparseHeadings.at(-1)).toBe("## Brand Assets");
});

test("AC-20 logo candidates follow FR-32 order", async ({ page, baseURL }) => {
  const basic = await analyzeFixture(page, "brand-basic");
  const assets = `${baseURL}/tests/fixtures/pages/assets`;
  expect(basic.model.logos.map((l) => [l.label, l.url])).toEqual([
    ["Header logo", `${assets}/logo.svg`],
    ["Apple touch icon", `${assets}/apple-touch-icon.png`],
    ["Site icon", `${assets}/favicon.svg`],
    ["Default favicon path (not verified)", `${baseURL}/favicon.ico`],
    ["Social preview image (og:image)", `${baseURL}/tests/fixtures/pages/assets/og.png`],
  ]);
  expect(basic.model.logos[0]).toMatchObject({ width: 120, height: 32 });

  const logos = await analyzeFixture(page, "logos");
  expect(logos.model.logos.map((l) => l.url)).toEqual([
    `${baseURL}/tests/fixtures/pages/icon-32.png`,
    `${baseURL}/icon-16.png`,
    `${baseURL}/favicon.ico`,
    `${baseURL}/tests/fixtures/pages/social.png`,
  ]);
});

test("FR-11 links with the parent background are links, filled links are buttons", async ({ page }) => {
  const { scan } = await analyzeFixture(page, "classify");
  const anchors = scan.records.filter((r) => r.tag === "a");
  expect(anchors.map((r) => r.kind)).toEqual(["link", "button"]);
  // A transparent border is not a visible border: that link merges into the link record.
  expect(anchors[0].count).toBe(2);
  // An elliptical corner is neither a radius value nor "full".
  const elliptical = scan.records.find((r) => r.tag === "button");
  expect(elliptical.radius).toBeNull();
  expect(elliptical.radiusFull).toBe(false);
});

test("FR-29 percentage gaps are not spacing values", async ({ page }) => {
  const { scan } = await analyzeFixture(page, "classify");
  const gaps = scan.records.filter((r) => r.gap).flatMap((r) => r.gap);
  expect(gaps.length).toBeGreaterThan(0);
  expect(gaps.every((value) => value === null)).toBe(true);
});

test("DOM clobbering by form inputs does not break the scan", async ({ page }) => {
  const { model } = await analyzeFixture(page, "clobber");
  expect(roleHexes(model).primary).toBe("#E4002B");
});

test("FR-06 no visible content raises a scan error", async ({ page }) => {
  const scan = await scanFixture(page, "empty");
  expect(() => analyze(scan, CONTEXT)).toThrow(ScanError);
});

test("FR-10 a huge sibling list stays within the node limit", async ({ page }) => {
  await page.goto("/tests/fixtures/pages/wide.html");
  const start = Date.now();
  const scan = await page.evaluate(collectPage, COLLECTOR_OPTIONS);
  expect(Date.now() - start).toBeLessThan(3000);
  expect(scan.limits.capped).toBe(true);
  expect(scan.limits.visited).toBeLessThanOrEqual(50000);
  // Depth-first order: the early nested button is read before later siblings.
  expect(analyze(scan, CONTEXT).candidates.map((c) => c.hex)).toContain("#E4002B");
});

test("FR-13 a brand custom property after 500 others still counts", async ({ page }) => {
  const { scan, model } = await analyzeFixture(page, "many-props");
  expect(scan.customProps.length).toBeGreaterThan(600);
  expect(roleHexes(model).primary).toBe("#E4002B");
});

test("AC-32 large page stays fast and small", async ({ page }) => {
  await page.goto("/tests/fixtures/pages/large.html");
  const start = Date.now();
  const scan = await page.evaluate(collectPage, COLLECTOR_OPTIONS);
  const model = analyze(scan, CONTEXT);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(3000);
  expect(scan.limits.capped).toBe(true);
  expect(scan.limits.visible).toBe(5000);
  const stored = JSON.stringify({ model, edits: initialEdits(model), markdown: generate(model, initialEdits(model)) });
  expect(stored.length).toBeLessThan(1024 * 1024);
  expect(generate(model, initialEdits(model))).toContain("The scan reached its element limit.");
});

test("Regression snapshot of brand-basic output", async ({ page }) => {
  const { markdown } = await analyzeFixture(page, "brand-basic");
  expect(markdown).toMatchSnapshot("brand-basic.md");
});
