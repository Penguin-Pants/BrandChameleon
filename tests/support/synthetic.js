// Builders for small synthetic collector outputs used by unit tests.
let order = 0;

export function record(overrides = {}) {
  order += 1;
  return {
    kind: "other",
    tag: "div",
    inNav: false,
    color: null,
    bg: null,
    largeBg: false,
    border: null,
    radius: null,
    radiusFull: false,
    padding: null,
    gap: null,
    shadow: null,
    font: null,
    height: null,
    count: 1,
    textLen: 0,
    first: order,
    ...overrides,
  };
}

export const FONT = ["Inter, sans-serif", "16px", "400", "24px", "normal"];

export function text(color, overrides = {}) {
  return record({ tag: "p", color, textLen: 100, font: FONT, ...overrides });
}

export function button(bg, color, overrides = {}) {
  return record({
    kind: "button",
    tag: "button",
    bg,
    color,
    textLen: 5,
    radius: "8px",
    padding: [12, 24, 12, 24],
    height: 44,
    font: ["Inter, sans-serif", "15px", "600", "20px", "normal"],
    ...overrides,
  });
}

export function link(color, overrides = {}) {
  return record({ kind: "link", tag: "a", color, textLen: 10, font: FONT, ...overrides });
}

export function scan({ records = [], page = {}, backgrounds = {}, customProps = [], stylesheets, limits, logoImages } = {}) {
  return {
    page: {
      url: "https://acme.example/",
      hostname: "acme.example",
      origin: "https://acme.example",
      title: "Acme",
      ogSiteName: "",
      applicationName: "",
      ogImage: "",
      icons: [],
      viewport: { width: 1280, height: 720 },
      ...page,
    },
    records: [record({ tag: "html" }), record({ tag: "body", bg: backgrounds.body ?? null }), ...records],
    limits: limits ?? { visible: records.length + 2, visited: records.length + 2, capped: false },
    stylesheets: stylesheets ?? { readable: 1, unreadable: 0 },
    customProps,
    backgrounds: { body: "rgba(0, 0, 0, 0)", html: "rgba(0, 0, 0, 0)", wide: null, ...backgrounds },
    logoImages: logoImages ?? { byAttr: null, byHomeLink: null },
  };
}

export const CONTEXT = { scannedAt: "2026-09-23T12:00:00.000Z", extVersion: "0.1.0" };
