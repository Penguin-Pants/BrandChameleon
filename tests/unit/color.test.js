import { test } from "node:test";
import assert from "node:assert/strict";
import {
  colorName,
  contrastRatio,
  isValidHexInput,
  normalizeColor,
  oklabDistance,
  oklchChroma,
  parseColor,
} from "../../src/shared/color.js";

test("parses hex in all lengths", () => {
  assert.equal(normalizeColor("#abc"), "#AABBCC");
  assert.equal(normalizeColor("#abcd"), "#AABBCCDD");
  assert.equal(normalizeColor("#635bff"), "#635BFF");
  assert.equal(normalizeColor("#635bff80"), "#635BFF80");
  assert.equal(normalizeColor("#12345"), null);
});

test("parses named colors and skips transparent", () => {
  assert.equal(normalizeColor("RebeccaPurple"), "#663399");
  assert.equal(normalizeColor("transparent"), null);
  assert.equal(normalizeColor("currentcolor"), null);
});

test("parses legacy and modern rgb syntax", () => {
  assert.equal(normalizeColor("rgb(99, 91, 255)"), "#635BFF");
  assert.equal(normalizeColor("rgba(0, 0, 0, 0.5)"), "#00000080");
  assert.equal(normalizeColor("rgb(99 91 255 / 50%)"), "#635BFF80");
  assert.equal(normalizeColor("rgb(100% 0% 0%)"), "#FF0000");
  assert.equal(normalizeColor("rgba(0, 0, 0, 0)"), null);
});

test("parses hsl and hwb", () => {
  assert.equal(normalizeColor("hsl(0, 100%, 50%)"), "#FF0000");
  assert.equal(normalizeColor("hsl(120deg 100% 25%)"), "#008000");
  assert.equal(normalizeColor("hsla(240, 100%, 50%, 0.5)"), "#0000FF80");
  assert.equal(normalizeColor("hwb(0 0% 0%)"), "#FF0000");
  assert.equal(normalizeColor("hwb(0 50% 50%)"), "#808080");
});

test("parses oklch, oklab, lab and lch close to reference values", () => {
  // Reference sRGB values for these inputs.
  assert.equal(normalizeColor("oklch(0.627955 0.257683 29.2339)"), "#FF0000");
  assert.equal(normalizeColor("oklab(1 0 0)"), "#FFFFFF");
  assert.equal(normalizeColor("oklch(0 0 0)"), "#000000");
  // CSS lab() and lch() use a D50 white point.
  assert.equal(normalizeColor("lab(54.29 80.8 69.89)"), "#FF0000");
  assert.equal(normalizeColor("lch(54.29 106.84 40.85)"), "#FF0000");
  assert.equal(normalizeColor("oklch(62.8% 0.2577 29.23 / 0.5)"), "#FF000080");
});

test("parses color() spaces", () => {
  assert.equal(normalizeColor("color(srgb 1 0 0)"), "#FF0000");
  assert.equal(normalizeColor("color(srgb 0.388 0.357 1)"), "#635BFF");
  assert.equal(normalizeColor("color(srgb-linear 1 1 1)"), "#FFFFFF");
  assert.equal(normalizeColor("color(xyz-d65 0.9505 1 1.089)"), "#FFFFFF");
  assert.equal(normalizeColor("color(xyz-d50 0.9642 1 0.8251)"), "#FFFFFF");
  // display-p3 red is outside sRGB and clips to pure red.
  assert.equal(normalizeColor("color(display-p3 1 0 0)"), "#FF0000");
  assert.equal(normalizeColor("color(a98-rgb 1 1 1)"), "#FFFFFF");
  assert.equal(normalizeColor("color(prophoto-rgb 1 1 1)"), "#FFFFFF");
  assert.equal(normalizeColor("color(rec2020 1 1 1)"), "#FFFFFF");
});

test("skips unsupported values", () => {
  for (const value of [
    "color-mix(in srgb, red, blue)",
    "light-dark(white, black)",
    "var(--x)",
    "rgb(from red r g b)",
    "Canvas",
    "",
    "none",
    "12px",
  ]) {
    assert.equal(parseColor(value), null, value);
  }
});

test("OKLab distance, chroma and contrast", () => {
  assert.equal(oklabDistance("#FFFFFF", "#FFFFFF"), 0);
  assert.ok(oklabDistance("#000000", "#FFFFFF") > 0.99);
  assert.ok(oklabDistance("#635BFF", "#645CFF") < 0.03);
  assert.ok(oklchChroma("#808080") < 0.001);
  assert.ok(oklchChroma("#635BFF") > 0.04);
  assert.equal(contrastRatio("#000000", "#FFFFFF").toFixed(2), "21.00");
  assert.equal(contrastRatio("#FFFFFF", "#FFFFFF").toFixed(2), "1.00");
});

test("contrast paints translucent colors before measuring", () => {
  // Alpha 0x80 (0.502) black over white renders as #7F7F7F: 4.00:1, not 21:1.
  assert.equal(contrastRatio("#00000080", "#FFFFFF").toFixed(2), "4.00");
  assert.equal(contrastRatio("#000000", "#FFFFFF80").toFixed(2), "21.00");
});

test("validates review hex input", () => {
  assert.ok(isValidHexInput("#abc"));
  assert.ok(isValidHexInput("#AABBCC"));
  assert.ok(isValidHexInput("#AABBCC80"));
  assert.ok(!isValidHexInput("#abcd"));
  assert.ok(!isValidHexInput("red"));
  assert.ok(!isValidHexInput("#GGGGGG"));
});

test("colorName gives plain names from OKLCH (FR-35)", () => {
  const cases = {
    "#FFFFFF": "white",
    "#E3E8EE": "light gray",
    "#595959": "dark gray",
    "#1A1A1A": "near-black",
    "#000000": "black",
    "#E4002B": "red",
    "#FF7A00": "orange",
    "#FFB700": "yellow",
    "#8B4513": "brown",
    "#00A650": "green",
    "#008080": "teal",
    "#00D4FF": "cyan",
    "#006CE4": "blue",
    "#003B95": "dark blue",
    "#635BFF": "violet",
    "#800080": "dark purple",
    "#FF00FF": "magenta",
    "#FF69B4": "pink",
    "#1A1F36": "dark grayish blue",
  };
  for (const [hex, name] of Object.entries(cases)) assert.equal(colorName(hex), name, hex);
});
