// Pure color parsing and math (FR-14, FR-15).
// Parses CSS color strings into sRGB { r, g, b, a } with channels 0..1.
// Matrices and transfer functions follow the CSS Color 4 sample code.
import { NAMED_COLORS } from "./named-colors.js";

const multiply = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

const XYZ_TO_LIN_SRGB = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
const LIN_P3_TO_XYZ = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0, 32229 / 714400, 5220557 / 5000800],
];
const LIN_A98_TO_XYZ = [
  [573536 / 994567, 263643 / 1420810, 187206 / 994567],
  [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
  [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
];
const LIN_PROPHOTO_TO_XYZ_D50 = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
];
const LIN_2020_TO_XYZ = [
  [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
  [0, 0.028072693049087428, 1.060985057710791],
];
const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const D50_WHITE = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const signed = (fn) => (v) => Math.sign(v) * fn(Math.abs(v));
const srgbToLinear = signed((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const linearToSrgb = signed((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
const a98ToLinear = signed((v) => v ** (563 / 256));
const prophotoToLinear = signed((v) => (v <= 16 / 512 ? v / 16 : v ** 1.8));
const rec2020ToLinear = signed((v) => {
  const alpha = 1.09929682680944;
  const beta = 0.018053968510807;
  return v < beta * 4.5 ? v / 4.5 : ((v + alpha - 1) / alpha) ** (1 / 0.45);
});

function xyzD65ToSrgb(xyz) {
  return multiply(XYZ_TO_LIN_SRGB, xyz).map(linearToSrgb);
}

function labToXyzD50([L, a, b]) {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const f1 = (L + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const xyz = [
    f0 ** 3 > epsilon ? f0 ** 3 : (116 * f0 - 16) / kappa,
    L > kappa * epsilon ? ((L + 16) / 116) ** 3 : L / kappa,
    f2 ** 3 > epsilon ? f2 ** 3 : (116 * f2 - 16) / kappa,
  ];
  return xyz.map((v, i) => v * D50_WHITE[i]);
}

function oklabToLinearSrgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearSrgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function hslToSrgb(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hwbToSrgb(h, w, bl) {
  if (w + bl >= 1) {
    const gray = w / (w + bl);
    return [gray, gray, gray];
  }
  return hslToSrgb(h, 1, 0.5).map((v) => v * (1 - w - bl) + w);
}

// Token parsing ---------------------------------------------------------

const NUMBER_RE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/i;

function parseToken(token) {
  if (/^none$/i.test(token)) return { value: 0, unit: "none" };
  const match = NUMBER_RE.exec(token);
  if (!match) return null;
  return { value: Number(match[1]), unit: (match[2] ?? "").toLowerCase() };
}

function hueDegrees(token) {
  if (!token) return null;
  const factor = { "": 1, deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360, none: 1 }[token.unit];
  if (factor === undefined) return null;
  return (((token.value * factor) % 360) + 360) % 360;
}

// Number, or percentage scaled so that 100% equals `percentScale`.
function scaled(token, percentScale) {
  if (!token || ["deg", "rad", "grad", "turn"].includes(token.unit)) return null;
  return token.unit === "%" ? (token.value / 100) * percentScale : token.value;
}

function parseAlpha(token) {
  if (token === undefined) return 1;
  const value = scaled(token, 1);
  return value === null ? null : Math.min(1, Math.max(0, value));
}

// Splits "fn(a b c / d)" or "fn(a, b, c, d)" into tokens and an alpha token.
function splitArgs(body) {
  const trimmed = body.trim();
  let parts;
  let alpha;
  if (trimmed.includes(",")) {
    parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length === 4) alpha = parts.pop();
  } else {
    const [main, alphaPart] = trimmed.split("/");
    parts = main.trim().split(/\s+/);
    if (alphaPart !== undefined) alpha = alphaPart.trim();
  }
  const tokens = parts.map(parseToken);
  const alphaToken = alpha === undefined ? undefined : parseToken(alpha);
  if (tokens.some((t) => t === null) || alphaToken === null) return null;
  return { tokens, alphaToken };
}

function parseHex(hex) {
  const digits = hex.slice(1);
  if (!/^[0-9a-f]+$/i.test(digits) || ![3, 4, 6, 8].includes(digits.length)) return null;
  const full = digits.length <= 4 ? [...digits].map((d) => d + d).join("") : digits;
  const values = full.match(/../g).map((pair) => parseInt(pair, 16) / 255);
  return { r: values[0], g: values[1], b: values[2], a: values.length === 4 ? values[3] : 1 };
}

const COLOR_SPACES = {
  srgb: (c) => c,
  "srgb-linear": (c) => c.map(linearToSrgb),
  "display-p3": (c) => xyzD65ToSrgb(multiply(LIN_P3_TO_XYZ, c.map(srgbToLinear))),
  "a98-rgb": (c) => xyzD65ToSrgb(multiply(LIN_A98_TO_XYZ, c.map(a98ToLinear))),
  "prophoto-rgb": (c) => xyzD65ToSrgb(multiply(D50_TO_D65, multiply(LIN_PROPHOTO_TO_XYZ_D50, c.map(prophotoToLinear)))),
  rec2020: (c) => xyzD65ToSrgb(multiply(LIN_2020_TO_XYZ, c.map(rec2020ToLinear))),
  xyz: (c) => xyzD65ToSrgb(c),
  "xyz-d65": (c) => xyzD65ToSrgb(c),
  "xyz-d50": (c) => xyzD65ToSrgb(multiply(D50_TO_D65, c)),
};

function parseFunction(name, body) {
  if (name === "color") {
    const match = /^\s*([a-z0-9-]+)\s+(.*)$/i.exec(body);
    if (!match) return null;
    const convert = COLOR_SPACES[match[1].toLowerCase()];
    const args = convert && splitArgs(match[2]);
    if (!args || args.tokens.length !== 3) return null;
    const channels = args.tokens.map((t) => scaled(t, 1));
    if (channels.some((v) => v === null)) return null;
    return { rgb: convert(channels), alpha: parseAlpha(args.alphaToken) };
  }

  const args = splitArgs(body);
  if (!args || args.tokens.length !== 3) return null;
  const [t1, t2, t3] = args.tokens;
  const alpha = parseAlpha(args.alphaToken);
  let rgb;

  switch (name) {
    case "rgb":
    case "rgba": {
      const channels = [t1, t2, t3].map((t) => scaled(t, 255));
      if (channels.some((v) => v === null)) return null;
      rgb = channels.map((v) => v / 255);
      break;
    }
    case "hsl":
    case "hsla": {
      const h = hueDegrees(t1);
      const s = scaled(t2, 100);
      const l = scaled(t3, 100);
      if (h === null || s === null || l === null) return null;
      rgb = hslToSrgb(h, s / 100, l / 100);
      break;
    }
    case "hwb": {
      const h = hueDegrees(t1);
      const w = scaled(t2, 100);
      const bl = scaled(t3, 100);
      if (h === null || w === null || bl === null) return null;
      rgb = hwbToSrgb(h, w / 100, bl / 100);
      break;
    }
    case "lab": {
      const lab = [scaled(t1, 100), scaled(t2, 125), scaled(t3, 125)];
      if (lab.some((v) => v === null)) return null;
      rgb = xyzD65ToSrgb(multiply(D50_TO_D65, labToXyzD50(lab)));
      break;
    }
    case "lch": {
      const L = scaled(t1, 100);
      const C = scaled(t2, 150);
      const H = hueDegrees(t3);
      if (L === null || C === null || H === null) return null;
      const rad = (H * Math.PI) / 180;
      rgb = xyzD65ToSrgb(multiply(D50_TO_D65, labToXyzD50([L, C * Math.cos(rad), C * Math.sin(rad)])));
      break;
    }
    case "oklab": {
      const lab = [scaled(t1, 1), scaled(t2, 0.4), scaled(t3, 0.4)];
      if (lab.some((v) => v === null)) return null;
      rgb = oklabToLinearSrgb(lab).map(linearToSrgb);
      break;
    }
    case "oklch": {
      const L = scaled(t1, 1);
      const C = scaled(t2, 0.4);
      const H = hueDegrees(t3);
      if (L === null || C === null || H === null) return null;
      const rad = (H * Math.PI) / 180;
      rgb = oklabToLinearSrgb([L, C * Math.cos(rad), C * Math.sin(rad)]).map(linearToSrgb);
      break;
    }
    default:
      return null;
  }
  return { rgb, alpha };
}

const clip = (v) => Math.min(1, Math.max(0, v));

/**
 * Parses a CSS color string. Returns { r, g, b, a } (0..1, sRGB, clipped)
 * or null when the value is not a supported color.
 */
export function parseColor(input) {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (!value) return null;
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (value.startsWith("#")) return parseHex(value);
  if (NAMED_COLORS[value]) return parseHex(NAMED_COLORS[value]);

  const match = /^([a-z-]+)\((.*)\)$/s.exec(value);
  if (!match || /\bfrom\b|var\(|calc\(/.test(match[2])) return null;
  const parsed = parseFunction(match[1], match[2]);
  if (!parsed || parsed.alpha === null || parsed.rgb.some((v) => !Number.isFinite(v))) return null;
  const [r, g, b] = parsed.rgb.map(clip);
  return { r, g, b, a: parsed.alpha };
}

const toByte = (v) => Math.round(clip(v) * 255);
const hexByte = (v) => toByte(v).toString(16).padStart(2, "0").toUpperCase();

/** #RRGGBB, or #RRGGBBAA when alpha is below 1 (FR-15). */
export function toHex({ r, g, b, a = 1 }) {
  const base = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
  return toByte(a) < 255 ? base + hexByte(a) : base;
}

/** Parses a color and returns its FR-15 hex, or null. Alpha 0 returns null. */
export function normalizeColor(input) {
  const color = parseColor(input);
  if (!color || toByte(color.a) === 0) return null;
  return toHex(color);
}

export function hexToRgba(hex) {
  return parseHex(hex);
}

export function toOklab({ r, g, b }) {
  return linearSrgbToOklab([r, g, b].map(srgbToLinear));
}

/** OKLab distance. Alpha difference adds to the distance. */
export function oklabDistance(hexA, hexB) {
  const a = hexToRgba(hexA);
  const b = hexToRgba(hexB);
  const [l1, a1, b1] = toOklab(a);
  const [l2, a2, b2] = toOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) + Math.abs(a.a - b.a);
}

export function oklchChroma(hex) {
  const [, a, b] = toOklab(hexToRgba(hex));
  return Math.hypot(a, b);
}

function luminance({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map(srgbToLinear);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** Paints `top` over an opaque `bottom` color. */
function composite(top, bottom) {
  const mix = (t, b) => t * top.a + b * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/** WCAG 2 relative luminance. A translucent color is painted over white. */
export function relativeLuminance(hex) {
  return luminance(composite(hexToRgba(hex), WHITE));
}

export function isOpaque(hex) {
  return hexToRgba(hex).a === 1;
}

/**
 * WCAG 2 contrast of a foreground painted over a background. A translucent
 * background is painted over white first.
 */
export function contrastRatio(foregroundHex, backgroundHex) {
  const background = composite(hexToRgba(backgroundHex), WHITE);
  const foreground = composite(hexToRgba(foregroundHex), background);
  const lf = luminance(foreground);
  const lb = luminance(background);
  return (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
}

export function isValidHexInput(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}
