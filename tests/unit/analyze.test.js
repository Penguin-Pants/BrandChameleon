import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, ScanError } from "../../src/shared/analyze.js";
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

test("a page with only html and body raises no-content", () => {
  assert.throws(() => analyze(scan(), CONTEXT), (error) => error instanceof ScanError && error.code === "no-content");
});

test("analysis is deterministic (AC-35)", () => {
  const input = scan({
    records: [text("rgb(0, 0, 0)"), button("rgb(99, 91, 255)", "rgb(255, 255, 255)"), link("rgb(0, 212, 255)")],
  });
  assert.deepEqual(analyze(input, CONTEXT), analyze(structuredClone(input), CONTEXT));
});
