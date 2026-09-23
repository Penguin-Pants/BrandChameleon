// Builds the DESIGN.md text from a model and review edits (FR-33 to FR-41).
// Pure and deterministic: the same inputs give byte-identical output.
import { contrastRatio, isOpaque, oklchChroma, relativeLuminance } from "./color.js";
import { DARK_SURFACE_LUMINANCE, NEUTRAL_CHROMA, ROLE_ORDER, TYPE_LEVELS, WCAG_AA } from "./constants.js";
import { roleHex } from "./review.js";
import { cleanFontFamily, cleanName } from "./sanitize.js";

const q = (value) => JSON.stringify(String(value));
const fmt = (value) => String(Math.round(value * 1000) / 1000);
const px = (value) => `${fmt(value)}px`;
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const ratio = (value) => `${value.toFixed(2)}:1`;

function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const ROLE_LABELS = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
  neutral: "Neutral",
  surface: "Surface",
  "on-surface": "On-surface",
  "on-primary": "On-primary",
};

const USE_PHRASES = [
  ["buttonBg", (n) => `background of ${plural(n, "button")}`],
  ["buttonBorder", (n) => `border of ${plural(n, "button")}`],
  ["linkText", (n) => `text of ${plural(n, "link")}`],
  ["largeBg", (n) => `background of ${plural(n, "large area")}`],
  ["navBg", (n) => `background of ${plural(n, "navigation area")}`],
  ["navSvg", (n) => `fill or stroke of ${plural(n, "navigation icon shape")}`],
  ["headingText", (n) => `text of ${plural(n, "heading")}`],
  ["buttonText", (n) => `text of ${plural(n, "button")}`],
  ["other", (n) => plural(n, "other use")],
];

const KIND_WORDS = { button: "button", input: "input", card: "card", img: "image", nav: "navigation area" };

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function useSummary(candidate) {
  if (!candidate) return "Set during review.";
  const parts = USE_PHRASES.filter(([key]) => candidate.uses[key]).map(([key, phrase]) => phrase(candidate.uses[key]));
  let text = parts.length ? `${capitalize(joinList(parts))}.` : "Not used on visible elements.";
  if (candidate.synthetic) text = "Browser default.";
  if (candidate.customProps.length) {
    text += ` Declared as ${joinList(candidate.customProps.map((name) => `\`${name}\``))}.`;
  }
  return text;
}

// Token resolution --------------------------------------------------------

function buildContext(model, edits) {
  const candidate = (id) => model.candidates.find((c) => c.id === id) ?? null;
  // Component colors can come from clusters outside the review palette.
  const hexOf = (id) => candidate(id)?.hex ?? model.componentColors?.[id] ?? null;
  const colors = {};
  for (const role of ROLE_ORDER) {
    const hex = roleHex(model, edits, role);
    if (hex) colors[role] = hex;
  }

  const levels = {};
  if (edits.groups.typography) {
    for (const level of TYPE_LEVELS) {
      const value = model.typography[level];
      const edit = edits.typography[level];
      if (value && edit?.include) levels[level] = { ...value, family: cleanFontFamily(edit.family) };
    }
  }

  const rounded = [];
  if (edits.groups.rounded) {
    rounded.push(...model.rounded.scale.map((entry) => ({ name: entry.name, px: entry.px, count: entry.count, uses: entry.uses })));
    if (model.rounded.full) rounded.push({ name: "full", px: 9999, count: model.rounded.full.count, uses: model.rounded.full.uses, full: true });
  }

  const spacing = edits.groups.spacing ? model.spacing : [];

  const roleMatches = (role, id) =>
    Boolean(colors[role]) && (model.roles[role] === id || edits.roles[role]?.candidate === id);

  const colorValue = (id, preferred) => {
    if (!id) return null;
    for (const role of [...preferred, ...ROLE_ORDER]) {
      if (roleMatches(role, id)) return { ref: `{colors.${role}}`, label: `${role} (${colors[role]})`, hex: colors[role] };
    }
    const hex = hexOf(id);
    return hex ? { literal: hex, label: hex, hex } : null;
  };

  const radiusValue = (radius) => {
    if (!radius) return null;
    const token = radius.full ? rounded.find((r) => r.full) : rounded.find((r) => !r.full && r.px === radius.px);
    const value = radius.full ? 9999 : radius.px;
    return token
      ? { ref: `{rounded.${token.name}}`, label: `rounded.${token.name} (${px(value)})`, token: `rounded.${token.name}`, value }
      : { literal: px(value), label: px(value), value };
  };

  const typographyRef = (level, fontKey) => {
    const value = levels[level];
    if (!value) return null;
    if (fontKey !== undefined && value.styleKey !== fontKey) return null;
    return { ref: `{typography.${level}}`, label: level };
  };

  return { candidate, hexOf, colors, levels, rounded, spacing, colorValue, radiusValue, typographyRef };
}

function paddingProse(padding) {
  const [top, right, bottom, left] = padding;
  if (top === bottom && right === left) return `${px(top)} vertical and ${px(right)} horizontal padding`;
  return `padding ${padding.map(px).join(" ")} (top, right, bottom and left)`;
}

function buildComponents(model, edits, ctx) {
  if (!edits.groups.components) return [];
  const out = [];
  const add = (name, props, prose) => {
    const entries = props.filter(([, value]) => value);
    if (entries.length) out.push({ name, entries, prose });
  };

  const page = model.components.page;
  if (page) {
    const bg = ctx.colorValue(page.bg, ["surface"]);
    const text = ctx.colorValue(page.text, ["on-surface"]);
    const type = ctx.typographyRef("body-md");
    add(
      "page",
      [["backgroundColor", bg], ["textColor", text], ["typography", type]],
      [bg && `background ${bg.label}`, text && `text ${text.label}`, type && `typography ${type.label}`],
    );
  }

  for (const [name, preferred] of [
    ["button-primary", { bg: ["primary"], text: ["on-primary"] }],
    ["button-secondary", { bg: ["secondary", "tertiary", "surface"], text: ["primary", "on-surface"] }],
  ]) {
    const button = model.components[name];
    if (!button) continue;
    const bg = ctx.colorValue(button.bg, preferred.bg);
    const text = ctx.colorValue(button.text, preferred.text);
    const radius = ctx.radiusValue(button.radius);
    const padding = button.padding;
    const uniform = padding && padding.every((side) => side === padding[0]);
    const type = ctx.typographyRef("label-md", button.fontKey);
    const border = button.border
      ? `${px(button.border.width)} ${button.border.style} ${ctx.hexOf(button.border.color) ?? ""} border`.replace("  ", " ")
      : null;
    add(
      name,
      [
        ["backgroundColor", bg],
        ["textColor", text],
        ["typography", type],
        ["rounded", radius],
        ["padding", uniform && padding[0] > 0 ? { literal: px(padding[0]) } : null],
        ["height", button.height ? { literal: px(button.height) } : null],
      ],
      [
        bg ? `background ${bg.label}` : "transparent background",
        text && `text ${text.label}`,
        radius && `corners ${radius.label}`,
        padding && (uniform ? `${px(padding[0])} padding` : paddingProse(padding)),
        border,
        button.height && `height ${px(button.height)}`,
        type && `typography ${type.label}`,
      ],
    );
  }

  const link = model.components.link;
  if (link) {
    const text = ctx.colorValue(link.text, ["primary", "secondary"]);
    add("link", [["textColor", text]], [text && `text ${text.label}`]);
  }

  const nav = model.components.nav;
  if (nav) {
    const bg = ctx.colorValue(nav.bg, ["surface"]);
    const text = ctx.colorValue(nav.text, ["on-surface"]);
    add("nav", [["backgroundColor", bg], ["textColor", text]], [bg && `background ${bg.label}`, text && `text ${text.label}`]);
  }
  return out;
}

// Output -----------------------------------------------------------------

function frontMatter(model, edits, ctx, components) {
  const name = cleanName(edits.name) || "Untitled";
  const date = model.source.scannedAt.slice(0, 10);
  const url = model.source.url || "the scanned page";
  const lines = [
    "---",
    "version: alpha",
    `name: ${q(name)}`,
    `description: ${q(`Design tokens extracted from ${url} on ${date} by BrandChameleon ${model.source.extVersion}.`)}`,
  ];

  const present = {
    typography: Object.keys(ctx.levels).length > 0,
    rounded: ctx.rounded.length > 0,
    spacing: ctx.spacing.length > 0,
    components: components.length > 0,
  };
  const omitted = Object.entries(present).filter(([, isPresent]) => !isPresent);
  if (omitted.length) {
    lines.push("omitted:");
    for (const [group] of omitted) {
      const detected = group === "components" ? Object.keys(model.components).length > 0 : group === "typography"
        ? Object.keys(model.typography).length > 0
        : group === "rounded"
          ? model.rounded.scale.length > 0 || Boolean(model.rounded.full)
          : model.spacing.length > 0;
      lines.push(`  - section: ${group}`);
      lines.push(`    reason: ${q(detected ? "Excluded during review" : "Not detected on the scanned page")}`);
    }
  }

  const roles = Object.keys(ctx.colors);
  if (roles.length) {
    lines.push("colors:");
    for (const role of roles) lines.push(`  ${role}: ${q(ctx.colors[role])}`);
  }

  if (present.typography) {
    lines.push("typography:");
    for (const [level, value] of Object.entries(ctx.levels)) {
      lines.push(`  ${level}:`);
      if (value.family) lines.push(`    fontFamily: ${q(value.family)}`);
      lines.push(`    fontSize: ${q(px(value.fontSize))}`);
      lines.push(`    fontWeight: ${value.fontWeight}`);
      if (value.lineHeight !== null) lines.push(`    lineHeight: ${fmt(value.lineHeight)}`);
      if (value.letterSpacing !== null) lines.push(`    letterSpacing: ${q(`${fmt(value.letterSpacing)}em`)}`);
    }
  }

  if (present.rounded) {
    lines.push("rounded:");
    for (const token of ctx.rounded) lines.push(`  ${token.name}: ${q(px(token.px))}`);
  }

  if (present.spacing) {
    lines.push("spacing:");
    for (const token of ctx.spacing) lines.push(`  ${token.name}: ${q(px(token.px))}`);
  }

  if (present.components) {
    lines.push("components:");
    for (const component of components) {
      lines.push(`  ${component.name}:`);
      for (const [prop, value] of component.entries) lines.push(`    ${prop}: ${q(value.ref ?? value.literal)}`);
    }
  }

  lines.push("---");
  return lines;
}

function usesProse(uses) {
  return joinList(
    Object.entries(uses)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([kind, count]) => plural(count, KIND_WORDS[kind] ?? kind)),
  );
}

function body(model, edits, ctx, components) {
  const name = cleanName(edits.name) || "Untitled";
  const out = [`# ${name}`, ""];
  const section = (title, lines) => {
    if (!lines.length) return;
    out.push(`## ${title}`, "", ...lines, "");
  };

  // Overview
  const surfaceHex = ctx.colors.surface ?? model.candidates.find((c) => c.id === model.roles.surface)?.hex ?? "#FFFFFF";
  const mode = relativeLuminance(surfaceHex) < DARK_SURFACE_LUMINANCE ? "dark" : "light";
  const source = model.source.url || "the scanned page";
  const date = model.source.scannedAt.slice(0, 10);
  const overview = [
    `Design tokens for ${name}, measured from the computed styles of ${source} on ${date} by BrandChameleon ${model.source.extVersion}.`,
    `The page rendered in ${mode} mode.`,
  ];
  if (model.notes.capped) overview.push("The scan reached its element limit. Some elements were not read.");
  if (model.notes.unreadableStylesheets > 0) {
    const n = model.notes.unreadableStylesheets;
    overview.push(`${plural(n, "stylesheet")} could not be read, so ${n === 1 ? "its" : "their"} custom properties are not included.`);
  }
  if (model.notes.surfaceAssumed) overview.push("The page sets no background color. Browser default white is assumed.");
  if (ctx.colors.primary && oklchChroma(ctx.colors.primary) < NEUTRAL_CHROMA) {
    overview.push("The brand palette is monochrome. No saturated color is used on buttons or links.");
  }
  overview.push("Brand personality is not inferred from CSS.");
  section("Overview", [overview.join(" ")]);

  // Colors
  section(
    "Colors",
    Object.keys(ctx.colors).map((role) => {
      const edit = edits.roles[role];
      const source = edit?.hex ? null : ctx.candidate(edit?.candidate);
      return `- **${ROLE_LABELS[role]} (${ctx.colors[role]}):** ${useSummary(source)}`;
    }),
  );

  // Typography
  section(
    "Typography",
    Object.entries(ctx.levels).map(([level, value]) => {
      const family = value.family || "Unnamed font";
      const sources = joinList(value.tags.map((t) => `${t.count} \`${t.tag}\``));
      return `- **${level}:** ${family}, ${px(value.fontSize)}, weight ${value.fontWeight}, from ${sources} ${value.count === 1 ? "element" : "elements"}. Full stack: ${value.stack || family}.`;
    }),
  );

  // Layout
  if (ctx.spacing.length) {
    section("Layout", [
      "Spacing values are the most common paddings and gaps on buttons, inputs, navigation links, cards and flex or grid containers:",
      "",
      ...ctx.spacing.map((token) => `- **${token.name}:** ${px(token.px)}, used ${plural(token.count, "time")}.`),
    ]);
  }

  // Elevation & Depth
  section(
    "Elevation & Depth",
    model.shadows.map(
      (shadow) => `- \`${shadow.value}\` on ${joinList(shadow.kinds.map((k) => plural(k.count, KIND_WORDS[k.kind] ?? k.kind)))}.`,
    ),
  );

  // Shapes
  section(
    "Shapes",
    ctx.rounded.map((token) => `- **${token.name} (${px(token.px)}):** ${usesProse(token.uses)}.`),
  );

  // Components
  section(
    "Components",
    components.map((component) => `- **${component.name}:** ${component.prose.filter(Boolean).join(", ")}.`),
  );

  // Do's and Don'ts
  const rules = [];
  const { primary, surface } = ctx.colors;
  const onPrimary = ctx.colors["on-primary"];
  const onSurface = ctx.colors["on-surface"];
  const buttonPrimary = components.find((c) => c.name === "button-primary");
  if (buttonPrimary && primary) rules.push(`- Do use primary (${primary}) for primary button backgrounds.`);
  // WCAG claims need an opaque background; a translucent one has an unknown backdrop.
  if (primary && onPrimary && isOpaque(primary)) {
    const r = contrastRatio(onPrimary, primary);
    rules.push(
      r >= WCAG_AA
        ? `- Do pair on-primary text with primary backgrounds (${ratio(r)}, passes WCAG AA).`
        : `- Don't use on-primary text on primary backgrounds for normal-size text (${ratio(r)}, below the WCAG AA minimum of 4.5:1).`,
    );
  }
  if (surface && onSurface && isOpaque(surface)) {
    const r = contrastRatio(onSurface, surface);
    rules.push(
      r >= WCAG_AA
        ? `- Do pair on-surface text with surface backgrounds (${ratio(r)}, passes WCAG AA).`
        : `- Don't use on-surface text on surface backgrounds for normal-size text (${ratio(r)}, below the WCAG AA minimum of 4.5:1).`,
    );
  }
  if (primary && surface && isOpaque(surface)) {
    const r = contrastRatio(primary, surface);
    if (r < WCAG_AA) rules.push(`- Don't use primary for body text on surface (${ratio(r)}, below 4.5:1).`);
  }
  const headline = ["headline-lg", "headline-md", "headline-sm"].map((l) => ctx.levels[l]).find(Boolean);
  const bodyLevel = ctx.levels["body-md"];
  if (headline?.family && bodyLevel?.family) {
    rules.push(`- Do set headlines in ${headline.family} and body text in ${bodyLevel.family}.`);
  }
  const radius = buttonPrimary?.entries.find(([prop]) => prop === "rounded")?.[1];
  if (radius?.ref) rules.push(`- Do use ${radius.token} (${px(radius.value)}) corners on buttons.`);
  section("Do's and Don'ts", rules);

  // Brand Assets
  const logo = edits.logo === null || edits.logo === undefined ? null : model.logos[edits.logo];
  if (logo) {
    const size = logo.width && logo.height ? `, ${logo.width} x ${logo.height} px` : "";
    section("Brand Assets", [`- **Logo:** ${logo.url} (${logo.label}${size})`]);
  }

  return out;
}

export function generate(model, edits) {
  const ctx = buildContext(model, edits);
  const components = buildComponents(model, edits, ctx);
  const lines = [...frontMatter(model, edits, ctx, components), "", ...body(model, edits, ctx, components)];
  while (lines[lines.length - 1] === "") lines.pop();
  return `${lines.join("\n")}\n`;
}
