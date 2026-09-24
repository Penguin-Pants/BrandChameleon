import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";
import { lint } from "@google/design.md/linter";
import { analyze } from "../../src/shared/analyze.js";
import { generate } from "../../src/shared/generate.js";
import { checkRawMarkdown } from "../../src/shared/raw-check.js";
import { downloadBlockers, fileNameForReview, initialEdits, parseRoleInput, scanNotes } from "../../src/shared/review.js";
import { button, CONTEXT, link, record, scan, text } from "../support/synthetic.js";

function baseModel(overrides = {}) {
  return analyze(
    scan({
      backgrounds: { body: "rgb(255, 255, 255)" },
      records: [
        text("rgb(17, 17, 17)"),
        record({ kind: "heading", tag: "h1", color: "rgb(17, 17, 17)", textLen: 20, font: ["Georgia, serif", "40px", "700", "48px", "normal"] }),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)", { count: 3 }),
        link("rgb(99, 91, 255)", { count: 4 }),
        record({ kind: "card", border: [1, "solid", "rgb(200, 200, 200)"], radius: "12px", padding: [24, 24, 24, 24], count: 3 }),
      ],
      ...overrides,
    }),
    CONTEXT,
  );
}

const frontMatter = (markdown) => parse(markdown.split("\n---\n")[0].replace(/^---\n/, ""));

test("output is deterministic and lints with 0 errors (AC-35)", () => {
  const model = baseModel();
  const first = generate(model, initialEdits(model));
  assert.equal(first, generate(structuredClone(model), initialEdits(structuredClone(model))));
  assert.equal(lint(first).summary.errors, 0);
});

test("page-derived text is sanitized (AC-34)", () => {
  const model = baseModel({
    page: {
      url: "https://acme.example/pricing?token=secret#plans",
      ogSiteName: 'Evil"\nname: x',
    },
  });
  const edits = initialEdits(model);
  const markdown = generate(model, edits);
  const yaml = frontMatter(markdown);
  assert.equal(Object.keys(yaml).filter((key) => key === "name").length, 1);
  assert.equal(yaml.name, 'Evil" name: x');
  assert.ok(!markdown.includes("token=secret"));
  assert.ok(!markdown.includes("#plans"));
  assert.ok(!markdown.includes("acme.example/pricing"), "CR-2: the file does not name the scanned page");

  const hostile = analyze(
    scan({
      records: [text("rgb(0, 0, 0)", { font: ['"Evil**`\u0007Font", serif', "16px", "400", "24px", "normal"] })],
    }),
    CONTEXT,
  );
  const hostileMarkdown = generate(hostile, initialEdits(hostile));
  assert.ok(hostileMarkdown.includes('fontFamily: "Evil Font"'));
  assert.ok(!hostileMarkdown.includes("\u0007"));
  assert.ok(!hostileMarkdown.includes("**`"));
});

test("a role set to None turns references into literals (FR-38)", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  edits.roles["on-surface"] = null;
  const markdown = generate(model, edits);
  assert.ok(!markdown.includes("on-surface:"));
  assert.ok(markdown.includes('textColor: "#111111"'));
  assert.equal(lint(markdown).summary.errors, 0);
});

test("a shared cluster falls back to the next role in color order (FR-38)", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  edits.roles["on-primary"] = null;
  const markdown = generate(model, edits);
  assert.ok(markdown.includes('textColor: "{colors.surface}"'));
  assert.equal(lint(markdown).summary.errors, 0);
});

test("a hand-set role keeps component references and says so (FR-38, FR-39)", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  edits.roles.primary = { hex: "#E4002B" };
  const markdown = generate(model, edits);
  assert.ok(markdown.includes('primary: "#E4002B"'));
  assert.ok(markdown.includes('backgroundColor: "{colors.primary}"'));
  assert.ok(markdown.includes("- **Primary (#E4002B):** Main brand color.\n"), "a hand-set color has no usage claims");
});

test("uniform padding is a token, mixed padding is prose (FR-38)", () => {
  const model = baseModel();
  model.components["button-primary"].padding = [0, 0, 0, 0];
  assert.ok(generate(model, initialEdits(model)).includes('padding: "0px"'), "zero padding is a real value");
  model.components["button-primary"].padding = [10, 10, 10, 10];
  assert.ok(generate(model, initialEdits(model)).includes('padding: "10px"'));
  model.components["button-primary"].padding = [4, 8, 6, 8];
  const markdown = generate(model, initialEdits(model));
  assert.ok(!/^\s+padding:/m.test(markdown));
  assert.ok(markdown.includes("padding 4px 8px 6px 8px (top, right, bottom and left)"));
});

test("unchecked typography levels and missing groups go to omitted (FR-36)", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  for (const level of Object.keys(edits.typography)) edits.typography[level].include = false;
  const yaml = frontMatter(generate(model, edits));
  assert.deepEqual(yaml.omitted, [{ section: "typography", reason: "Not part of this design system" }]);
  assert.ok(!("typography" in yaml));
  assert.ok(!JSON.stringify(yaml.components).includes("typography"));

  const plain = analyze(scan({ records: [text("rgb(0, 0, 0)")] }), CONTEXT);
  assert.deepEqual(frontMatter(generate(plain, initialEdits(plain))).omitted, [
    { section: "rounded", reason: "No rounded corners defined" },
    { section: "spacing", reason: "No spacing scale defined" },
  ]);
});

test("font family edits change only that level (FR-45)", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  edits.typography["headline-lg"].family = "Playfair Display";
  const yaml = frontMatter(generate(model, edits));
  assert.equal(yaml.typography["headline-lg"].fontFamily, "Playfair Display");
  assert.equal(yaml.typography["body-md"].fontFamily, "Inter");
});

test("low contrast produces Don't rules (FR-39)", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  edits.roles["on-primary"] = { hex: "#8080FF" };
  const markdown = generate(model, edits);
  assert.match(markdown, /- Don't use on-primary text on primary backgrounds for normal-size text \(\d\.\d\d:1, below the WCAG AA minimum of 4\.5:1\)\./);
});

test("a role edited to a fully transparent color is not written as a component background", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  edits.roles.primary = { hex: "#FFFFFF00" };
  const markdown = generate(model, edits);
  const block = markdown.split("\n  button-primary:\n")[1].split(/\n {2}\S/)[0];
  assert.ok(!block.includes("backgroundColor"));
  assert.ok(markdown.includes("- **button-primary:** transparent background"));
  assert.equal(lint(markdown).summary.errors, 0);
});

test("no WCAG claim over a translucent background", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  edits.roles.surface = { hex: "#FFFFFF80" };
  const markdown = generate(model, edits);
  assert.ok(!markdown.includes("on-surface text with surface backgrounds"));
  assert.ok(!markdown.includes("on-surface text on surface backgrounds"));
});

test("logo None removes Brand Assets; a logo adds it last (FR-39)", () => {
  const model = baseModel({ page: { icons: [{ rel: "icon", href: "https://acme.example/i.png", sizes: "32x32", type: "" }] } });
  const edits = initialEdits(model);
  assert.match(generate(model, edits), /## Brand Assets\n\n- \*\*Logo:\*\* https:\/\/acme\.example\/i\.png \(Site icon, 32 x 32 px\)\n$/);
  edits.logo = null;
  assert.ok(!generate(model, edits).includes("## Brand Assets"));
});

test("download blockers and file name (FR-43, FR-44)", () => {
  const model = baseModel();
  const edits = initialEdits(model);
  assert.deepEqual(downloadBlockers(model, edits), []);
  edits.name = "   ";
  edits.roles.primary = null;
  assert.deepEqual(downloadBlockers(model, edits), ["Enter a name.", "Choose a primary color."]);
  edits.name = "Acme Corp, Inc.";
  assert.equal(fileNameForReview(model, edits), "acme-corp-inc_design.md");
});

test("role input parsing (FR-44)", () => {
  const model = baseModel();
  assert.deepEqual(parseRoleInput(model, model.candidates[0].id), { candidate: model.candidates[0].id });
  assert.deepEqual(parseRoleInput(model, "#abc"), { hex: "#AABBCC" });
  assert.equal(parseRoleInput(model, "none"), null);
  assert.equal(parseRoleInput(model, "#12"), undefined);
  assert.deepEqual(parseRoleInput(model, "#FFFFFF00"), { hex: "#FFFFFF00" });
  assert.equal(parseRoleInput(model, null), undefined);
});

test("raw markdown checks (FR-47)", () => {
  assert.deepEqual(checkRawMarkdown('---\nname: "A"\n---\n# A\n'), []);
  assert.deepEqual(checkRawMarkdown("# A\n"), ["The file must start with a --- line."]);
  assert.deepEqual(checkRawMarkdown('---\nname: "A"\n# A\n'), ["The front matter needs a closing --- line."]);
  const missing = ["The front matter needs a name: line with a value."];
  for (const value of ['""', "''", "", "~", "null", "NULL", "# comment only"]) {
    assert.deepEqual(checkRawMarkdown(`---\nname: ${value}\n---\n`), missing, value);
  }
  assert.deepEqual(checkRawMarkdown('---\nname: "Acme #1" # note\n---\n'), []);
  assert.deepEqual(checkRawMarkdown("---\nname: Nullify\n---\n"), []);
});

test("CR-2 the file describes the design, not the scan", () => {
  const model = baseModel({
    page: { url: "https://acme.example/pricing", icons: [] },
    stylesheets: { total: 3, unreadable: 2 },
    limits: { capped: true },
  });
  model.notes = { capped: true, unreadableStylesheets: 2, surfaceAssumed: true };
  const markdown = generate(model, initialEdits(model));
  for (const text of ["BrandChameleon", "0.1.0", "2026-09-23", "acme.example/pricing", "extracted", "scan", "could not be read",
    "not inferred", "not verified", "Browser default", "other use", "used 3 times", "Set during review"]) {
    assert.ok(!markdown.toLowerCase().includes(text.toLowerCase()), `must not contain "${text}"`);
  }
  assert.doesNotMatch(markdown, /\b\d+ (links?|buttons?|headings?|elements?|times|cards?)\b/);
  assert.equal(lint(markdown).summary.errors, 0);
});

test("CR-2 description and Overview give a factual look and feel", () => {
  const model = baseModel();
  const markdown = generate(model, initialEdits(model));
  assert.equal(frontMatter(markdown).description, "Light theme with violet (#635BFF) as the primary color.");
  const overview = markdown.split("## Overview\n\n")[1].split("\n")[0];
  assert.equal(
    overview,
    "Light theme with white (#FFFFFF) pages and near-black (#111111) text. The primary color is violet (#635BFF). " +
      "Headings use Georgia and body text uses Inter. Corners are 8px on buttons and 12px on cards.",
  );
  assert.ok(markdown.includes("- **Primary (#635BFF):** Main brand color. Used for button backgrounds and link text.\n"));
  assert.ok(markdown.includes("- **headline-lg:** Georgia, 40px, weight 700. Used on `h1` elements. Full stack: Georgia, serif.\n"));
  assert.ok(markdown.includes("- **sm (8px):** Used on buttons.\n"));
  assert.ok(markdown.includes("- **sm:** 12px\n"));
});

test("CR-2 a monochrome palette says so in the Overview", () => {
  const model = analyze(
    scan({ backgrounds: { body: "rgb(255, 255, 255)" }, records: [text("rgb(17, 17, 17)"), button("rgb(0, 0, 0)", "rgb(255, 255, 255)")] }),
    CONTEXT,
  );
  const markdown = generate(model, initialEdits(model));
  assert.ok(markdown.includes("The palette is monochrome. The primary color is black (#000000)."));
});

test("CR-2 scan notes go to the sidebar", () => {
  assert.deepEqual(scanNotes({ notes: { capped: false, unreadableStylesheets: 0, surfaceAssumed: false } }), []);
  assert.deepEqual(scanNotes({ notes: { capped: true, unreadableStylesheets: 1, surfaceAssumed: true } }), [
    "The page has more elements than the scan limit. Some elements were not read.",
    "1 stylesheet from other sites could not be read. Its custom property names are not used.",
    "The page sets no background color. Surface is set to white, the browser default.",
  ]);
  assert.equal(scanNotes({ notes: { unreadableStylesheets: 4 } })[0].split(".")[0], "4 stylesheets from other sites could not be read");
});
