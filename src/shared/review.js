// Review edits on top of an analysis model (FR-43 to FR-45).
import { isValidHexInput, parseColor, toHex } from "./color.js";
import { ROLE_ORDER } from "./constants.js";
import { fileNameFor } from "./naming.js";
import { cleanName } from "./sanitize.js";

export function hasGroupData(model, group) {
  switch (group) {
    case "typography":
      return Object.keys(model.typography).length > 0;
    case "rounded":
      return model.rounded.scale.length > 0 || Boolean(model.rounded.full);
    case "spacing":
      return model.spacing.length > 0;
    case "components":
      return Object.keys(model.components).length > 0;
    default:
      return false;
  }
}

export function initialEdits(model) {
  return {
    name: model.name,
    roles: Object.fromEntries(
      ROLE_ORDER.map((role) => [role, model.roles[role] ? { candidate: model.roles[role] } : null]),
    ),
    typography: Object.fromEntries(
      Object.entries(model.typography).map(([level, value]) => [level, { include: true, family: value.family }]),
    ),
    groups: {
      typography: hasGroupData(model, "typography"),
      rounded: hasGroupData(model, "rounded"),
      spacing: hasGroupData(model, "spacing"),
      components: hasGroupData(model, "components"),
    },
    logo: model.logos.length ? 0 : null,
  };
}

/** Resolved hex for a role, or null. */
export function roleHex(model, edits, role) {
  const value = edits.roles[role];
  if (!value) return null;
  if (value.hex) return value.hex;
  return model.candidates.find((c) => c.id === value.candidate)?.hex ?? null;
}

/**
 * Returns a role value from a candidate id, a hex string or "none".
 * Returns undefined for invalid hex input, so the caller keeps the old value.
 */
export function parseRoleInput(model, input) {
  if (typeof input !== "string") return undefined;
  if (input === "none" || input === "") return null;
  if (model.candidates.some((c) => c.id === input)) return { candidate: input };
  // Keep the typed alpha, including fully transparent values.
  if (isValidHexInput(input)) return { hex: toHex(parseColor(input.trim())) };
  return undefined;
}

export function downloadBlockers(model, edits) {
  const reasons = [];
  if (!cleanName(edits.name)) reasons.push("Enter a name.");
  if (!roleHex(model, edits, "primary")) reasons.push("Choose a primary color.");
  return reasons;
}

export function fileNameForReview(model, edits) {
  return fileNameFor(cleanName(edits.name), model.source.hostname);
}
