// Company name detection and file naming (FR-30, FR-31).
import { cleanName } from "./sanitize.js";

const TWO_PART_SUFFIXES = new Set(["co.uk", "com.au", "co.jp", "co.nz", "com.br", "co.in", "co.za"]);
const TITLE_SEPARATORS = / \| | - | · | • |: | \u2013 | \u2014 /;

const alnum = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function isIpAddress(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
}

/** The label directly before the top-level domain, or "" when the host has none. */
export function domainLabel(hostname) {
  const host = (hostname ?? "").toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || isIpAddress(host)) return "";
  const labels = host.replace(/^www\./, "").split(".");
  if (labels.length === 1) return labels[0];
  const lastTwo = labels.slice(-2).join(".");
  if (TWO_PART_SUFFIXES.has(lastTwo) && labels.length >= 3) return labels[labels.length - 3];
  return labels[labels.length - 2];
}

function titleSegment(title, label) {
  const segments = title.split(TITLE_SEPARATORS).map((s) => s.trim()).filter(Boolean);
  if (!segments.length) return "";
  if (!label) return segments[0];
  const target = alnum(label);
  const containing = segments.find((s) => alnum(s).includes(target));
  if (containing) return containing;
  return segments.find((s) => alnum(s).length >= 3 && target.includes(alnum(s))) ?? "";
}

/**
 * Detects the company name from page metadata (FR-30).
 * @param {{ hostname: string, title?: string, ogSiteName?: string, applicationName?: string }} page
 */
export function detectName(page) {
  const label = domainLabel(page.hostname);
  const candidates = [
    cleanName(page.ogSiteName),
    cleanName(page.applicationName),
    cleanName(titleSegment(cleanName(page.title), label)),
  ];
  const found = candidates.find(Boolean);
  if (found) return found;
  const fallback = label || "site";
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

export function slugify(value) {
  const slug = (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 60).replace(/-+$/g, "");
}

/** `<slug>_design.md` with domain and "site" fallbacks (FR-31). */
export function fileNameFor(name, hostname) {
  const slug = slugify(name) || slugify(domainLabel(hostname)) || "site";
  return `${slug}_design.md`;
}
