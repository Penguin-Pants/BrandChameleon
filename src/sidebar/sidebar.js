// Review sidebar (section 7, FR-42 to FR-51).
import { isValidHexInput, normalizeColor } from "../shared/color.js";
import { ROLE_ORDER, SIDEBAR_SCAN_TIMEOUT_MS, TYPE_LEVELS } from "../shared/constants.js";
import { generate } from "../shared/generate.js";
import { checkRawMarkdown } from "../shared/raw-check.js";
import {
  downloadBlockers,
  fileNameForReview,
  hasGroupData,
  initialEdits,
  parseRoleInput,
  roleHex,
} from "../shared/review.js";
import { confirmDialog } from "./dialogs.js";
import { h } from "./dom.js";

const ROLE_LABELS = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
  neutral: "Neutral",
  surface: "Surface",
  "on-surface": "On-surface",
  "on-primary": "On-primary",
};
const GROUP_LABELS = { rounded: "Shapes", spacing: "Spacing", components: "Components" };
const RETRY = "Click the toolbar button to scan again.";
const ERRORS = {
  restricted:
    "BrandChameleon cannot scan this page. Firefox blocks extensions on some pages, for example about: pages and addons.mozilla.org.",
  changed: "The page changed during the scan.",
  timeout: "The scan took too long. Reload the page first.",
  "no-content": "No visible content found on this page.",
};

const $ = (id) => document.getElementById(id);
const state = { windowId: null, scan: null, review: null, bindings: [], timer: null, saveTimer: null };
const scanKey = () => `scan:${state.windowId}`;
const reviewKey = () => `review:${state.windowId}`;

// Persistence --------------------------------------------------------------

function saveReview({ debounce = false } = {}) {
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  const write = () => {
    state.saveTimer = null;
    return browser.storage.session.set({ [reviewKey()]: state.review });
  };
  if (debounce) state.saveTimer = setTimeout(write, 250);
  else return write();
}

// Flush a pending debounced save when the sidebar closes.
window.addEventListener("pagehide", () => {
  if (state.saveTimer && state.review) saveReview();
});

function announce(text) {
  $("status").textContent = text;
}

// View selection ------------------------------------------------------------

function show(id) {
  for (const view of ["view-empty", "view-loading", "view-error", "view-review"]) $(view).hidden = view !== id;
  $("review-footer").hidden = id !== "view-review";
}

function scanTimedOut(scan) {
  return scan?.status === "scanning" && Date.now() - scan.startedAt > SIDEBAR_SCAN_TIMEOUT_MS;
}

function errorMessage(code) {
  return `${ERRORS[code] ?? ERRORS.restricted} ${RETRY}`;
}

function render() {
  clearTimeout(state.timer);
  const { scan, review } = state;
  const banner = $("banner");
  banner.hidden = true;
  banner.removeAttribute("role");

  let error = null;
  if (scan?.status === "error") error = scan.error;
  if (scanTimedOut(scan)) error = "timeout";
  const scanning = scan?.status === "scanning" && !error;
  const host = scan?.hostname || "this page";

  if (scanning) {
    state.timer = setTimeout(render, Math.max(0, scan.startedAt + SIDEBAR_SCAN_TIMEOUT_MS - Date.now()) + 50);
  }

  if (review) {
    show("view-review");
    if (scanning) {
      banner.textContent = `Scanning ${host}...`;
      banner.hidden = false;
    } else if (error) {
      banner.textContent = errorMessage(error);
      banner.setAttribute("role", "alert");
      banner.hidden = false;
    }
    return;
  }
  if (scanning) {
    $("loading-text").textContent = `Scanning ${host}...`;
    show("view-loading");
  } else if (error) {
    $("error-text").textContent = errorMessage(error);
    show("view-error");
  } else {
    show("view-empty");
  }
}

// Scan handling -------------------------------------------------------------

function loadScan(scan) {
  state.review = {
    scanId: scan.scanId,
    model: scan.model,
    edits: initialEdits(scan.model),
    rawText: null,
    dirty: false,
    dismissedScanId: null,
  };
  saveReview();
  buildReview();
  announce("Scan complete");
}

async function onScanChanged() {
  const { scan, review } = state;
  if (scan?.status === "done" && scan.scanId !== review?.scanId && scan.scanId !== review?.dismissedScanId) {
    if (review?.dirty) {
      render();
      const replace = await confirmDialog({
        title: "Replace review?",
        message: `Discard your edits for ${review.model.source.hostname || "this page"}?`,
        confirmLabel: "Replace",
        cancelLabel: "Keep",
      });
      if (replace) loadScan(scan);
      else {
        state.review.dismissedScanId = scan.scanId;
        saveReview();
      }
    } else {
      loadScan(scan);
    }
  }
  render();
}

// Review form ----------------------------------------------------------------

function markdownText() {
  const { review } = state;
  return review.rawText ?? generate(review.model, review.edits);
}

function refreshOutput({ keepText = false } = {}) {
  const { review } = state;
  const { model, edits } = review;
  const textarea = $("markdown");
  if (!keepText) textarea.value = markdownText();
  $("edited-badge").hidden = review.rawText === null;
  $("filename").textContent = fileNameForReview(model, edits);
  const blockers = downloadBlockers(model, edits);
  const reason = blockers.join(" ");
  if (reason && reason !== $("blockers").textContent) announce(reason);
  $("blockers").textContent = reason;
  $("download").disabled = blockers.length > 0;
  for (const role of ROLE_ORDER) {
    const swatch = $(`swatch-${role}`);
    const hex = roleHex(model, edits, role);
    swatch.style.backgroundColor = hex ?? "transparent";
    swatch.classList.toggle("empty", !hex);
  }
}

/** Writes edit values back into controls. `force` also rewrites the focused field. */
function syncControls({ force = false } = {}) {
  for (const binding of state.bindings) binding(force);
}

/** Applies an edit. After text edits, asks before regenerating (FR-46). */
async function applyEdit(mutate, opener) {
  const { review } = state;
  if (review.rawText !== null) {
    const proceed = await confirmDialog({
      title: "Regenerate markdown?",
      message: "Regenerating the markdown discards your text edits.",
      confirmLabel: "Continue",
      cancelLabel: "Cancel",
      opener,
    });
    if (!proceed) {
      syncControls({ force: true });
      return;
    }
    review.rawText = null;
  }
  mutate(review.edits);
  review.dirty = true;
  syncControls();
  refreshOutput();
  saveReview({ debounce: true });
}

function bind(el, sync) {
  state.bindings.push(sync);
  sync(true);
  return el;
}

function sectionBlock(id, title, ...children) {
  return h("section", { class: "block", "aria-labelledby": `h-${id}` }, h("h2", { id: `h-${id}` }, title), ...children);
}

function usesTotal(candidate) {
  return Object.values(candidate.uses).reduce((sum, n) => sum + n, 0);
}

function roleRow(role) {
  const { model } = state.review;
  const optional = role !== "primary";
  const select = h(
    "select",
    { id: `role-${role}` },
    model.candidates.map((c) => h("option", { value: c.id }, `${c.hex} (${usesTotal(c)} uses)`)),
    h("option", { value: "custom", disabled: true }, "Custom hex"),
    optional ? h("option", { value: "none" }, "None") : null,
  );
  const hexInput = h("input", {
    id: `hex-${role}`,
    type: "text",
    inputmode: "text",
    autocomplete: "off",
    spellcheck: "false",
    "aria-describedby": `hex-error-${role}`,
  });
  const picker = h("input", { id: `pick-${role}`, type: "color" });
  const error = h("p", { id: `hex-error-${role}`, class: "field-error", hidden: true }, "Use #RGB, #RRGGBB or #RRGGBBAA.");

  bind(select, (force) => {
    const value = state.review.edits.roles[role];
    select.value = value?.candidate ?? (value?.hex ? "custom" : optional ? "none" : "custom");
    const hex = roleHex(state.review.model, state.review.edits, role);
    if (force || document.activeElement !== hexInput) hexInput.value = hex ?? "";
    picker.value = (hex ?? "#000000").slice(0, 7).toLowerCase();
    hexInput.removeAttribute("aria-invalid");
    error.hidden = true;
  });

  const setRole = (input, opener) => {
    let value = parseRoleInput(model, input);
    if (value?.hex) {
      const match = model.candidates.find((c) => c.hex === value.hex);
      if (match) value = { candidate: match.id };
    }
    if (value === undefined) return false;
    if (value === null && !optional) return false;
    applyEdit((edits) => {
      edits.roles[role] = value;
    }, opener);
    return true;
  };

  select.addEventListener("change", () => setRole(select.value, select));
  hexInput.addEventListener("input", () => {
    const raw = hexInput.value.trim();
    if (!isValidHexInput(raw)) {
      hexInput.setAttribute("aria-invalid", "true");
      if (error.hidden) announce(error.textContent);
      error.hidden = false;
      return;
    }
    hexInput.removeAttribute("aria-invalid");
    error.hidden = true;
    setRole(normalizeColor(raw), hexInput);
  });
  picker.addEventListener("input", () => setRole(picker.value, picker));

  return h(
    "fieldset",
    { class: "role" },
    h("legend", {}, h("span", { id: `swatch-${role}`, class: "swatch", "aria-hidden": "true" }), ROLE_LABELS[role]),
    h("div", { class: "role-fields" },
      h("label", { for: `role-${role}` }, "Source", select),
      h("label", { for: `hex-${role}` }, "Hex", hexInput),
      h("label", { for: `pick-${role}` }, "Pick", picker),
    ),
    error,
  );
}

function groupToggle(group, label) {
  const { model } = state.review;
  const available = hasGroupData(model, group);
  const box = h("input", { id: `group-${group}`, type: "checkbox", disabled: !available });
  bind(box, () => {
    box.checked = available && state.review.edits.groups[group];
  });
  box.addEventListener("change", () =>
    applyEdit((edits) => {
      edits.groups[group] = box.checked;
    }, box),
  );
  return h(
    "p",
    { class: "toggle" },
    h("label", { for: `group-${group}` }, box, available ? `Include ${label.toLowerCase()}` : `${label}: Not detected`),
  );
}

function typographyRow(level) {
  const value = state.review.model.typography[level];
  const include = h("input", { id: `type-${level}`, type: "checkbox" });
  const family = h("input", { id: `family-${level}`, type: "text", autocomplete: "off", spellcheck: "false" });
  bind(include, () => {
    include.checked = state.review.edits.typography[level].include;
  });
  bind(family, (force) => {
    if (force || document.activeElement !== family) family.value = state.review.edits.typography[level].family;
  });
  include.addEventListener("change", () =>
    applyEdit((edits) => {
      edits.typography[level].include = include.checked;
    }, include),
  );
  family.addEventListener("input", () =>
    applyEdit((edits) => {
      edits.typography[level].family = family.value;
    }, family),
  );
  const details = [
    `${value.fontSize}px`,
    `weight ${value.fontWeight}`,
    value.lineHeight !== null ? `line height ${value.lineHeight}` : null,
    value.letterSpacing !== null ? `letter spacing ${value.letterSpacing}em` : null,
  ].filter(Boolean);
  return h(
    "div",
    { class: "type-row" },
    h("label", { for: `type-${level}`, class: "inline" }, include, level),
    h("label", { for: `family-${level}` }, "Font family", family),
    h("p", { class: "muted" }, details.join(", ")),
  );
}

function logoBlock() {
  const { model } = state.review;
  const radios = model.logos.map((logo, index) => {
    const radio = h("input", { type: "radio", name: "logo", id: `logo-${index}`, value: String(index) });
    bind(radio, () => {
      radio.checked = state.review.edits.logo === index;
    });
    radio.addEventListener("change", () =>
      applyEdit((edits) => {
        edits.logo = index;
      }, radio),
    );
    const size = logo.width && logo.height ? `, ${logo.width} x ${logo.height} px` : "";
    const thumbnail = h("img", { alt: "", width: 32, height: 32, referrerpolicy: "no-referrer", loading: "lazy" });
    thumbnail.addEventListener("error", () => thumbnail.classList.add("broken"), { once: true });
    if (/^https?:/.test(logo.url)) thumbnail.src = logo.url;
    return h(
      "label",
      { for: `logo-${index}`, class: "logo-option" },
      radio,
      thumbnail,
      h("span", {}, h("span", { class: "logo-label" }, `${logo.label}${size}`), h("span", { class: "url", title: logo.url }, logo.url)),
    );
  });
  const none = h("input", { type: "radio", name: "logo", id: "logo-none", value: "none" });
  bind(none, () => {
    none.checked = state.review.edits.logo === null;
  });
  none.addEventListener("change", () =>
    applyEdit((edits) => {
      edits.logo = null;
    }, none),
  );
  return h(
    "fieldset",
    { class: "logos" },
    h("legend", {}, "Logo"),
    radios,
    h("label", { for: "logo-none", class: "logo-option" }, none, h("span", {}, "None")),
  );
}

function buildReview() {
  const { model } = state.review;
  state.bindings = [];
  const form = $("view-review");

  const name = h("input", { id: "name-input", type: "text", autocomplete: "off", required: true });
  bind(name, (force) => {
    if (force || document.activeElement !== name) name.value = state.review.edits.name;
  });
  name.addEventListener("input", () =>
    applyEdit((e) => {
      e.name = name.value;
    }, name),
  );

  const scanned = new Date(model.source.scannedAt);
  const typographyLevels = TYPE_LEVELS.filter((level) => model.typography[level]);

  const markdown = h("textarea", { id: "markdown", rows: 18, spellcheck: "false", autocomplete: "off" });
  markdown.addEventListener("input", () => {
    state.review.rawText = markdown.value;
    state.review.dirty = true;
    $("edited-badge").hidden = false;
    saveReview({ debounce: true });
  });

  form.replaceChildren(
    sectionBlock(
      "source",
      "Source",
      h("p", { class: "source-host", title: model.source.url || null }, model.source.hostname || "Local page"),
      h("p", { class: "muted" }, "Scanned ", h("time", { datetime: model.source.scannedAt }, scanned.toLocaleString())),
    ),
    sectionBlock("name", "Name", h("label", { for: "name-input" }, "Company name", name)),
    sectionBlock(
      "colors",
      "Colors",
      ROLE_ORDER.map(roleRow),
      h("h3", {}, "Detected colors"),
      h(
        "ul",
        { class: "palette" },
        model.candidates.map((c) => {
          const swatch = h("span", { class: "swatch", "aria-hidden": "true" });
          swatch.style.backgroundColor = c.hex;
          return h("li", {}, swatch, h("code", {}, c.hex), h("span", { class: "muted" }, `${usesTotal(c)} uses`));
        }),
      ),
    ),
    sectionBlock(
      "typography",
      "Typography",
      groupToggle("typography", "Typography"),
      typographyLevels.map(typographyRow),
    ),
    sectionBlock(
      "shapes",
      "Shapes",
      groupToggle("rounded", GROUP_LABELS.rounded),
      h(
        "ul",
        { class: "values" },
        model.rounded.scale.map((r) => h("li", {}, `${r.name}: ${r.px}px`)),
        model.rounded.full ? h("li", {}, "full: 9999px") : null,
      ),
    ),
    sectionBlock(
      "spacing",
      "Spacing",
      groupToggle("spacing", GROUP_LABELS.spacing),
      h("ul", { class: "values" }, model.spacing.map((s) => h("li", {}, `${s.name}: ${s.px}px`))),
    ),
    sectionBlock(
      "components",
      "Components",
      groupToggle("components", GROUP_LABELS.components),
      h("ul", { class: "values" }, Object.keys(model.components).map((c) => h("li", {}, c))),
    ),
    sectionBlock("logo", "Logo", model.logos.length ? logoBlock() : h("p", { class: "muted" }, "No logo URL found.")),
    sectionBlock(
      "markdown",
      "Markdown",
      h(
        "label",
        { for: "markdown" },
        "File content ",
        h("span", { id: "edited-badge", class: "badge", hidden: true }, "Edited"),
      ),
      markdown,
    ),
  );

  markdown.value = markdownText();
  refreshOutput({ keepText: true });
}

// Download -------------------------------------------------------------------

async function download() {
  const { review } = state;
  const button = $("download");
  if (downloadBlockers(review.model, review.edits).length) return;
  const text = $("markdown").value;
  const failures = checkRawMarkdown(text);
  if (failures.length) {
    const proceed = await confirmDialog({
      title: "Check the markdown",
      message: "The file may not be valid DESIGN.md:",
      items: failures,
      confirmLabel: "Download anyway",
      cancelLabel: "Cancel",
      opener: button,
    });
    if (!proceed) return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = h("a", { href: url, download: fileNameForReview(review.model, review.edits), hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  review.dirty = false;
  await saveReview();
  announce("Download started");
}

// Startup --------------------------------------------------------------------

async function init() {
  const current = await browser.windows.getCurrent();
  state.windowId = current.id;
  // Listen before the first read, so a scan that ends in between is not lost.
  let ready = false;
  let changedEarly = false;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "session" || !(scanKey() in changes)) return;
    state.scan = changes[scanKey()].newValue ?? null;
    changedEarly = !ready;
    if (ready) onScanChanged().catch((error) => console.error("[BrandChameleon]", error));
  });
  const stored = await browser.storage.session.get([scanKey(), reviewKey()]);
  if (!changedEarly) state.scan = stored[scanKey()] ?? null;
  state.review = stored[reviewKey()] ?? null;
  if (state.review) buildReview();
  $("download").addEventListener("click", download);
  ready = true;
  await onScanChanged();
}

init().catch((error) => console.error("[BrandChameleon]", error));
