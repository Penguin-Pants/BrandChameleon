// Sanitizers for page-derived text (FR-40).

// C0 and C1 controls, DEL and the Unicode line and paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;

export function cleanText(value, maxLength = 200) {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_RE, " ").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

export function cleanName(value) {
  return cleanText(value, 100);
}

export function cleanFontFamily(value) {
  const unquoted = cleanText(value, 200).replace(/^["']|["']$/g, "");
  return unquoted.replace(/[^\p{L}\p{N} \-_.']/gu, "").replace(/\s+/g, " ").trim().slice(0, 64).trim();
}

export function cleanCustomPropertyName(value) {
  const cleaned = cleanText(value, 100).replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned.startsWith("--") ? cleaned : "";
}

/** Keeps computed box-shadow text readable and inert. */
export function cleanCssValue(value) {
  return cleanText(value, 200).replace(/[^A-Za-z0-9 .,()#%/-]/g, "");
}

/** Returns an absolute http(s) URL or null. */
export function cleanUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Absolute http(s) URL without query string and fragment (FR-35). Else "". */
export function cleanSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}
