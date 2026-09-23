// Page collector (FR-06, FR-08 to FR-13, FR-32).
//
// `collectPage` runs inside the scanned page through
// `scripting.executeScript({ func: collectPage, args: [options] })`.
// Firefox serializes the function source, so it must stay self-contained:
// no imports, no references to module scope. It reads the page and never
// changes it.
export async function collectPage(options) {
  const { denylist, maxVisibleElements, maxVisitedNodes, loadWaitMs } = options;

  if (document.readyState !== "complete") {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, loadWaitMs);
      window.addEventListener(
        "load",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SKIP_TAGS = new Set([
    "head", "script", "style", "template", "noscript", "iframe", "frame", "object", "embed", "meta", "link", "title",
  ]);
  const SVG_SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "text", "use"]);
  const TEXT_INPUT_EXCLUDED = new Set([
    "button", "submit", "reset", "hidden", "checkbox", "radio", "range", "color", "file", "image",
  ]);

  const exactDenied = new Set(denylist.exact);
  const isDeniedToken = (token) => exactDenied.has(token) || denylist.prefix.some((p) => token.startsWith(p));
  // Read attributes, not properties: a form with <input name="id"> makes
  // form.id return that input element (DOM clobbering).
  const classTokens = (el) => {
    const value = el.getAttribute("class");
    return value ? value.split(/\s+/).filter(Boolean) : [];
  };
  const isDenied = (el) => {
    const id = el.getAttribute("id");
    return (id && isDeniedToken(id)) || classTokens(el).some(isDeniedToken);
  };

  // Only a zero alpha channel is transparent. "rgb(0, 0, 0)" is opaque black.
  const isTransparent = (value) =>
    !value ||
    value === "transparent" ||
    /^(rgba?|hsla?)\(([^,]*,){3}\s*0(\.0+)?\s*\)$/.test(value) ||
    /\/\s*0(\.0+)?%?\s*\)$/.test(value);
  const px = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  // Only pixel lengths: "5%" or "normal" gaps are not spacing values.
  const pxOnly = (value) => (/^-?[\d.]+px$/.test(value) ? px(value) : null);
  const directTextLength = (el) => {
    let length = 0;
    for (const node of el.childNodes) if (node.nodeType === 3) length += node.textContent.trim().length;
    return length;
  };

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const viewportArea = Math.max(1, viewport.width * viewport.height);
  const origin = location.origin;

  const records = new Map();
  const logoImages = { byAttr: null, byHomeLink: null };
  let wideBackground = null;
  let visible = 0;
  let visited = 0;
  let capped = false;
  let order = 0;

  const addRecord = (record, textLength) => {
    const key = JSON.stringify(record);
    const existing = records.get(key);
    if (existing) {
      existing.count += 1;
      existing.textLen += textLength;
    } else {
      records.set(key, { ...record, count: 1, textLen: textLength, first: order });
    }
    order += 1;
  };

  const stack = [];
  // Pushes children in reverse so they pop in DOM order. Stops at the
  // remaining visit budget, so a huge sibling list is never copied whole.
  const pushChildren = (parent, context) => {
    const budget = maxVisitedNodes - visited - stack.length;
    const children = [];
    for (const list of [parent.children, parent.shadowRoot?.children]) {
      if (!list) continue;
      for (let i = 0; i < list.length; i += 1) {
        if (children.length >= budget) {
          capped = true;
          break;
        }
        children.push(list[i]);
      }
    }
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push({ el: children[i], ...context });
  };
  pushChildren(document.documentElement.parentNode, { parentBg: null, inNav: false, inHomeLink: false });

  while (stack.length) {
    if (visible >= maxVisibleElements || visited >= maxVisitedNodes) {
      capped = true;
      break;
    }
    const { el, parentBg, inNav, inHomeLink } = stack.pop();
    visited += 1;
    try {
      const tag = el.localName.toLowerCase();
      if (SKIP_TAGS.has(tag) || isDenied(el)) continue;

      const cs = getComputedStyle(el);
      if (cs.display === "none" || parseFloat(cs.opacity) === 0) continue;

      const bgRaw = cs.backgroundColor;
      const bg = isTransparent(bgRaw) ? null : bgRaw;
      const effectiveBg = bg ?? parentBg;
      const role = el.getAttribute("role");
      const isNav = tag === "nav" || tag === "header" || role === "navigation" || role === "banner";
      const href = tag === "a" && el.hasAttribute("href") ? el.href : null;
      let isHomeLink = inHomeLink;
      if (href) {
        try {
          const url = new URL(href);
          isHomeLink = url.origin === origin && url.pathname === "/";
        } catch {
          isHomeLink = false;
        }
      }
      const childContext = { parentBg: effectiveBg, inNav: inNav || isNav, inHomeLink: isHomeLink };

      const rect = el.getBoundingClientRect();
      const hidden = cs.visibility === "hidden" || cs.visibility === "collapse" || rect.width === 0 || rect.height === 0;
      if (hidden) {
        pushChildren(el, childContext);
        continue;
      }

      const isSvg = el.namespaceURI === SVG_NS;
      if (isSvg && tag !== "svg") {
        if (inNav && SVG_SHAPES.has(tag)) {
          visible += 1;
          const fill = cs.fill && cs.fill.startsWith("url(") ? null : cs.fill;
          const stroke = cs.stroke && cs.stroke.startsWith("url(") ? null : cs.stroke;
          addRecord({ kind: "svg", tag, inNav: true, fill, stroke }, 0);
        }
        pushChildren(el, childContext);
        continue;
      }

      visible += 1;
      const area = rect.width * rect.height;
      const borderVisible = parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== "none" && cs.borderTopStyle !== "hidden";
      const border = borderVisible ? [px(cs.borderTopWidth), cs.borderTopStyle, cs.borderTopColor] : null;
      const isRoot = el === document.body || el === document.documentElement;
      const shadow = cs.boxShadow && cs.boxShadow !== "none" ? cs.boxShadow : null;
      const type = tag === "input" ? (el.getAttribute("type") ?? "text").toLowerCase() : "";
      const tokens = classTokens(el);

      let kind = "other";
      if (
        tag === "button" ||
        (tag === "input" && ["button", "submit", "reset"].includes(type)) ||
        role === "button" ||
        tokens.includes("btn") ||
        tokens.includes("button") ||
        (href && (borderVisible || (bg && bg !== parentBg)))
      ) {
        kind = "button";
      } else if (href) {
        kind = "link";
      } else if (isNav) {
        kind = "nav";
      } else if (/^h[1-6]$/.test(tag)) {
        kind = "heading";
      } else if ((tag === "input" && !TEXT_INPUT_EXCLUDED.has(type)) || tag === "select" || tag === "textarea") {
        kind = "input";
      } else if (!isRoot && area >= 2500 && ((bg && bg !== parentBg) || borderVisible || shadow)) {
        kind = "card";
      }

      const textLength = directTextLength(el);
      const hasText = textLength > 0 || tag === "input" || tag === "textarea" || tag === "select";
      const usesPadding = ["button", "input", "card"].includes(kind) || (kind === "link" && inNav);
      const usesRadius = ["button", "input", "card"].includes(kind) || tag === "img";
      const isFlexOrGrid = /flex|grid/.test(cs.display);

      let radius = null;
      let radiusFull = false;
      if (usesRadius) {
        radius = cs.borderTopLeftRadius.split(" ")[0];
        const value = parseFloat(radius);
        const minSide = Math.min(rect.width, rect.height);
        if (radius.endsWith("%")) radiusFull = value >= 50;
        else radiusFull = value >= 9999 || (minSide > 0 && value >= minSide / 2);
        if (!Number.isFinite(value) || value === 0) radius = null;
      }

      const record = {
        kind,
        tag,
        inNav,
        color: hasText || ["button", "link", "heading", "nav"].includes(kind) ? cs.color : null,
        bg,
        largeBg: Boolean(bg) && area >= viewportArea * 0.25,
        border,
        radius,
        radiusFull: radius !== null && radiusFull,
        padding: usesPadding ? [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px) : null,
        gap: isFlexOrGrid ? [cs.rowGap, cs.columnGap].map(pxOnly) : null,
        shadow: ["button", "card", "nav"].includes(kind) ? shadow : null,
        font: hasText || ["button", "heading", "link"].includes(kind)
          ? [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.lineHeight, cs.letterSpacing]
          : null,
        height: kind === "button" ? Math.round(rect.height) : null,
      };
      addRecord(record, textLength);

      if (bg && !isRoot && rect.width >= viewport.width * 0.9) {
        if (!wideBackground || area > wideBackground.area) wideBackground = { bg, area };
      }

      if (tag === "img" && inNav) {
        const text = ["id", "class", "alt", "src"].map((name) => el.getAttribute(name) ?? "").join(" ").toLowerCase();
        const image = { src: el.currentSrc || el.src, width: el.naturalWidth || null, height: el.naturalHeight || null };
        if (!logoImages.byAttr && text.includes("logo")) logoImages.byAttr = image;
        if (!logoImages.byHomeLink && inHomeLink) logoImages.byHomeLink = image;
      }

      pushChildren(el, childContext);
    } catch {
      // A hostile page can clobber element properties (for example
      // <input name="localName"> in a form). Skip that subtree only.
    }
  }

  // Custom properties declared on :root or html in readable stylesheets (FR-13).
  const names = new Set();
  const stylesheets = { readable: 0, unreadable: 0 };
  const walkRules = (rules) => {
    for (const rule of rules) {
      if (rule.selectorText && rule.style) {
        const selectors = rule.selectorText.split(",").map((s) => s.trim());
        if (selectors.includes(":root") || selectors.includes("html")) {
          for (const prop of rule.style) if (prop.startsWith("--")) names.add(prop);
        }
      }
      if (rule.cssRules) walkRules(rule.cssRules);
      if (rule.styleSheet) readSheet(rule.styleSheet);
    }
  };
  const readSheet = (sheet) => {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      stylesheets.unreadable += 1;
      return;
    }
    stylesheets.readable += 1;
    walkRules(rules);
  };
  for (const sheet of document.styleSheets) readSheet(sheet);
  const rootStyle = getComputedStyle(document.documentElement);
  const customProps = [...names]
    .slice(0, 500)
    .map((name) => ({ name, value: rootStyle.getPropertyValue(name).trim() }))
    .filter((prop) => prop.value && prop.value.length <= 100);

  const meta = (selector) => document.querySelector(selector)?.getAttribute("content") ?? "";
  const icons = [...document.querySelectorAll("link[rel][href]")]
    .filter((link) => /(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(link.getAttribute("rel")))
    .map((link) => ({
      rel: link.getAttribute("rel").toLowerCase(),
      href: link.href,
      sizes: link.getAttribute("sizes") ?? "",
      type: link.getAttribute("type") ?? "",
    }));

  return {
    page: {
      url: location.href,
      hostname: location.hostname,
      origin,
      title: document.title,
      ogSiteName: meta('meta[property="og:site_name"]'),
      applicationName: meta('meta[name="application-name"]'),
      ogImage: meta('meta[property="og:image"]'),
      icons,
      viewport,
    },
    records: [...records.values()],
    limits: { visible, visited, capped },
    stylesheets,
    customProps,
    backgrounds: {
      body: document.body ? getComputedStyle(document.body).backgroundColor : null,
      html: rootStyle.backgroundColor,
      wide: wideBackground ? wideBackground.bg : null,
    },
    logoImages,
  };
}
