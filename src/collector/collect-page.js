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
  // FR-12: some design systems paint a control's fill with a ::before or ::after
  // layer over a transparent element (booking.com's Search button does). A
  // visible layer whose painted box covers most of the element counts as its fill.
  const fillLayer = (el, cs, rect) => {
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === "none" || ps.content === "normal" || ps.display === "none") continue;
      if (parseFloat(ps.opacity) === 0 || isTransparent(ps.backgroundColor)) continue;
      if (layerCovers(ps, cs, rect)) return { color: ps.backgroundColor, style: ps };
    }
    return null;
  };
  // The painted box of an absolute layer, in the element's border-box coordinates,
  // after its transform, translate and scale. A layer whose painted box is not
  // known is not a fill: placed by an ancestor, rotated, skewed, clipped or hidden.
  const layerCovers = (ps, cs, rect) => {
    if (ps.position !== "absolute" || (cs.position === "static" && cs.transform === "none")) return false;
    if (ps.visibility !== "visible" || ps.clipPath !== "none" || (ps.rotate ?? "none") !== "none") return false;
    const length = (value, full) => (value.endsWith("%") ? (parseFloat(value) / 100) * full : parseFloat(value));
    const matrix = /^matrix(3d)?\(([^)]+)\)$/.exec(ps.transform);
    if (ps.transform !== "none" && !matrix) return false;
    const m = matrix ? matrix[2].split(",").map(Number) : [1, 0, 0, 1, 0, 0];
    const [a, b, c, d, e, f] = matrix?.[1] ? [m[0], m[1], m[4], m[5], m[12], m[13]] : m;
    if (Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6) return false;
    const [scaleX = 1, scaleY = scaleX] = (ps.scale ?? "none") === "none" ? [] : ps.scale.split(" ").map((v) => length(v, 1));
    const [translateX = "0px", translateY = "0px"] = (ps.translate ?? "none") === "none" ? [] : ps.translate.split(" ");
    const [originX, originY] = ps.transformOrigin.split(" ").map(parseFloat);
    // One axis: offsets start at the padding box; a content-box layer adds its padding
    // and border. A point p paints at origin + translate + scale * (matrix * (p - origin) + shift).
    const axis = ([start, end, size, before, after], full, matrixScale, shift, scale, origin, translate) => {
      const border = [before, after].map((side) => parseFloat(cs[`border${side}Width`]) || 0);
      const inner = full - border[0] - border[1];
      let from = length(ps[start], inner);
      const to = length(ps[end], inner);
      let span = length(ps[size], inner);
      if (!Number.isFinite(span)) span = inner - (Number.isFinite(from) ? from : 0) - (Number.isFinite(to) ? to : 0);
      if (!Number.isFinite(from)) from = Number.isFinite(to) ? inner - to - span : 0;
      if (ps.boxSizing !== "border-box") {
        for (const side of [before, after]) {
          span += (parseFloat(ps[`padding${side}`]) || 0) + (parseFloat(ps[`border${side}Width`]) || 0);
        }
      }
      const offset = length(translate, span);
      const ends = [0, span].map((p) => border[0] + from + origin + offset + scale * (matrixScale * (p - origin) + shift));
      const painted = Math.min(Math.max(...ends), full) - Math.max(Math.min(...ends), 0);
      return Number.isFinite(painted) && painted >= full * 0.8;
    };
    return (
      axis(["left", "right", "width", "Left", "Right"], rect.width, a, e, scaleX, originX, translateX) &&
      axis(["top", "bottom", "height", "Top", "Bottom"], rect.height, d, f, scaleY, originY, translateY)
    );
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
    const withText = textLength > 0 ? 1 : 0;
    if (existing) {
      existing.count += 1;
      existing.textLen += textLength;
      existing.textCount += withText;
    } else {
      records.set(key, { ...record, count: 1, textLen: textLength, textCount: withText, first: order });
    }
    order += 1;
  };

  // Depth-first walk with lazy child iteration. Each frame reads its live
  // child lists (light DOM, then open shadow root) by index, so DOM order
  // holds under the limits and no sibling list is ever copied.
  const frames = [];
  const pushChildren = (parent, context) => {
    const lists = [parent.children, parent.shadowRoot?.children].filter(
      (list) => list && typeof list.length === "number",
    );
    if (lists.length) frames.push({ lists, list: 0, index: 0, context });
  };
  const nextEntry = () => {
    while (frames.length) {
      const frame = frames[frames.length - 1];
      const list = frame.lists[frame.list];
      if (frame.index < list.length) {
        const el = list[frame.index];
        frame.index += 1;
        return { el, ...frame.context };
      }
      frame.list += 1;
      frame.index = 0;
      if (frame.list >= frame.lists.length) frames.pop();
    }
    return null;
  };
  pushChildren(document, { parentBg: null, inNav: false, inHomeLink: false, inLink: false });

  for (;;) {
    const entry = nextEntry();
    if (!entry) break;
    if (visible >= maxVisibleElements || visited >= maxVisitedNodes) {
      capped = true;
      break;
    }
    const { el, parentBg, inNav, inHomeLink, inLink } = entry;
    visited += 1;
    try {
      const tag = el.localName.toLowerCase();
      if (SKIP_TAGS.has(tag) || isDenied(el)) continue;

      const cs = getComputedStyle(el);
      if (cs.display === "none" || parseFloat(cs.opacity) === 0) continue;

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
      // inLink: content of a link inherits its color, including the browser default (FR-21).
      const context = { inNav: inNav || isNav, inHomeLink: isHomeLink, inLink: inLink || Boolean(href) };

      const rect = el.getBoundingClientRect();
      const hidden = cs.visibility === "hidden" || cs.visibility === "collapse" || rect.width === 0 || rect.height === 0;
      if (hidden) {
        // A hidden element paints no background, so children keep the one below it.
        pushChildren(el, { ...context, parentBg });
        continue;
      }

      const type = tag === "input" ? (el.getAttribute("type") ?? "text").toLowerCase() : "";
      const tokens = classTokens(el);
      const buttonLike =
        tag === "button" ||
        (tag === "input" && ["button", "submit", "reset"].includes(type)) ||
        role === "button" ||
        tokens.includes("btn") ||
        tokens.includes("button");
      const clickable = buttonLike || Boolean(href);
      const ownBg = isTransparent(cs.backgroundColor) ? null : cs.backgroundColor;
      const layer = !ownBg && clickable ? fillLayer(el, cs, rect) : null;
      const bg = ownBg ?? layer?.color ?? null;
      const childContext = { ...context, parentBg: bg ?? parentBg };

      const isSvg = el.namespaceURI === SVG_NS;
      if (isSvg && tag !== "svg") {
        if (inNav && SVG_SHAPES.has(tag)) {
          visible += 1;
          const fill = cs.fill && cs.fill.startsWith("url(") ? null : cs.fill;
          const stroke = cs.stroke && cs.stroke.startsWith("url(") ? null : cs.stroke;
          addRecord({ kind: "svg", tag, inNav: true, ...(inLink && { inLink }), fill, stroke }, 0);
        }
        pushChildren(el, childContext);
        continue;
      }

      visible += 1;
      const area = rect.width * rect.height;
      const borderVisible =
        parseFloat(cs.borderTopWidth) >= 1 &&
        cs.borderTopStyle !== "none" &&
        cs.borderTopStyle !== "hidden" &&
        !isTransparent(cs.borderTopColor);
      const border = borderVisible ? [px(cs.borderTopWidth), cs.borderTopStyle, cs.borderTopColor] : null;
      const isRoot = el === document.body || el === document.documentElement;
      const shadow = cs.boxShadow && cs.boxShadow !== "none" ? cs.boxShadow : null;

      // FR-11: a filled or bordered link is a button up to 64px tall. A taller
      // one is a clickable tile, so it can only be a card.
      const styledLink = Boolean(href) && (borderVisible || (Boolean(bg) && bg !== parentBg));
      let kind = "other";
      if (buttonLike || (styledLink && rect.height <= 64)) {
        kind = "button";
      } else if (styledLink && !isRoot && area >= 2500) {
        kind = "card";
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
        // An elliptical corner ("20px 1px") has no single radius: ignore it.
        // A fill layer carries the visible corners when the element has none.
        const shape = layer && parseFloat(cs.borderTopLeftRadius) === 0 ? layer.style : cs;
        const [horizontal, vertical = horizontal] = shape.borderTopLeftRadius.split(" ");
        radius = horizontal === vertical ? horizontal : "0px";
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
        ...(inLink && { inLink }),
        color: hasText || ["button", "link", "heading", "nav"].includes(kind) ? cs.color : null,
        bg,
        largeBg: Boolean(bg) && area >= viewportArea * 0.25,
        border,
        radius,
        radiusFull: radius !== null && radiusFull,
        padding: usesPadding ? [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px) : null,
        gap: isFlexOrGrid ? [cs.rowGap, cs.columnGap].map(pxOnly) : null,
        shadow,
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
        // data: and blob: images have no shareable URL; keep looking.
        const usable = /^https?:/i.test(image.src);
        if (usable && !logoImages.byAttr && text.includes("logo")) logoImages.byAttr = image;
        if (usable && !logoImages.byHomeLink && inHomeLink) logoImages.byHomeLink = image;
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
  // Constructed stylesheets (web components) are not in document.styleSheets.
  for (const sheet of document.adoptedStyleSheets ?? []) readSheet(sheet);
  const rootStyle = getComputedStyle(document.documentElement);
  const customProps = [...names]
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
