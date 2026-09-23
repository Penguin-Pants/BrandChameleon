// Turns collector output into a proposed token model (FR-16 to FR-32).
import { normalizeColor, oklabDistance, oklchChroma } from "./color.js";
import {
  ACCENT_MIN_DISTANCE,
  ACCENT_MIN_WEIGHT_RATIO,
  CLUSTER_DISTANCE,
  INTERACTIVE_USES,
  MAX_CANDIDATES,
  NEUTRAL_CHROMA,
  NEUTRAL_MIN_DISTANCE,
  USE_WEIGHTS,
} from "./constants.js";
import { detectName } from "./naming.js";
import {
  cleanCssValue,
  cleanCustomPropertyName,
  cleanFontFamily,
  cleanSourceUrl,
  cleanText,
  cleanUrl,
} from "./sanitize.js";

export class ScanError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const BODY_TAGS = new Set(["p", "li", "td", "dd", "blockquote"]);
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const pxNumber = (value) => {
  const match = /^(-?[\d.]+)px$/.exec(value ?? "");
  return match ? Number(match[1]) : null;
};

/** Picks the entry with the highest score. Ties keep the earliest entry. */
function maxBy(items, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const value = score(item);
    if (value > bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

/** Groups items by key, sums a score and keeps the first occurrence order. */
function tally(items, keyOf, scoreOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.score += scoreOf(item);
      group.items.push(item);
    } else {
      groups.set(key, { key, score: scoreOf(item), items: [item], first: item.first ?? 0 });
    }
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || a.first - b.first);
}

// Colors -----------------------------------------------------------------

function collectColorUses(records) {
  const exact = new Map();
  const textByHex = new Map();

  const addUse = (raw, use, record) => {
    const hex = normalizeColor(raw);
    if (!hex) return null;
    let entry = exact.get(hex);
    if (!entry) {
      entry = { hex, weight: 0, interactive: 0, uses: {}, first: record.first };
      exact.set(hex, entry);
    }
    const weight = USE_WEIGHTS[use] * record.count;
    entry.weight += weight;
    if (INTERACTIVE_USES.has(use)) entry.interactive += weight;
    entry.uses[use] = (entry.uses[use] ?? 0) + record.count;
    entry.first = Math.min(entry.first, record.first);
    return hex;
  };

  const parsed = records.map((record) => {
    const info = { record, bg: null, text: null, border: null };
    if (record.kind === "svg") {
      addUse(record.fill, "navSvg", record);
      addUse(record.stroke, "navSvg", record);
      return info;
    }
    if (record.bg) {
      const use = record.kind === "button" ? "buttonBg" : record.kind === "nav" ? "navBg" : record.largeBg ? "largeBg" : "other";
      info.bg = addUse(record.bg, use, record);
    }
    if (record.border) {
      info.border = addUse(record.border[2], record.kind === "button" ? "buttonBorder" : "other", record);
    }
    if (record.color) {
      const use = { button: "buttonText", link: "linkText", heading: "headingText" }[record.kind];
      if (use) info.text = addUse(record.color, use, record);
      else if (record.textLen > 0 || record.kind === "input") info.text = addUse(record.color, "other", record);
      else info.text = normalizeColor(record.color);
    }
    if (info.text && record.textLen > 0) {
      textByHex.set(info.text, (textByHex.get(info.text) ?? 0) + record.textLen);
    }
    return info;
  });

  return { exact, textByHex, parsed };
}

function buildClusters(exact) {
  const sorted = [...exact.values()].sort((a, b) => b.weight - a.weight || a.first - b.first);
  const clusters = [];
  const memberOf = new Map();
  for (const entry of sorted) {
    let cluster = clusters.find((c) => oklabDistance(c.hex, entry.hex) < CLUSTER_DISTANCE);
    if (!cluster) {
      cluster = { hex: entry.hex, weight: 0, interactive: 0, uses: {}, first: entry.first, customProps: [], textLen: 0 };
      clusters.push(cluster);
    }
    cluster.weight += entry.weight;
    cluster.interactive += entry.interactive;
    cluster.first = Math.min(cluster.first, entry.first);
    for (const [use, count] of Object.entries(entry.uses)) cluster.uses[use] = (cluster.uses[use] ?? 0) + count;
    memberOf.set(entry.hex, cluster);
  }
  clusters.sort((a, b) => b.weight - a.weight || a.first - b.first);
  clusters.forEach((cluster, index) => {
    cluster.id = `c${index}`;
    cluster.chromatic = oklchChroma(cluster.hex) >= NEUTRAL_CHROMA;
  });
  return { clusters, memberOf };
}

function assignRoles({ clusters, memberOf, textByHex, parsed, backgrounds }) {
  const clusterOf = (hex) =>
    hex ? memberOf.get(hex) ?? clusters.find((c) => oklabDistance(c.hex, hex) < CLUSTER_DISTANCE) ?? null : null;

  // surface (FR-19)
  const surfaceHex = [backgrounds.body, backgrounds.html, backgrounds.wide].map(normalizeColor).find(Boolean);
  const surfaceAssumed = !surfaceHex;
  let surface = clusterOf(surfaceHex ?? "#FFFFFF");
  if (!surface) {
    surface = {
      id: "c-surface",
      hex: surfaceHex ?? "#FFFFFF",
      weight: 0,
      interactive: 0,
      uses: {},
      first: Infinity,
      customProps: [],
      textLen: 0,
      chromatic: oklchChroma(surfaceHex ?? "#FFFFFF") >= NEUTRAL_CHROMA,
      synthetic: true,
    };
    clusters.push(surface);
  }

  // on-surface (FR-20)
  for (const [hex, length] of textByHex) {
    const cluster = clusterOf(hex);
    if (cluster) cluster.textLen += length;
  }
  const onSurface = maxBy(clusters.filter((c) => c.textLen > 0), (c) => c.textLen);

  // primary (FR-21)
  const brandPool = clusters.filter((c) => c !== surface && !c.synthetic);
  const chromatic = brandPool.filter((c) => c.chromatic);
  const byInteractive = (c) => c.interactive * 1e6 + c.weight;
  const hinted = chromatic.filter((c) => c.interactive > 0 && c.customProps.some((n) => /primary|brand/i.test(n)));
  const interactive = chromatic.filter((c) => c.interactive > 0);
  let primary =
    maxBy(hinted, byInteractive) ??
    maxBy(interactive, byInteractive) ??
    maxBy(brandPool.filter((c) => (c.uses.buttonBg ?? 0) > 0), (c) => c.uses.buttonBg) ??
    maxBy(brandPool.filter((c) => (c.uses.linkText ?? 0) > 0), (c) => c.uses.linkText) ??
    maxBy(chromatic, (c) => c.weight);

  // on-primary (FR-22)
  const primaryButtons = parsed.filter((p) => p.record.kind === "button" && primary && clusterOf(p.bg) === primary);
  const onPrimaryGroup = tally(
    primaryButtons.filter((p) => p.text),
    (p) => clusterOf(p.text)?.id,
    (p) => p.record.count,
  )[0];
  const onPrimary = onPrimaryGroup ? clusters.find((c) => c.id === onPrimaryGroup.key) : null;

  // secondary and tertiary (FR-23)
  const accentPool = chromatic.filter((c) => c !== primary && c !== onSurface);
  const pickAccent = (exclude) =>
    primary
      ? maxBy(
          accentPool.filter(
            (c) =>
              !exclude.includes(c) &&
              exclude.every((other) => oklabDistance(c.hex, other.hex) >= ACCENT_MIN_DISTANCE) &&
              c.weight >= primary.weight * ACCENT_MIN_WEIGHT_RATIO,
          ),
          (c) => c.weight,
        )
      : null;
  const secondary = pickAccent([primary]);
  const tertiary = secondary ? pickAccent([primary, secondary]) : null;

  // neutral (FR-24)
  const neutral = maxBy(
    brandPool.filter(
      (c) =>
        !c.chromatic &&
        c !== primary &&
        c !== onSurface &&
        oklabDistance(c.hex, surface.hex) >= NEUTRAL_MIN_DISTANCE &&
        (!onSurface || oklabDistance(c.hex, onSurface.hex) >= NEUTRAL_MIN_DISTANCE),
    ),
    (c) => c.weight,
  );

  primary = primary ?? null;
  return {
    clusterOf,
    surfaceAssumed,
    roles: {
      primary,
      secondary,
      tertiary,
      neutral,
      surface,
      "on-surface": onSurface,
      "on-primary": onPrimary,
    },
  };
}

// Typography -------------------------------------------------------------

/** Splits a CSS font-family list on commas outside quotes. Removes quotes and escapes. */
export function splitFontStack(stack) {
  const families = [];
  let current = "";
  let quote = null;
  const text = stack ?? "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\" && i + 1 < text.length) {
      current += text[i + 1];
      i += 1;
    } else if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ",") {
      families.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  families.push(current.trim());
  return families.filter(Boolean);
}

function typographyLevel(group, countOf = (r) => r.count) {
  const [stack, size, weight, lineHeight, letterSpacing] = JSON.parse(group.key);
  const sizePx = pxNumber(size);
  if (!sizePx) return null;
  const weightNumber = Number(weight) || { normal: 400, bold: 700 }[weight] || 400;
  const lineHeightPx = pxNumber(lineHeight);
  const letterSpacingPx = pxNumber(letterSpacing);
  const tags = tally(group.items, (r) => r.tag, countOf);
  const families = splitFontStack(stack).map(cleanFontFamily).filter(Boolean);
  return {
    styleKey: group.key,
    family: families[0] ?? "",
    stack: families.join(", "),
    fontSize: round(sizePx, 2),
    fontWeight: weightNumber,
    // 0px is a real value; only "normal" (null) is omitted.
    lineHeight: lineHeightPx !== null ? round(lineHeightPx / sizePx, 2) : null,
    letterSpacing: letterSpacingPx ? round(letterSpacingPx / sizePx, 3) || null : null,
    count: group.items.reduce((sum, r) => sum + countOf(r), 0),
    tags: tags.slice(0, 3).map((t) => ({ tag: t.key, count: t.score })),
  };
}

function analyzeTypography(records, isPrimaryButton) {
  const withFont = records.filter((r) => r.font);
  const styleKey = (r) => JSON.stringify(r.font);
  const pick = (items, score) => {
    const group = tally(items, styleKey, score)[0];
    return group ? typographyLevel(group) : null;
  };
  const count = (r) => r.count;
  const levels = {};
  levels["headline-lg"] = pick(withFont.filter((r) => r.tag === "h1"), count);
  levels["headline-md"] = pick(withFont.filter((r) => r.tag === "h2"), count);
  levels["headline-sm"] = pick(withFont.filter((r) => r.tag === "h3"), count);
  levels["body-md"] = pick(
    withFont.filter((r) => BODY_TAGS.has(r.tag) && r.textLen > 0),
    (r) => r.textLen,
  );
  if (levels["body-md"]) {
    const bodySize = levels["body-md"].fontSize;
    // Count only elements that hold text; empty ones can share a record.
    const textCount = (r) => r.textCount ?? r.count;
    const small = tally(
      withFont.filter(
        (r) => r.textLen > 0 && !["button", "heading", "input"].includes(r.kind) && pxNumber(r.font[1]) < bodySize,
      ),
      styleKey,
      textCount,
    )[0];
    levels["body-sm"] = small && small.score >= 3 ? typographyLevel(small, textCount) : null;
  }
  const buttons = withFont.filter((r) => r.kind === "button");
  const primaryButtons = buttons.filter(isPrimaryButton);
  levels["label-md"] = pick(primaryButtons.length ? primaryButtons : buttons, count);
  return Object.fromEntries(Object.entries(levels).filter(([, level]) => level));
}

// Shapes and spacing -----------------------------------------------------

function scaleNames(count, names) {
  return names[count] ?? [];
}

const ROUNDED_NAMES = { 1: ["md"], 2: ["sm", "md"], 3: ["sm", "md", "lg"], 4: ["sm", "md", "lg", "xl"] };
const SPACING_NAMES = {
  1: ["md"],
  2: ["sm", "md"],
  3: ["sm", "md", "lg"],
  4: ["xs", "sm", "md", "lg"],
  5: ["xs", "sm", "md", "lg", "xl"],
  6: ["xs", "sm", "md", "lg", "xl", "2xl"],
};

function analyzeRounded(records) {
  const values = new Map();
  const full = { count: 0, uses: {} };
  const kindOf = (r) => (r.tag === "img" ? "img" : r.kind);
  for (const record of records) {
    if (!record.radius && !record.radiusFull) continue;
    if (!(["button", "input", "card"].includes(record.kind) || record.tag === "img")) continue;
    const kind = kindOf(record);
    if (record.radiusFull) {
      full.count += record.count;
      full.uses[kind] = (full.uses[kind] ?? 0) + record.count;
      continue;
    }
    const value = pxNumber(record.radius);
    if (value === null || value <= 0) continue;
    const px = round(value, 2);
    const entry = values.get(px) ?? { px, count: 0, uses: {} };
    entry.count += record.count;
    entry.uses[kind] = (entry.uses[kind] ?? 0) + record.count;
    values.set(px, entry);
  }
  const top = [...values.values()].sort((a, b) => b.count - a.count || a.px - b.px).slice(0, 4);
  top.sort((a, b) => a.px - b.px);
  const names = scaleNames(top.length, ROUNDED_NAMES);
  return {
    scale: top.map((entry, i) => ({ name: names[i], ...entry })),
    full: full.count ? full : null,
  };
}

function analyzeSpacing(records) {
  const counts = new Map();
  const add = (value, count) => {
    if (value === null || value === undefined) return;
    const px = Math.round(value);
    if (px <= 0 || px > 256) return;
    counts.set(px, (counts.get(px) ?? 0) + count);
  };
  for (const record of records) {
    if (record.padding) for (const side of record.padding) add(side, record.count);
    if (record.gap) for (const gap of record.gap) add(gap, record.count);
  }
  const top = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 6)
    .sort((a, b) => a[0] - b[0]);
  const names = scaleNames(top.length, SPACING_NAMES);
  return top.map(([px, count], i) => ({ name: names[i], px, count }));
}

// Components -------------------------------------------------------------

function analyzeComponents({ parsed, clusterOf, roles }) {
  const components = {};
  const primary = roles.primary;
  // Non-px radii other than "full" (for example "10%") are ignored (FR-28).
  const radiusOf = (r) => {
    if (r.radiusFull) return { full: true };
    const value = pxNumber(r.radius);
    return value ? { px: round(value, 2) } : null;
  };
  const buttonStyle = (p) =>
    JSON.stringify([
      clusterOf(p.bg)?.id ?? null,
      clusterOf(p.text)?.id ?? null,
      radiusOf(p.record),
      p.record.padding,
      p.record.height,
      p.record.font,
    ]);
  const buttonComponent = (items) => {
    const group = tally(items, buttonStyle, (p) => p.record.count)[0];
    if (!group) return null;
    const { record } = group.items[0];
    const sample = group.items[0];
    // Borders are not part of the style key: take the most common variant.
    const borderKey = (p) =>
      JSON.stringify(p.record.border ? [p.record.border[0], p.record.border[1], clusterOf(p.border)?.id ?? null] : null);
    const border = JSON.parse(tally(group.items, borderKey, (p) => p.record.count)[0].key);
    return {
      count: group.score,
      bg: clusterOf(sample.bg)?.id ?? null,
      text: clusterOf(sample.text)?.id ?? null,
      radius: radiusOf(record),
      padding: record.padding,
      height: record.height,
      fontKey: record.font ? JSON.stringify(record.font) : null,
      border: border ? { width: border[0], style: border[1], color: border[2] } : null,
    };
  };

  const buttons = parsed.filter((p) => p.record.kind === "button");
  const isPrimary = (p) => primary && clusterOf(p.bg) === primary;
  const buttonPrimary = buttonComponent(buttons.filter(isPrimary));
  const buttonSecondary = buttonComponent(buttons.filter((p) => !isPrimary(p)));
  if (buttonPrimary) components["button-primary"] = buttonPrimary;
  if (buttonSecondary) components["button-secondary"] = buttonSecondary;

  const mostCommonCluster = (items, hexOf) =>
    tally(items.filter((p) => clusterOf(hexOf(p))), (p) => clusterOf(hexOf(p)).id, (p) => p.record.count)[0]?.key ?? null;

  const links = parsed.filter((p) => p.record.kind === "link");
  const linkText = mostCommonCluster(links, (p) => p.text);
  if (linkText) components.link = { text: linkText, count: links.reduce((s, p) => s + p.record.count, 0) };

  const navs = parsed.filter((p) => p.record.kind === "nav");
  // Transparent navigation areas vote too; when they win, no background is written.
  const navVote = tally(navs, (p) => clusterOf(p.bg)?.id ?? "transparent", (p) => p.record.count)[0]?.key;
  const navBg = navVote && navVote !== "transparent" ? navVote : null;
  const navText = mostCommonCluster(links.filter((p) => p.record.inNav), (p) => p.text);
  if (navBg || navText) components.nav = { bg: navBg, text: navText };

  if (roles.surface || roles["on-surface"]) {
    components.page = { bg: roles.surface?.id ?? null, text: roles["on-surface"]?.id ?? null };
  }
  return components;
}

/** Hex values of component source clusters that are not review candidates. */
function componentColors(components, top, clusters) {
  const ids = new Set();
  for (const component of Object.values(components)) {
    for (const id of [component.bg, component.text, component.border?.color]) if (id) ids.add(id);
  }
  const shown = new Set(top.map((c) => c.id));
  return Object.fromEntries(
    clusters.filter((c) => ids.has(c.id) && !shown.has(c.id)).map((c) => [c.id, c.hex]),
  );
}

// Shadows and logos ------------------------------------------------------

function analyzeShadows(records) {
  return tally(
    records.filter((r) => r.shadow),
    (r) => cleanCssValue(r.shadow),
    (r) => r.count,
  )
    .filter((group) => group.key)
    .slice(0, 3)
    .map((group) => ({
      value: group.key,
      count: group.score,
      kinds: tally(group.items, (r) => r.kind, (r) => r.count).map((k) => ({ kind: k.key, count: k.score })),
    }));
}

/** Largest size in a `sizes` attribute such as "16x16 64x64". "any" ranks highest. */
const sizeOf = (sizes) => {
  const found = [...(sizes ?? "").matchAll(/(\d+)x(\d+)/gi)].map((m) => ({ width: Number(m[1]), height: Number(m[2]) }));
  return found.sort((a, b) => b.width - a.width)[0] ?? null;
};

function analyzeLogos(page, logoImages) {
  const logos = [];
  const add = (url, label, width, height) => {
    const clean = cleanUrl(url, page.url);
    if (!clean || logos.some((l) => l.url === clean)) return;
    logos.push({ url: clean, label, width: width || null, height: height || null });
  };
  const headerImage = logoImages?.byAttr ?? logoImages?.byHomeLink;
  if (headerImage) add(headerImage.src, "Header logo", headerImage.width, headerImage.height);

  const relTokens = (icon) => icon.rel.split(/\s+/);
  const iconRank = (icon) =>
    icon.type === "image/svg+xml" || /\.svg(\?|#|$)/i.test(icon.href) || /\bany\b/i.test(icon.sizes)
      ? Infinity
      : sizeOf(icon.sizes)?.width ?? 0;
  const byRank = (a, b) => iconRank(b) - iconRank(a);
  for (const icon of page.icons.filter((i) => relTokens(i).includes("apple-touch-icon")).sort(byRank)) {
    const size = sizeOf(icon.sizes);
    add(icon.href, "Apple touch icon", size?.width, size?.height);
  }
  for (const icon of page.icons.filter((i) => relTokens(i).includes("icon")).sort(byRank)) {
    const size = sizeOf(icon.sizes);
    add(icon.href, "Site icon", size?.width, size?.height);
  }
  if (/^https?:$/.test(new URL(page.url).protocol)) {
    add(`${page.origin}/favicon.ico`, "Default favicon path (not verified)");
  }
  if (page.ogImage) add(page.ogImage, "Social preview image (og:image)");
  return logos;
}

// Entry point ------------------------------------------------------------

/**
 * @param {object} scan Collector output.
 * @param {{ scannedAt: string, extVersion: string }} context
 */
export function analyze(scan, { scannedAt, extVersion }) {
  const records = scan.records ?? [];
  if (!records.some((r) => r.tag !== "html" && r.tag !== "body")) throw new ScanError("no-content");

  const { exact, textByHex, parsed } = collectColorUses(records);
  const { clusters, memberOf } = buildClusters(exact);

  for (const prop of scan.customProps ?? []) {
    const hex = normalizeColor(prop.value);
    const name = cleanCustomPropertyName(prop.name);
    if (!hex || !name) continue;
    const cluster = memberOf.get(hex) ?? clusters.find((c) => oklabDistance(c.hex, hex) < CLUSTER_DISTANCE);
    if (cluster && !cluster.customProps.includes(name)) cluster.customProps.push(name);
  }

  const { clusterOf, roles, surfaceAssumed } = assignRoles({
    clusters,
    memberOf,
    textByHex,
    parsed,
    backgrounds: scan.backgrounds ?? {},
  });

  const infoByRecord = new Map(parsed.map((p) => [p.record, p]));
  const isPrimaryButton = (record) => {
    const info = infoByRecord.get(record);
    return Boolean(roles.primary && info && clusterOf(info.bg) === roles.primary);
  };

  const top = clusters.filter((c) => c.weight > 0).slice(0, MAX_CANDIDATES);
  const components = analyzeComponents({ parsed, clusterOf, roles });
  const extraRoles = Object.values(roles).filter((c) => c && !top.includes(c));
  const candidates = [...new Set([...top, ...extraRoles])]
    .map((c) => ({
      id: c.id,
      hex: c.hex,
      weight: c.weight,
      chromatic: c.chromatic,
      uses: c.uses,
      customProps: c.customProps.slice(0, 3),
      synthetic: Boolean(c.synthetic),
    }));

  return {
    schema: 1,
    source: {
      url: cleanSourceUrl(scan.page.url),
      // Full URL for the sidebar Source block only (FR-42); never written to the file.
      displayUrl: cleanUrl(scan.page.url) ?? "",
      hostname: cleanText(scan.page.hostname, 253),
      scannedAt,
      extVersion,
    },
    name: detectName(scan.page),
    candidates,
    roles: Object.fromEntries(Object.entries(roles).map(([role, c]) => [role, c ? c.id : null])),
    typography: analyzeTypography(records, isPrimaryButton),
    rounded: analyzeRounded(records),
    spacing: analyzeSpacing(records),
    components,
    componentColors: componentColors(components, top, clusters),
    shadows: analyzeShadows(records),
    logos: analyzeLogos(scan.page, scan.logoImages),
    notes: {
      capped: Boolean(scan.limits?.capped),
      unreadableStylesheets: scan.stylesheets?.unreadable ?? 0,
      surfaceAssumed,
    },
  };
}
