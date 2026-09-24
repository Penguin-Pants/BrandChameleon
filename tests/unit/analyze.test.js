import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, ScanError, splitFontStack } from "../../src/shared/analyze.js";
import { generate } from "../../src/shared/generate.js";
import { initialEdits } from "../../src/shared/review.js";
import { button, CONTEXT, link, record, scan, text } from "../support/synthetic.js";

const roleHex = (model, role) => model.candidates.find((c) => c.id === model.roles[role])?.hex ?? null;

test("surface falls back from body to html to a full-width wrapper (FR-19)", () => {
  const records = [text("rgb(17, 17, 17)")];
  const fromBody = analyze(scan({ records, backgrounds: { body: "rgb(250, 250, 250)" } }), CONTEXT);
  assert.equal(roleHex(fromBody, "surface"), "#FAFAFA");

  const fromHtml = analyze(scan({ records, backgrounds: { html: "rgb(240, 240, 240)" } }), CONTEXT);
  assert.equal(roleHex(fromHtml, "surface"), "#F0F0F0");

  const fromWrapper = analyze(scan({ records, backgrounds: { wide: "rgb(30, 60, 120)" } }), CONTEXT);
  assert.equal(roleHex(fromWrapper, "surface"), "#1E3C78");
  assert.equal(fromWrapper.notes.surfaceAssumed, false);

  const assumed = analyze(scan({ records }), CONTEXT);
  assert.equal(roleHex(assumed, "surface"), "#FFFFFF");
  assert.equal(assumed.notes.surfaceAssumed, true);
});

test("near-identical colors merge and keep the heaviest exact value (FR-16)", () => {
  const model = analyze(
    scan({
      records: [
        text("rgb(0, 0, 0)"),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)", { count: 3 }),
        button("rgb(100, 92, 255)", "rgb(255, 255, 255)"),
      ],
    }),
    CONTEXT,
  );
  assert.equal(roleHex(model, "primary"), "#635BFF");
  assert.ok(!model.candidates.some((c) => c.hex === "#645CFF"));
});

test("a brand-named custom property wins only with interactive use (FR-21)", () => {
  const records = [
    text("rgb(0, 0, 0)"),
    button("rgb(0, 85, 255)", "rgb(255, 255, 255)", { count: 5 }),
    link("rgb(228, 0, 43)"),
  ];
  const hinted = analyze(scan({ records, customProps: [{ name: "--brand-color", value: "#e4002b" }] }), CONTEXT);
  assert.equal(roleHex(hinted, "primary"), "#E4002B");

  const unused = analyze(
    scan({ records, customProps: [{ name: "--bs-primary", value: "#0d6efd" }] }),
    CONTEXT,
  );
  assert.equal(roleHex(unused, "primary"), "#0055FF");
});

test("monochrome fallback order: button background, then link text (FR-21)", () => {
  const byLink = analyze(scan({ records: [text("rgb(51, 51, 51)"), link("rgb(0, 0, 0)")] }), CONTEXT);
  assert.equal(roleHex(byLink, "primary"), "#000000");

  const none = analyze(scan({ records: [text("rgb(51, 51, 51)")] }), CONTEXT);
  assert.equal(none.roles.primary, null);
});

test("secondary needs 10% of primary weight and distance; tertiary needs distance from both (FR-23)", () => {
  const model = analyze(
    scan({
      records: [
        text("rgb(0, 0, 0)"),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)", { count: 5 }),
        record({ bg: "rgb(0, 212, 255)", count: 10 }),
        record({ bg: "rgb(255, 128, 0)", count: 8 }),
        record({ bg: "rgb(0, 200, 90)", count: 1 }),
      ],
    }),
    CONTEXT,
  );
  assert.equal(roleHex(model, "secondary"), "#00D4FF");
  assert.equal(roleHex(model, "tertiary"), "#FF8000");
  assert.ok(model.candidates.some((c) => c.hex === "#00C85A"));
});

test("neutral keeps distance from surface and on-surface (FR-24)", () => {
  const model = analyze(
    scan({
      backgrounds: { body: "rgb(255, 255, 255)" },
      records: [
        text("rgb(17, 17, 17)"),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)"),
        record({ border: [1, "solid", "rgb(240, 240, 240)"], count: 20 }),
        record({ border: [1, "solid", "rgb(200, 200, 200)"], count: 5 }),
      ],
    }),
    CONTEXT,
  );
  assert.equal(roleHex(model, "neutral"), "#C8C8C8");
});

test("white can be both surface and on-primary (FR-25)", () => {
  const model = analyze(
    scan({
      backgrounds: { body: "rgb(255, 255, 255)" },
      records: [text("rgb(0, 0, 0)"), button("rgb(99, 91, 255)", "rgb(255, 255, 255)")],
    }),
    CONTEXT,
  );
  assert.equal(roleHex(model, "surface"), "#FFFFFF");
  assert.equal(roleHex(model, "on-primary"), "#FFFFFF");
});

test("form control text colors count as color uses", () => {
  const model = analyze(
    scan({ records: [text("rgb(0, 0, 0)"), record({ kind: "input", tag: "input", color: "rgb(12, 34, 56)" })] }),
    CONTEXT,
  );
  assert.ok(model.candidates.some((c) => c.hex === "#0C2238"));
});

test("font stacks keep quoted commas together", () => {
  assert.deepEqual(splitFontStack('"A, Font", Arial, sans-serif'), ["A, Font", "Arial", "sans-serif"]);
  assert.deepEqual(splitFontStack("'Söhne Var', \\\"Quoted\\\" , serif"), ["Söhne Var", '"Quoted"', "serif"]);
  const model = analyze(
    scan({ records: [text("rgb(0, 0, 0)", { font: ['"A, Font", Arial', "16px", "400", "24px", "normal"] })] }),
    CONTEXT,
  );
  // FR-40 removes the comma, but the family is no longer cut at it.
  assert.equal(model.typography["body-md"].family, "A Font");
  assert.equal(model.typography["body-md"].stack, "A Font, Arial");
});

test("component colors outside the 12-candidate palette are kept", () => {
  const busy = Array.from({ length: 14 }, (_, i) =>
    record({ bg: `hsl(${i * 25}, 90%, 50%)`, count: 20, largeBg: false }),
  );
  const model = analyze(
    scan({
      records: [
        text("rgb(0, 0, 0)"),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)", { count: 30 }),
        button("rgb(10, 120, 60)", "rgb(250, 240, 200)", { border: [2, "dashed", "rgb(200, 30, 90)"] }),
        ...busy,
      ],
    }),
    CONTEXT,
  );
  const secondary = model.components["button-secondary"];
  assert.ok(!model.candidates.some((c) => c.id === secondary.bg), "button color is outside the palette");
  const markdown = generate(model, initialEdits(model));
  const block = markdown.split("\n  button-secondary:\n")[1].split(/\n {2}\S/)[0];
  assert.match(block, /backgroundColor: "#0A783C"/);
  assert.match(block, /textColor: "#FAF0C8"/);
  assert.ok(markdown.includes("2px dashed #C81E5A border"));
});

test("percentage radius is ignored, font size keeps 2 decimals, icon sizes use the largest", () => {
  const model = analyze(
    scan({
      page: {
        icons: [
          { rel: "icon", href: "https://acme.example/a.png", sizes: "16x16 64x64", type: "" },
          { rel: "icon", href: "https://acme.example/b.png", sizes: "32x32", type: "" },
        ],
      },
      records: [
        text("rgb(0, 0, 0)", { font: ["Inter", "13.3333px", "400", "normal", "normal"] }),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)", { radius: "10%" }),
      ],
    }),
    CONTEXT,
  );
  assert.equal(model.components["button-primary"].radius, null);
  assert.equal(model.typography["body-md"].fontSize, 13.33);
  const markdown = generate(model, initialEdits(model));
  assert.ok(markdown.includes('fontSize: "13.33px"'));
  assert.ok(!markdown.includes("0px"));
  assert.deepEqual(
    model.logos.slice(0, 2).map((l) => [l.url, l.width]),
    [["https://acme.example/a.png", 64], ["https://acme.example/b.png", 32]],
  );
});

test("body-sm counts only elements that hold text", () => {
  const small = ["Inter", "14px", "400", "20px", "normal"];
  const withEmpty = analyze(
    scan({ records: [text("rgb(0, 0, 0)"), link("rgb(0, 0, 0)", { font: small, count: 3, textLen: 10, textCount: 1 })] }),
    CONTEXT,
  );
  assert.equal(withEmpty.typography["body-sm"], undefined);
  const withText = analyze(
    scan({ records: [text("rgb(0, 0, 0)"), link("rgb(0, 0, 0)", { font: small, count: 3, textLen: 30, textCount: 3 })] }),
    CONTEXT,
  );
  assert.equal(withText.typography["body-sm"].fontSize, 14);

  const mixed = analyze(
    scan({ records: [text("rgb(0, 0, 0)"), link("rgb(0, 0, 0)", { font: small, count: 5, textLen: 30, textCount: 3 })] }),
    CONTEXT,
  );
  assert.equal(mixed.typography["body-sm"].count, 3, "prose counts only text-bearing elements");
  assert.deepEqual(mixed.typography["body-sm"].tags, [{ tag: "a", count: 3 }]);
});

test("a 0px line height is kept as 0", () => {
  const model = analyze(scan({ records: [text("rgb(0, 0, 0)", { font: ["Inter", "16px", "400", "0px", "normal"] })] }), CONTEXT);
  assert.equal(model.typography["body-md"].lineHeight, 0);
  assert.ok(generate(model, initialEdits(model)).includes("    lineHeight: 0\n"));
});

test("transparent navigation areas win the nav background vote", () => {
  const model = analyze(
    scan({
      records: [
        text("rgb(0, 0, 0)"),
        record({ kind: "nav", tag: "nav", count: 20 }),
        record({ kind: "nav", tag: "header", bg: "rgb(200, 0, 0)" }),
        link("rgb(0, 0, 0)", { inNav: true }),
      ],
    }),
    CONTEXT,
  );
  assert.equal(model.components.nav.bg, null);
});

test("a button group takes its most common border", () => {
  const model = analyze(
    scan({
      records: [
        text("rgb(0, 0, 0)"),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)", { border: [2, "solid", "rgb(0, 0, 0)"] }),
        button("rgb(99, 91, 255)", "rgb(255, 255, 255)", { count: 5 }),
      ],
    }),
    CONTEXT,
  );
  assert.equal(model.components["button-primary"].border, null);
  assert.equal(model.components["button-primary"].count, 6);
});

test("the Source block keeps the full URL; the file does not (FR-35, FR-42)", () => {
  const model = analyze(scan({ page: { url: "https://acme.example/app?view=pricing#plans" }, records: [text("rgb(0, 0, 0)")] }), CONTEXT);
  assert.equal(model.source.url, "https://acme.example/app");
  assert.equal(model.source.displayUrl, "https://acme.example/app?view=pricing#plans");
  assert.ok(!generate(model, initialEdits(model)).includes("view=pricing"));
});

test("clustering stays fast on a color-rich page (FR-53)", () => {
  const color = (i) => `rgb(${i % 256}, ${Math.floor(i / 256) % 256}, ${(i * 7) % 256})`;
  const records = Array.from({ length: 5000 }, (_, i) =>
    record({ tag: "p", color: color(i * 3), bg: color(i * 3 + 1), border: [1, "solid", color(i * 3 + 2)], textLen: 10 }),
  );
  const start = Date.now();
  analyze(scan({ records }), CONTEXT);
  assert.ok(Date.now() - start < 1500, `analysis took ${Date.now() - start} ms`);
});

test("brand hints need the exact color on the page, not a near one (FR-21)", () => {
  const model = analyze(
    scan({
      records: [text("rgb(0, 0, 0)"), button("rgb(0, 85, 255)", "rgb(255, 255, 255)", { count: 5 }), link("rgb(228, 0, 43)")],
      customProps: [{ name: "--brand-primary", value: "#e4012c" }],
    }),
    CONTEXT,
  );
  assert.equal(roleHex(model, "primary"), "#0055FF");
});

test("shadows count on every element kind", () => {
  const model = analyze(
    scan({ records: [text("rgb(0, 0, 0)"), record({ kind: "input", tag: "input", shadow: "rgba(0, 0, 0, 0.2) 0px 1px 2px 0px" })] }),
    CONTEXT,
  );
  assert.equal(model.shadows[0].kinds[0].kind, "input");
  assert.ok(generate(model, initialEdits(model)).includes("` on inputs."));
});

test("an unusable header image falls back to the home-link image", () => {
  const model = analyze(
    scan({
      records: [text("rgb(0, 0, 0)")],
      logoImages: {
        byAttr: { src: "data:image/png;base64,AAAA", width: 10, height: 10 },
        byHomeLink: { src: "https://acme.example/logo.svg", width: 120, height: 32 },
      },
    }),
    CONTEXT,
  );
  assert.deepEqual(model.logos[0], { url: "https://acme.example/logo.svg", label: "Header logo", width: 120, height: 32 });
});

test("text directly inside body is content", () => {
  const input = scan();
  input.records[1] = { ...input.records[1], color: "rgb(0, 0, 0)", textLen: 11, font: ["Inter", "16px", "400", "24px", "normal"] };
  assert.doesNotThrow(() => analyze(input, CONTEXT));
});

test("a page with only html and body raises no-content", () => {
  assert.throws(() => analyze(scan(), CONTEXT), (error) => error instanceof ScanError && error.code === "no-content");
});

test("analysis is deterministic (AC-35)", () => {
  const input = scan({
    records: [text("rgb(0, 0, 0)"), button("rgb(99, 91, 255)", "rgb(255, 255, 255)"), link("rgb(0, 212, 255)")],
  });
  assert.deepEqual(analyze(input, CONTEXT), analyze(structuredClone(input), CONTEXT));
});

test("FR-21 the browser's default link blue is not chosen as primary", () => {
  const model = analyze(
    scan({
      backgrounds: { body: "rgb(255, 255, 255)" },
      records: [
        text("rgb(26, 26, 26)", { count: 20 }),
        link("rgb(0, 0, 238)"),
        link("rgb(26, 26, 26)", { count: 30 }),
        record({ kind: "nav", tag: "header", bg: "rgb(0, 59, 149)", color: "rgb(255, 255, 255)" }),
      ],
    }),
    CONTEXT,
  );
  const hexOf = (role) => model.candidates.find((c) => c.id === model.roles[role])?.hex;
  assert.equal(hexOf("primary"), "#003B95");
  assert.ok(!model.candidates.some((c) => c.hex === "#0000EE"), "default link blue is not in the palette");
  assert.ok(!["secondary", "tertiary", "neutral"].some((role) => hexOf(role) === "#0000EE"));

  // Default link text does not count toward a nearby real blue (#0000FF is
  // within the cluster distance of #0000EE).
  const near = analyze(
    scan({
      backgrounds: { body: "rgb(255, 255, 255)" },
      records: [
        text("rgb(17, 17, 17)", { textLen: 50 }),
        button("rgb(0, 0, 255)", "rgb(255, 255, 255)"),
        link("rgb(0, 0, 238)", { count: 40, textLen: 2000 }),
      ],
    }),
    CONTEXT,
  );
  assert.equal(near.candidates.find((c) => c.id === near.roles["on-surface"])?.hex, "#111111");
  assert.equal(near.components.link, undefined, "no link component from unstyled links");

  // A page with only unstyled links has no brand color: you choose primary in review.
  const plain = analyze(scan({ records: [text("rgb(0, 0, 0)"), link("rgb(0, 0, 238)")] }), CONTEXT);
  assert.equal(plain.roles.primary, null);
});
