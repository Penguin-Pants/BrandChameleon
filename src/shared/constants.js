// Tunable analysis constants (FR-10, FR-16 to FR-18, FR-23 to FR-25).

export const SCAN_LIMITS = {
  maxVisibleElements: 5000,
  maxVisitedNodes: 50000,
  loadWaitMs: 5000,
};

export const SCAN_TIMEOUT_MS = 15000;
export const SIDEBAR_SCAN_TIMEOUT_MS = 20000;

// Weight per element for each color use (FR-18).
export const USE_WEIGHTS = {
  buttonBg: 10,
  buttonBorder: 6,
  linkText: 4,
  largeBg: 5,
  navBg: 3,
  navSvg: 3,
  headingText: 2,
  buttonText: 2,
  other: 1,
};

export const INTERACTIVE_USES = new Set(["buttonBg", "buttonBorder", "linkText"]);

// Firefox and Chrome paint unstyled links in these colors (link, visited).
// They are not brand choices, so link text in them does not enter the palette.
export const BROWSER_DEFAULT_LINK_COLORS = new Set(["#0000EE", "#551A8B"]);

export const CLUSTER_DISTANCE = 0.03;
export const NEUTRAL_CHROMA = 0.04;
export const ACCENT_MIN_DISTANCE = 0.08;
export const ACCENT_MIN_WEIGHT_RATIO = 0.1;
export const NEUTRAL_MIN_DISTANCE = 0.05;
export const MAX_CANDIDATES = 12;
export const DARK_SURFACE_LUMINANCE = 0.2;
export const WCAG_AA = 4.5;

export const ROLE_ORDER = ["primary", "secondary", "tertiary", "neutral", "surface", "on-surface", "on-primary"];
export const TYPE_LEVELS = ["headline-lg", "headline-md", "headline-sm", "body-md", "body-sm", "label-md"];
export const GROUPS = ["typography", "rounded", "spacing", "components"];
