// Builds the DESIGN.md text from a model and review edits (FR-33 to FR-41).
// Pure and deterministic: the same inputs give byte-identical output.
import { colorName, contrastRatio, isOpaque, oklchChroma, relativeLuminance } from "./color.js";
import { DARK_SURFACE_LUMINANCE, NEUTRAL_CHROMA, ROLE_ORDER, TYPE_LEVELS, USE_WEIGHTS, WCAG_AA } from "./constants.js";
import { roleHex } from "./review.js";
import { cleanFontFamily, cleanName } from "./sanitize.js";

const q = (value) => JSON.stringify(String(value));
const fmt = (value) => String(Math.round(value * 1000) / 1000);
const px = (value) => `${fmt(value)}px`;
const ratio = (value) => `${value.toFixed(2)}:1`;

function joinList(items, conjunction = "and") {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
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

// The file describes the design, not the scan: no counts, sources or tool
// notes (change request CR-2). Scan notes show in the sidebar instead.
const ROLE_DESCRIPTIONS = {
  primary: "Main brand color",
  secondary: "Secondary brand color",
  tertiary: "Tertiary brand color",
  neutral: "Neutral color",
  surface: "Page background",
  "on-surface": "Main text color",
  "on-primary": "Text color on primary backgrounds",
};

const USE_PHRASES = [
  ["buttonBg", "button backgrounds"],
  ["buttonBorder", "button borders"],
  ["linkText", "link text"],
  ["largeBg", "large background areas"],
  ["navBg", "navigation backgrounds"],
  ["navSvg", "navigation icons"],
  ["headingText", "heading text"],
  ["buttonText", "button text"],
];

const KIND_PLURALS = {
  button: "buttons",
  input: "inputs",
  card: "cards",
  img: "images",
  nav: "navigation areas",
  link: "links",
  heading: "headings",
  other: "page elements",
};

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Kinds from most to least used, as plural words. */
function kindList(counts) {
  return joinList(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([kind]) => KIND_PLURALS[kind] ?? kind),
  );
}

function colorProse(role, candidate) {
  const text = `${ROLE_DESCRIPTIONS[role]}.`;
  // on-primary often shares the white or black cluster of other roles, so the
  // cluster's other uses would describe a different role.
  if (!candidate || candidate.synthetic || role === "on-primary") return text;
  const uses = USE_PHRASES.filter(([key]) => candidate.uses[key])
    .sort((a, b) => candidate.uses[b[0]] * USE_WEIGHTS[b[0]] - candidate.uses[a[0]] * USE_WEIGHTS[a[0]])
    .map(([, phrase]) => phrase);
  return uses.length ? `${text} Used for ${joinList(uses)}.` : text;
}

const named = (hex) => `${colorName(hex)} (${hex})`;

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

  // A background that resolves to alpha 0 is not written (FR-38).
  const backgroundValue = (id, preferred) => {
    const value = colorValue(id, preferred);
    return value && /^#[0-9A-F]{6}00$/i.test(value.hex) ? null : value;
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

  return { candidate, hexOf, colors, levels, rounded, spacing, colorValue, backgroundValue, radiusValue, typographyRef };
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
    const bg = ctx.backgroundValue(page.bg, ["surface"]);
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
    const bg = ctx.backgroundValue(button.bg, preferred.bg);
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
        ["padding", uniform ? { literal: px(padding[0]) } : null],
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
    const bg = ctx.backgroundValue(nav.bg, ["surface"]);
    const text = ctx.colorValue(nav.text, ["on-surface"]);
    add("nav", [["backgroundColor", bg], ["textColor", text]], [bg && `background ${bg.label}`, text && `text ${text.label}`]);
  }
  return out;
}

// Output -----------------------------------------------------------------

const OMITTED_REASONS = {
  typography: "No typography levels defined",
  rounded: "No rounded corners defined",
  spacing: "No spacing scale defined",
  components: "No components defined",
};

function themeOf(model, ctx) {
  const surfaceHex = ctx.colors.surface ?? model.candidates.find((c) => c.id === model.roles.surface)?.hex ?? "#FFFFFF";
  return relativeLuminance(surfaceHex) < DARK_SURFACE_LUMINANCE ? "dark" : "light";
}

function frontMatter(model, edits, ctx, components) {
  const name = cleanName(edits.name) || "Untitled";
  const theme = capitalize(themeOf(model, ctx));
  const { primary } = ctx.colors;
  const lines = [
    "---",
    "version: alpha",
    `name: ${q(name)}`,
    `description: ${q(primary ? `${theme} theme with ${named(primary)} as the primary color.` : `${theme} theme.`)}`,
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
      lines.push(`    reason: ${q(detected ? "Not part of this design system" : OMITTED_REASONS[group])}`);
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

function body(model, edits, ctx, components) {
  const name = cleanName(edits.name) || "Untitled";
  const out = [`# ${name}`, ""];
  const section = (title, lines) => {
    if (!lines.length) return;
    out.push(`## ${title}`, "", ...lines, "");
  };

  // Overview: a factual look and feel, from the tokens only.
  const { primary: primaryHex, secondary, tertiary, surface: surfaceHex } = ctx.colors;
  const textHex = ctx.colors["on-surface"];
  const overview = [
    `${capitalize(themeOf(model, ctx))} theme` +
      (surfaceHex ? ` with ${named(surfaceHex)} pages` + (textHex ? ` and ${named(textHex)} text` : "") : "") +
      ".",
  ];
  if (primaryHex && oklchChroma(primaryHex) < NEUTRAL_CHROMA) {
    overview.push(`The palette is monochrome. The primary color is ${named(primaryHex)}.`);
  } else if (primaryHex) {
    const accents = [secondary, tertiary].filter(Boolean).map(named);
    overview.push(
      `The primary color is ${named(primaryHex)}` +
        (accents.length ? `, with ${joinList(accents)} as ${accents.length === 1 ? "an accent" : "accents"}.` : "."),
    );
  }
  const headlineLevel = ["headline-lg", "headline-md", "headline-sm"].map((l) => ctx.levels[l]).find((l) => l?.family);
  const bodyFamily = ctx.levels["body-md"]?.family;
  if (headlineLevel && bodyFamily) {
    overview.push(
      headlineLevel.family === bodyFamily
        ? `Headings and body text use ${bodyFamily}.`
        : `Headings use ${headlineLevel.family} and body text uses ${bodyFamily}.`,
    );
  } else if (headlineLevel || bodyFamily) {
    overview.push(headlineLevel ? `Headings use ${headlineLevel.family}.` : `Body text uses ${bodyFamily}.`);
  }
  // Each corner value goes with the element kind that uses it most; values
  // that share a kind are joined, for example "4px or 8px on buttons".
  const cornersByKind = new Map();
  for (const token of ctx.rounded.filter((t) => Object.keys(t.uses ?? {}).length)) {
    const [kind] = Object.entries(token.uses).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    cornersByKind.set(kind, [...(cornersByKind.get(kind) ?? []), token.full ? "fully rounded" : px(token.px)]);
  }
  const corners = [...cornersByKind].map(([kind, values]) => `${joinList(values, "or")} on ${KIND_PLURALS[kind] ?? kind}`);
  if (corners.length) overview.push(`Corners are ${joinList(corners)}.`);
  section("Overview", [overview.join(" ")]);

  // Colors
  section(
    "Colors",
    Object.keys(ctx.colors).map((role) => {
      const edit = edits.roles[role];
      const source = edit?.hex ? null : ctx.candidate(edit?.candidate);
      return `- **${ROLE_LABELS[role]} (${ctx.colors[role]}):** ${colorProse(role, source)}`;
    }),
  );

  // Typography
  section(
    "Typography",
    Object.entries(ctx.levels).map(([level, value]) => {
      const family = value.family || "Unnamed font";
      const tags = joinList(value.tags.map((t) => `\`${t.tag}\``));
      return `- **${level}:** ${family}, ${px(value.fontSize)}, weight ${value.fontWeight}. Used on ${tags} elements. Full stack: ${value.stack || family}.`;
    }),
  );

  // Layout
  if (ctx.spacing.length) {
    section("Layout", [
      "Spacing scale for padding and gaps in buttons, inputs, navigation links, cards and layouts:",
      "",
      ...ctx.spacing.map((token) => `- **${token.name}:** ${px(token.px)}`),
    ]);
  }

  // Elevation & Depth
  section(
    "Elevation & Depth",
    model.shadows.map(
      (shadow) => `- \`${shadow.value}\` on ${kindList(Object.fromEntries(shadow.kinds.map((k) => [k.kind, k.count])))}.`,
    ),
  );

  // Shapes
  section(
    "Shapes",
    ctx.rounded.map((token) =>
      Object.keys(token.uses ?? {}).length
        ? `- **${token.name} (${px(token.px)}):** Used on ${kindList(token.uses)}.`
        : `- **${token.name} (${px(token.px)})**`,
    ),
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
