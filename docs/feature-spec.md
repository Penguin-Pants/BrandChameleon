# Feature Specification: BrandChameleon v0.1.0

Status: Draft for scope confirmation
Target format: [DESIGN.md spec, version `alpha`](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md)
Validator: `@google/design.md` 0.4.0 (npm)

---

## 1. Problem

Some tasks need the visual identity of a company. Examples are an interview deck, a prototype or a themed page. Today you must find the brand colors, fonts, corner shapes and logo by hand with browser dev tools. This is slow and gives inconsistent results.

AI design and coding agents (Claude, Stitch and others) can apply a brand when they get a DESIGN.md file. No tool makes that file from a live website.

## 2. Goals

- G1. One toolbar click scans the current page and proposes brand tokens.
- G2. You review and correct the proposal before you save it.
- G3. The saved file is a DESIGN.md that the official linter accepts with 0 errors.
- G4. The file name is `[company-slug]_design.md`.
- G5. The extension is ready for public listing on addons.mozilla.org (AMO), with minimum permissions and no data collection.

## 3. Non-goals

- No crawling. One page per scan.
- No html2pptx config, deck generation or other output formats.
- No dark-mode capture. The scan records only the theme that is rendered.
- No AI-written prose. No inferred brand personality.
- No logo image download. The file references a logo URL only.
- No Firefox for Android support.
- No live linting inside the extension.
- No AMO submission by the implementer. The owner submits.

## 4. Users and Use Cases

| User | Use case |
|---|---|
| Owner (job seeker) | Before an interview, scan the company website. Give the DESIGN.md to an AI agent to theme a deck or prototype. |
| Public AMO users (designers, developers, agent users) | Make a starting DESIGN.md for any website, then refine it. |

Primary scenario:

1. Open the company home page in Firefox desktop.
2. Click the BrandChameleon toolbar button.
3. The sidebar opens and shows the proposed name, colors, fonts, shapes, spacing, components and logo.
4. Correct wrong values. Remove groups you do not want.
5. Optionally edit the final markdown text.
6. Click Download. Firefox saves `acme-corp_design.md` in the default download folder and the sidebar closes.

## 5. Current Behavior

The repository contains only `README.md`. No extension code, tests, build or CI exist.

## 6. Required Behavior

### 6.1 Main workflow

1. You click the toolbar button.
2. The background script opens the sidebar in the current window. The call happens before any `await` in the click handler, because Firefox requires a user input handler for `sidebarAction.open()`.
3. The background script injects the collector script into the top frame of the active tab. The `activeTab` grant from the click permits this.
4. The sidebar shows the loading state.
5. The collector reads the page and returns scan data.
6. The analysis turns scan data into a proposed token model.
7. If the current review in this window has unsaved edits, the sidebar asks before it replaces them.
8. The sidebar shows the review form and the generated markdown.
9. You edit fields, the markdown or both.
10. You click Download. The browser saves the file and the sidebar closes (FR-48).

### 6.2 State model

- Each Firefox window has its own review. State keys include the window ID.
- State lives in `browser.storage.session`. It survives sidebar close and reopen. It is lost when Firefox quits.
- A review is "dirty" after any field or markdown edit. It becomes clean after a download starts or when a new scan loads.

### 6.3 Output file shape

```markdown
---
version: alpha
name: "Acme Corp"
description: "Light theme with violet (#635BFF) as the primary color."
omitted:                      # only when a group is missing or excluded
  - section: spacing
    reason: "No spacing scale defined"
colors: { ... }
typography: { ... }
rounded: { ... }
spacing: { ... }
components: { ... }
---

# Acme Corp

## Overview
## Colors
## Typography
## Layout
## Elevation & Depth
## Shapes
## Components
## Do's and Don'ts
## Brand Assets
```

A section is omitted when it has no data.

## 7. UX Requirements

### 7.1 Entry points

- Toolbar button (`action`). Title: "Scan page with BrandChameleon".
- Sidebar (`sidebar_action`). Title: "BrandChameleon". It does not open at install.

### 7.2 Sidebar states

| State | Content |
|---|---|
| Empty | "Click the BrandChameleon toolbar button to scan the current page." |
| Loading | "Scanning <hostname>..." with an indeterminate progress bar. Region has `aria-busy="true"`. |
| Error | Title, cause and next action. See section 9. Every error ends with "Click the toolbar button to scan again." |
| Review | Form sections in this order: Source, Name, Colors, Typography, Shapes, Spacing, Components, Logo, Markdown. A sticky footer holds the file name and the Download button. |

### 7.3 Dialogs

All dialogs are modal `<dialog>` elements. Focus moves to the safe button (Keep or Cancel) when a dialog opens. Focus returns to the control that opened it when it closes. Escape equals Cancel.

| Dialog | Text | Buttons |
|---|---|---|
| Replace | "Discard your edits for <hostname>?" | Replace, Keep |
| Regenerate | "Regenerating the markdown discards your text edits." | Continue, Cancel |
| Raw check | Lists failed checks (section 9, FR-47). | Download anyway, Cancel |

### 7.4 Controls and defaults

- Name: text input, prefilled by FR-30.
- File name preview: read-only text next to Download, updated on each name change.
- Color roles: per role one row with a swatch, a hex text input, a native color input and a select of detected candidates. Non-primary roles have a "None" option.
- Candidate palette: read-only list of up to 12 swatches. Each shows hex text and use count, so color is never the only cue.
- Typography: per level one row with an include checkbox, an editable font family input and read-only size, weight, line height and letter spacing.
- Group toggles: include checkboxes for Typography, Shapes, Spacing and Components. A toggle starts checked when its group has data. A group with no data shows "Not detected" and its toggle is disabled.
- Logo: radio list of candidates with a 32 px thumbnail, source label and URL. A "None" radio exists. The first candidate is selected.
- Markdown: monospace `<textarea>` with the full file. An "Edited" badge appears after a text edit.
- Download button: disabled when the name is empty or primary is empty. A text reason shows next to it.

### 7.5 Feedback

- A status line (`role="status"`) announces "Scan complete", "Download started" and validation messages.
- After Download, the sidebar closes. The Firefox Downloads toolbar button shows the saved file.
- Invalid hex input shows "Use #RGB, #RRGGBB or #RRGGBBAA." below the field and sets `aria-invalid="true"`.

### 7.6 Accessibility

- WCAG 2.2 AA for the sidebar UI.
- All controls work with the keyboard only. Tab order follows visual order.
- Every input has a visible label.
- Focus is always visible.
- The UI follows `prefers-color-scheme` for its own light and dark look.

### 7.7 Responsive behavior

- The sidebar works at widths from 280 px up. No horizontal scroll at 280 px.
- Long URLs and font stacks wrap or truncate with the full value in a `title` attribute.

## 8. Functional Requirements

### 8.1 Manifest and packaging

- **FR-01** `manifest.json` uses `manifest_version: 3`. It sets `name` to "BrandChameleon: DESIGN.md Generator", `version` to "0.1.0", `browser_specific_settings.gecko.id` to "brandchameleon@penguin-pants", `strict_min_version` to "140.0" and `data_collection_permissions.required` to `["none"]`. It has no `gecko_android` key. `sidebar_action.open_at_install` is `false`.
- **FR-02** `permissions` is exactly `["activeTab", "downloads", "scripting", "storage"]`. The manifest has no `host_permissions`, no `optional_permissions` and no `content_scripts`. The `downloads` permission is used only for `downloads.download()` in FR-48 (change request CR-1).
- **FR-03** The package contains no remote code, no `eval`, no `new Function` and no minified or bundled code. No build step changes source files.

### 8.2 Trigger and scan

- **FR-04** A toolbar click calls `sidebarAction.open()` first, then `scripting.executeScript` on the active tab's top frame.
- **FR-05** A sidebar opened without a scan shows the Empty state.
- **FR-06** When `document.readyState` is not `complete`, the collector waits for the `load` event for at most 5 s, then scans. The full scan times out after 15 s with the Timeout error.
- **FR-07** A second toolbar click in the same window during a scan starts a new scan. Only the result of the latest scan is used.
- **FR-08** Scan scope: the top-level document and open shadow roots. It skips iframes, closed shadow roots and hidden elements. Hidden means `display: none`, `visibility: hidden` or `collapse`, `opacity: 0` or a zero-size bounding box. Elements outside the viewport are included. The scan does not scroll, click or change the page.
- **FR-09** The scan skips the subtree of any element whose `id` or class token matches the overlay denylist in one file (`src/shared/overlay-denylist.js`). Matching is exact or prefix match on whole tokens, never substring. The initial list covers OneTrust, Cookiebot, TrustArc, Quantcast Choice, Didomi, Usercentrics, Osano, CookieYes, Termly, iubenda, Intercom, Drift, HubSpot chat, Crisp, tawk.to, LiveChat and Olark, plus the generic tokens `cookie-banner`, `cookie-consent` and `cookie-notice`.
- **FR-10** The scan processes at most 5,000 visible elements in DOM order and visits at most 50,000 nodes. When it reaches either limit, the sidebar Scan notes say "The page has more elements than the scan limit. Some elements were not read." (FR-42).
- **FR-11** The scan classifies elements:
  - Button: `button`, `input[type=button|submit|reset]`, `[role=button]`, an element with class token `btn` or `button` or an `a[href]` at most 64px tall with a visible border or a non-transparent background that differs from its parent's effective background (the first non-transparent background of an ancestor).
  - Card (tile): such a styled `a[href]` that is taller than 64px, with an area of at least 2,500 px². It is a clickable tile, not a button (CR-3).
  - Link: `a[href]` that is not a button or a tile.
  - Nav: `nav`, `header`, `[role=navigation]`, `[role=banner]`.
  - Heading: `h1` to `h6`.
  - Input: text-like `input`, `select`, `textarea`.
  - Card: not one of the above, area at least 2,500 px² and one of these: a non-transparent background that differs from its parent's, a visible border or a box shadow.
- **FR-12** For each element the scan records the computed values it needs: `color`, `background-color`, border top width, style and color, `border-top-left-radius`, the four paddings, `row-gap`, `column-gap`, `box-shadow`, `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, bounding box size, direct text length and, for SVG shapes inside Nav, `fill` and `stroke`. Direct text length is the sum of the trimmed lengths of the element's own child text nodes. Records inside an `a[href]` carry `inLink: true`. For a button-like element or a link with a transparent background, a visible `::before` or `::after` layer with a background color is its fill when its painted box covers at least 80% of the element's width and height. The painted box includes the layer's `position` offsets, `transform`, `translate` and `scale`. A layer is not a fill when its painted box is not known: it is not `position: absolute`, its containing block is not the element, or it is rotated, skewed, clipped (`clip-path`) or `visibility: hidden`. The layer's corner radius is used when the element has none (CR-4).
- **FR-13** Custom properties: the scan reads rules with selector `:root` or `html` from stylesheets it can read. It resolves each `--*` name with `getComputedStyle(document.documentElement)`. It keeps values that parse as colors. Stylesheets that throw on `cssRules` are skipped and counted.

### 8.3 Analysis

- **FR-14** Color parsing is pure JavaScript. It accepts hex (3, 4, 6, 8 digits), named colors, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` with `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz`, `xyz-d50` and `xyz-d65`. It converts to sRGB and clips to gamut. Unparseable values (for example `color-mix()`, `light-dark()`, system colors) are skipped. Colors with alpha 0 are skipped.
- **FR-15** Output color format is uppercase `#RRGGBB`. It is `#RRGGBBAA` when alpha is below 1.
- **FR-16** Clustering: sort exact colors by total weight, highest first, ties by first DOM occurrence. Put each color in the first cluster whose value is within OKLab distance 0.03. Else start a new cluster with that color as its value. So the cluster value is the exact color with the highest weight in the cluster.
- **FR-17** A cluster is neutral when its OKLCH chroma is below 0.04. Otherwise it is chromatic.
- **FR-18** Each color use adds a weight to its cluster. Weights live in one constants file.

  | Source | Weight | Interactive |
  |---|---|---|
  | Button background | 10 | yes |
  | Button border | 6 | yes |
  | Link text | 4 | yes |
  | Background with area of 25% of the viewport or more | 5 | no |
  | Nav background | 3 | no |
  | SVG fill or stroke inside Nav | 3 | no |
  | Heading text | 2 | no |
  | Button text | 2 | no |
  | Other background, text or border | 1 | no |

- **FR-19** `surface` is the computed background of `body`. If that is transparent, it is the background of `html`. If that is transparent, it is the non-transparent background with the largest area among elements at least 90% as wide as the viewport. If none exists, it is `#FFFFFF` and the sidebar Scan notes say "The page sets no background color. Surface is set to white, the browser default." (FR-42).
- **FR-20** `on-surface` is the text color cluster with the largest total direct text length.
- **FR-21** `primary`:
  1. If a chromatic cluster has an interactive weight above 0 and contains the resolved color of a custom property whose name contains `primary` or `brand`, that cluster is primary. If more than one cluster qualifies, the higher interactive weight wins.
  2. Else the chromatic cluster with the highest interactive weight is primary. Ties go to the higher total weight.
  3. Else the chromatic cluster with the highest total weight among clusters with Nav background or Nav SVG uses is primary (a colored header is brand evidence, CR-2).
  4. Else (monochrome) primary is the cluster with the highest Button background weight, excluding `surface`. Else the cluster with the highest Link text weight. Else the chromatic cluster with the highest total weight. Else primary is empty.
  5. When primary is neutral, the Overview says "The palette is monochrome." (FR-39).
  On an `a` element or on content inside one (FR-12 `inLink`), a text, border or icon fill color that is a browser default link color does not enter the palette, because unstyled links show it and their content inherits it (CR-2, CR-3). The defaults are `#0000EE` (Firefox and Chrome), `#00CADB` (Firefox on dark pages) and `#551A8B` (visited). This covers links styled as buttons or tiles and `currentColor` borders. A page whose only color is such link text gets an empty primary, and review asks you to choose one (FR-44).
- **FR-22** `on-primary` is the most common text color cluster on buttons whose background cluster is primary. It is absent when no such button exists.
- **FR-23** `secondary` is the chromatic cluster with the highest total weight that is at least OKLab distance 0.08 from primary and has at least 10% of primary's total weight. `tertiary` uses the same rule and is also at least 0.08 from secondary.
- **FR-24** `neutral` is the neutral cluster with the highest total weight that is at least OKLab distance 0.05 from `surface` and `on-surface`.
- **FR-25** `primary`, `secondary`, `tertiary` and `neutral` each use a different cluster. `primary` never uses the `surface` cluster. `secondary`, `tertiary` and `neutral` never use the `surface`, `on-surface` or `primary` cluster. `surface`, `on-surface` and `on-primary` are measured values and can share a cluster with other roles (for example white `surface` and white `on-primary`). The candidate palette holds the 12 clusters with the highest total weight, plus any cluster that fills a role.
- **FR-26** Typography levels. A style is the tuple of computed `font-family`, `font-size`, `font-weight`, `line-height` and `letter-spacing`. Each level uses the most common style among its source elements, ties by first DOM occurrence. A level with no source elements is not written. The written family is the first family of the stack, except when that is a browser-only name for the system font (`-apple-system`, `BlinkMacSystemFont` or `system-ui`): then it is the standard keyword `system-ui`, and the prose keeps the full stack (CR-3).

  | Level | Source |
  |---|---|
  | `headline-lg` | `h1` |
  | `headline-md` | `h2` |
  | `headline-sm` | `h3` |
  | `body-md` | style with the largest total direct text length among `p`, `li`, `td`, `dd`, `blockquote` |
  | `body-sm` | most common style with a font size smaller than `body-md`, used by 3 or more text elements that are not buttons, headings or inputs |
  | `label-md` | buttons with a primary background, else all buttons |

- **FR-27** Typography values:
  - `fontFamily`: the first family in the computed stack, quotes removed.
  - `fontSize`: px, max 2 decimals, trailing zeros removed.
  - `fontWeight`: number.
  - `lineHeight`: unitless ratio of line height to font size, 2 decimals. Omitted when computed value is `normal`.
  - `letterSpacing`: em, 3 decimals. Omitted when `normal` or 0.
- **FR-28** `rounded`: collect `border-top-left-radius` from Buttons, Inputs, Cards and `img`. A value is "full" when it is 9999 px or more, 50% or more or at least half the smaller box side. Other non-px values are ignored. Values keep at most 2 decimals. Take up to 4 distinct non-zero, non-full px values by use count. Sort them up. Name them by count: 1 value is `md`; 2 are `sm`, `md`; 3 are `sm`, `md`, `lg`; 4 are `sm`, `md`, `lg`, `xl`. Add `full: 9999px` when a full value occurs.
- **FR-29** `spacing`: collect paddings of Buttons, Inputs, Links inside Nav and Cards, plus `row-gap` and `column-gap` of flex and grid containers. Round to whole px. Ignore 0 and values above 256. Keep values used 2 or more times. Take the 6 most used. Sort them up. Name them by count: 1 is `md`; 2 are `sm`, `md`; 3 are `sm`, `md`, `lg`; 4 are `xs`, `sm`, `md`, `lg`; 5 are `xs` to `xl`; 6 are `xs` to `2xl`.
- **FR-30** Company name. Use the first non-empty value:
  1. `meta[property="og:site_name"]`
  2. `meta[name="application-name"]`
  3. A segment of `document.title`. Split on " | ", " - ", " · ", " • ", ": " and on the en dash (U+2013) and em dash (U+2014) with spaces. Compare only lowercase letters and digits. Take the first segment that contains the domain label. Else take the first segment that has 3 or more characters and is contained in the domain label. When the host has no domain label (IP address, empty host or `localhost`), take the first segment.
  4. The domain label with the first letter in uppercase.

  The domain label is the label directly before the top-level domain, after `www.` is removed. Example: `shop.acme.com` gives `acme`. For a known two-part suffix (`co.uk`, `com.au`, `co.jp`, `co.nz`, `com.br`, `co.in`, `co.za`), use the third-level label. For an IP address, empty host or `localhost`, the label is "site".
- **FR-31** File name: `<slug>_design.md`. Slug rules: Unicode NFKD, remove combining marks, lowercase, replace each run of characters outside `a-z0-9` with `-`, trim `-`, cut to 60 characters, trim `-` again. If the slug is empty, use the slug of the domain label. If that is empty, use `site`.
- **FR-32** Logo candidates, in this order, with duplicates removed by absolute URL:
  1. Visible `img` inside Nav whose `id`, class, `alt` or `src` contains "logo" (case-insensitive), else the first visible `img` inside an `a` in Nav whose `href` resolves to the page origin with path `/`.
  2. `link[rel~="apple-touch-icon"]`, largest `sizes` first.
  3. `link[rel~="icon"]`, largest `sizes` first, SVG counts as largest.
  4. `<origin>/favicon.ico`, labeled "Site favicon" and marked unverified. The sidebar shows "(not verified)" after its label; the file does not (CR-2).
  5. `meta[property="og:image"]`.

  Relative URLs become absolute. Only `http:` and `https:` URLs are kept. `data:` URLs and inline SVG are skipped. Known width and height are kept (from `sizes` or natural image size).

### 8.4 Output generation

- **FR-33** Front matter key order: `version`, `name`, `description`, `omitted`, `colors`, `typography`, `rounded`, `spacing`, `components`. Color order: `primary`, `secondary`, `tertiary`, `neutral`, `surface`, `on-surface`, `on-primary`. Typography order: the table order in FR-26. Property order: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`.
- **FR-34** All YAML string values are double-quoted with JSON-style escapes. `fontWeight` and `lineHeight` are bare numbers.
- **FR-35** `description` is "<Light|Dark> theme with <color name> (<primary hex>) as the primary color." The file names no tool, source URL or scan date (CR-2). Color names come from OKLCH lightness, chroma and hue (`colorName()` in `color.js`), for example "dark blue" or "near-black".
- **FR-36** `omitted` lists each of `typography`, `rounded`, `spacing` and `components` that is absent. The reason is "Not part of this design system" when the scan found values but the review excluded them. Else it is "No typography levels defined", "No rounded corners defined", "No spacing scale defined" or "No components defined".
- **FR-37** Components. Each is written only when its source elements exist and the Components group is included. A property is written only when it has a value. A button style is the tuple of background, text color, radius, paddings, height and typography style.
  - `page`: `backgroundColor` = surface, `textColor` = on-surface, `typography` = body-md.
  - `button-primary`: the most common style of buttons with a primary background. `backgroundColor`, `textColor`, `rounded`, `padding`, `height`, `typography` = label-md.
  - `button-secondary`: the most common style of other buttons. Same properties.
  - `link`: `textColor` of the most common link color.
  - `nav`: `backgroundColor` = most common Nav element background, `textColor` = most common link text color inside Nav.
- **FR-38** Component values:
  - A component color uses a role reference, for example `"{colors.primary}"`, when its source color is in the cluster that fills that role. The reference stays when you change the role's value in review. When the role is "None", the literal hex of the source color is used.
  - When the source cluster fills more than one role, the component's own role wins: `primary` and `on-primary` for `button-primary`, `surface` and `on-surface` for `page` and `nav`, `primary` for `link` text. Else the first role in FR-33 color order wins.
  - A component radius uses a `rounded` reference when its px value equals a written `rounded` token. Else it uses the literal value.
  - A component typography uses the reference of the level that was measured from the same elements.
  - A reference is never written to a token that does not exist in the file.
  - A transparent `backgroundColor` is not written.
  - `padding` is written only when all 4 sides are equal. Otherwise the Components prose states "<v>px vertical and <h>px horizontal padding" (or all 4 values if top and bottom or left and right differ).
  - `height` is whole px.
  - Only the 8 spec properties are used: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`. Borders appear only in prose.
- **FR-39** Markdown body. `# <name>`, then `##` sections in spec order, then `## Brand Assets` last. The body describes the design, not the scan: no tool name, source URL, scan date, usage counts or scan notes (CR-2; FR-42 shows scan notes in the sidebar). Prose comes only from these templates:
  - **Overview**: a factual look and feel from the written tokens, in this order, each part only when its tokens exist: "<Light|Dark> theme with <name> (<surface>) pages and <name> (<on-surface>) text." (dark when the relative luminance of surface is below 0.2). "The primary color is <name> (<hex>), with <name> (<hex>) [and <name> (<hex>)] as an accent|accents." (secondary and tertiary), or "The palette is monochrome. The primary color is <name> (<hex>)." "Headings use <family> and body text uses <family>." (or "Headings and body text use <family>."). "Corners are <px> on <kind> [, ...] and fully rounded on <kind>." (the most used element kind per `rounded` token; values that share a kind are joined, for example "Corners are 4px, 8px or fully rounded on buttons.").
  - **Colors**: one bullet per role: "**<Role> (<hex>):** <role description>. Used for <uses>." The role descriptions are "Main brand color", "Secondary brand color", "Tertiary brand color", "Neutral color", "Page background", "Main text color" and "Text color on primary backgrounds". Uses are the named use types of FR-18 (button backgrounds, button borders, link text, large background areas, navigation backgrounds, navigation icons, heading text, button text), sorted by weight, with no counts. "Used for" is left out when there is no named use, for a value set by hand and for on-primary.
  - **Typography**: one bullet per level: "**<level>:** <family>, <size>, weight <weight>. Used on `<tag>` [and `<tag>`] elements. Full stack: <stack>." It lists up to 3 source tags.
  - **Layout**: "Spacing scale for padding and gaps in buttons, inputs, navigation links, cards and layouts:" then "- **<name>:** <px>" per token.
  - **Elevation & Depth**: up to 3 most common distinct `box-shadow` values, each with the element kinds that use it (no counts). Omitted when none exist.
  - **Shapes**: "- **<name> (<px>):** Used on <kinds>." per `rounded` token, kinds from most to least used.
  - **Components**: one bullet per component with its values, borders and non-uniform padding.
  - **Do's and Don'ts**: from these rules only:
    - `button-primary` exists: "Do use primary (<hex>) for primary button backgrounds."
    - on-primary exists: WCAG contrast of on-primary on primary. At 4.5:1 or more: "Do pair on-primary text with primary backgrounds (<r>:1, passes WCAG AA)." Below: "Don't use on-primary text on primary backgrounds for normal-size text (<r>:1, below the WCAG AA minimum of 4.5:1)."
    - The same rule for on-surface on surface.
    - Primary on surface below 4.5:1: "Don't use primary for body text on surface (<r>:1, below 4.5:1)."
    - Headline and body families both exist: "Do set headlines in <family> and body text in <family>."
    - button-primary has a rounded reference: "Do use <token> (<value>) corners on buttons."
  - **Brand Assets**: "- **Logo:** <url> (<source label>[, <w> x <h> px])". Omitted when the logo is "None".
- **FR-40** Page-derived text is sanitized before output and display. Control characters and newlines are removed. The name is at most 100 characters. Font family names keep only Unicode letters, digits, spaces and `-_.'` and are at most 64 characters. URLs are written only when they parse as `http:` or `https:`.
- **FR-41** Output is deterministic. The same scan data, edits and clock give byte-identical output.

### 8.5 Review UI

- **FR-42** The Source block shows the hostname, the full URL in a `title` attribute and the scan time. Under "Scan notes" it lists, when they apply: "The page has more elements than the scan limit. Some elements were not read." (FR-10), "<n> stylesheet(s) from other sites could not be read. Its|Their custom property names are not used." (FR-13) and "The page sets no background color. Surface is set to white, the browser default." (FR-19). These notes are not in the file (CR-2).
- **FR-43** Editing the name updates the file name preview and the markdown. An empty name disables Download with "Enter a name."
- **FR-44** A color role accepts a candidate or a valid hex. Invalid hex does not change the model. Primary cannot be "None". Empty primary disables Download with "Choose a primary color."
- **FR-45** Unchecking a typography level removes it. Editing a font family changes only that level. Unchecking a group removes its tokens and section, adds it to `omitted` with "Not part of this design system" and changes affected component references to literal values. A typography reference with no literal form is removed.
- **FR-46** Changing any field regenerates the markdown. If the markdown has text edits, the Regenerate dialog shows first. Cancel keeps the text and restores the field's previous value.
- **FR-47** Download runs basic checks on the markdown text: the first line is `---`, a closing `---` line exists and a `name:` line with a non-empty value exists in the front matter. On failure, the Raw check dialog lists the failures. "Download anyway" continues.
- **FR-48** Download (or "Download anyway" in the Raw check dialog) does these steps in the sidebar, in this order, synchronously inside the click handler:
  1. Mark the review clean and set the status to "Download started".
  2. Make one `storage.session.set()` call with the clean review and a download request at `download:<windowId>`: `{ requestId, filename, text }`. `requestId` is a new random UUID, `filename` is the FR-31 name and `text` is the markdown text.
  3. Call `browser.sidebarAction.close()`.
  The background script listens to `storage.onChanged`. For each new `download:*` value in the session area, it creates a `Blob` of the text (type `text/markdown;charset=utf-8`) and a `blob:` URL in its own page. It calls `browser.downloads.download()` with that URL, the file name, `conflictAction: "uniquify"` and `saveAs: false`. Then it removes the request key. It revokes the URL after 60 s.
  Cancel in the Raw check dialog keeps the sidebar open and saves nothing. Name conflicts get Firefox's unique name, for example `acme_design(1).md`. The file always goes to the default download folder with no Save dialog (change request CR-1).
- **FR-49** A new scan result for a window with a dirty review shows the Replace dialog. Keep discards the new result. Replace loads it. A clean review is replaced without a dialog.
- **FR-50** Reopening the sidebar restores the review, including text edits and the dirty flag. If the stored scan status stays "scanning" for more than 20 s, the sidebar shows the Timeout error.
- **FR-51** The UI inserts page-derived text only with `textContent` or attribute setters. It never uses `innerHTML` or `insertAdjacentHTML` with page data. Logo thumbnails use only `http:` or `https:` URLs and set `referrerpolicy="no-referrer"`.

### 8.6 Non-functional

- **FR-52** Privacy: the extension sends no network requests of its own. The only requests are logo thumbnails that the sidebar loads from URLs found on the scanned page. No telemetry or analytics.
- **FR-53** Performance: scan plus analysis finishes in under 3 s for the 5,000-element fixture in the Chromium test environment. Stored review state is under 1 MB for that fixture.
- **FR-54** Logging: errors go to the console with the prefix `[BrandChameleon]`. No other logging.

### 8.7 Assets and release

- **FR-55** npm scripts: `test` (all automated tests), `lint` (`web-ext lint` gate per AC-01 plus `eslint`), `build` (`web-ext build` to a zip of `src/` only), `assets` (renders PNG icons and screenshots).
- **FR-56** Icons: an original SVG (chameleon and swatch motif) plus PNG at 48, 96 and 128 px.
- **FR-57** AMO listing folder `amo/` with: summary (250 characters or fewer), description, 3 screenshots at 1280 x 800 rendered from the sidebar UI with fixture data and submission notes (desktop only, MIT license, no data collection).
- **FR-58** `PRIVACY.md`, `LICENSE` (MIT) and an updated `README.md`.
- **FR-59** `docs/manual-firefox-checklist.md` for the owner to run in Firefox before AMO submission.
- **FR-60** A GitHub Actions workflow runs `npm ci`, `npm run lint` and `npm test` on pull requests.

## 9. Edge Cases and Failure Modes

| Case | Required behavior |
|---|---|
| Restricted page (`about:`, AMO, `view-source:`, reader view, PDF viewer) or injection rejects | Error: "BrandChameleon cannot scan this page. Firefox blocks extensions on some pages, for example about: pages and addons.mozilla.org." |
| Tab closes or navigates during scan | Error: "The page changed during the scan. Click the toolbar button to try again." |
| Scan exceeds 15 s | Error: "The scan took too long. Reload the page and try again." |
| Page has no visible elements | Error: "No visible content found on this page." |
| No colors on buttons or links | Monochrome rule, FR-21. |
| No color at all | Primary empty. Download disabled until you set it. |
| No `h1`, `h2` or `h3` | Those levels are not written. |
| No typography source at all | `typography` in `omitted` with "No typography levels defined". |
| Cross-origin stylesheets | Skipped, counted and reported in the sidebar Scan notes (FR-42), not in the file. |
| Framework variables not used (for example Bootstrap `--bs-primary`) | Ignored for primary, because the name hint needs interactive use. |
| Cookie banner or chat widget | Skipped by FR-09. |
| Sidebar opened from the Firefox menu | Empty state. |
| Second click during scan | Latest scan wins. |
| New scan with dirty review | Replace dialog. |
| Name has quotes, colons or newlines | Sanitized and quoted. YAML stays valid. |
| Non-Latin name | Slug falls back to the domain label. |
| Same file name exists | Firefox renames, for example `acme_design(1).md`. |
| Firefox set to ask where to save files | No Save dialog. The file goes to the default download folder (FR-48). |
| Download fails, for example a full disk | Firefox shows the failure in its Downloads panel. The sidebar is already closed. |
| Two windows | Each has its own review. |
| Page uses `oklch()` or `color()` colors | Parsed and converted to sRGB hex. |
| Colors with alpha | Written as `#RRGGBBAA`. |
| URL with query or fragment | Stripped in the file. |
| Only inline SVG logo | Next candidate used. If none remain, Logo is "None". |

## 10. Technical Constraints

Confirmed from sources:

- Firefox desktop supports built-in data consent from version 140. New AMO extensions must declare `data_collection_permissions` since 2025-11-03 ([Extension Workshop](https://github.com/mozilla/extension-workshop/blob/master/src/content/documentation/develop/firefox-builtin-data-consent.md)).
- The DESIGN.md spec is `alpha`. `padding` is typed as one Dimension. Unknown sections are preserved. Unknown component properties cause warnings. Broken references are errors.
- `@google/design.md` 0.4.0 reports `transparent` as `#00000000` in contrast checks. This causes false contrast warnings (verified locally).
- A trailing `## Brand Assets` section and an `omitted` entry produce no lint warnings (verified locally).
- `browserSettings.overrideContentColorScheme` is global to all tabs. No per-tab color-scheme emulation exists for extensions (MDN).
- MV3 extension pages have a default CSP that blocks inline scripts.
- Firefox accepts `sidebarAction.close()` only while the page handles a user input event (`requireUserInput` in `sidebar_action.json`; `UserActivation::IsHandlingUserInput()` is `sUserInputEventDepth > 0`). After a real `await`, the call is rejected.
- Closing the sidebar replaces its page with `about:blank` (`SidebarController.hide()` in `browser-sidebar.js`). An `<a download>` click starts its load in a later task (`OnLinkClickEvent` in `nsDocShell.cpp`), so a close in the same click would very likely cancel that download.
- `downloads.download()` runs in the parent process and does not stop when the calling page unloads (`ext-downloads.js`, `ExtensionParent.sys.mjs`). With `saveAs: true`, the file picker needs the calling page's browsing context, which a closed sidebar no longer has.
- A page's `blob:` URLs are revoked when the page unloads. The 5 s keep-alive (`RELEASING_TIMER`) does not help new loads: `GetDataInfo()` returns nothing for a revoked URL unless the caller passes `aAlsoIfRevoked` (`BlobURLProtocolHandler.cpp`). So a download of a `blob:` URL from the closing sidebar fails. The owner's Firefox test confirmed this (CR-1, fix 1).
- `downloads.download()` rejects `data:` URLs: its `url` format check uses `DISALLOW_INHERIT_PRINCIPAL`, and `data:` has `URI_INHERITS_SECURITY_CONTEXT` (`Schemas.sys.mjs`, `ExtensionCommon.sys.mjs`, `netwerk/build/components.conf`).
- `storage.onChanged` is a persistent event, so it wakes a suspended event page (`PERSISTENT_EVENTS` in `ext-storage.js`). A `runtime.sendMessage()` from a closing page is not safe: the parent reads the sender's browsing context after it wakes the background (`ProxyMessenger.getSender()`).
- Sources for the items above: Firefox `main` branch on GitHub (`mozilla-firefox/firefox`), read on 2026-09-24.
- Firefox MV3 background uses `background.scripts` (event page).
- This build environment has no Firefox. Mozilla download hosts are blocked by network policy. Chromium is available through Playwright.
- The repository has no existing code or conventions.

## 11. Acceptance Criteria

Fixture pages live in `tests/fixtures/pages/`.

- **AC-01** `web-ext lint` reports 0 errors. The only allowed warning is `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` (decided during implementation: keep Firefox ESR 140 support and desktop only). `npm run lint:ext` enforces this.
- **AC-02** The manifest matches FR-01 and FR-02 exactly (automated test).
- **AC-03** A test with a mocked `browser` API shows the click handler calls `sidebarAction.open()` before its first `await`, then `executeScript` with the tab ID.
- **AC-04** The sidebar with no stored scan shows the Empty state text.
- **AC-05** A rejected `executeScript` shows the restricted-page error text.
- **AC-06** Fixture `brand-basic`: primary `#635BFF`, secondary `#00D4FF`, surface `#FFFFFF`, on-surface `#1A1F36`, on-primary `#FFFFFF`, neutral `#E3E8EE`.
- **AC-07** Fixture `framework-leftover` (`--bs-primary: #0D6EFD` unused, buttons `#E4002B`): primary `#E4002B`.
- **AC-08** Fixture `mono` (black buttons, no saturated color): primary `#000000`. The Overview says "The palette is monochrome." (FR-39).
- **AC-09** Fixture `overlay`: no color that exists only in the OneTrust banner appears in the candidates.
- **AC-10** Fixture `hidden`: no color that exists only on hidden elements appears in the candidates.
- **AC-11** Fixture `shadow`: colors in an open shadow root are counted. Colors only in a closed shadow root are not.
- **AC-12** Fixture `cross-origin`: the scan completes with no error. The Scan notes (FR-42) say 1 stylesheet could not be read, and the file does not.
- **AC-13** Fixture `brand-basic` typography equals the expected table in the test (for example `headline-lg`: Inter, 48px, 700, 1.1, -0.02em). Fixture `sparse` has no headline levels.
- **AC-14** Fixture `brand-basic`: `rounded` is `sm: 4px`, `md: 8px` and `full: 9999px`. `spacing` equals the expected scale in the test.
- **AC-15** Fixture `brand-basic`: `button-primary` has references to primary, on-primary, `rounded.md` and `label-md`. It has no `padding` key. The Components prose has "12px vertical and 24px horizontal padding". `button-secondary` has no `backgroundColor`.
- **AC-16** The official linter reports 0 errors for the output of every fixture and for all 16 on/off combinations of the four group toggles on `brand-basic`.
- **AC-17** Sections appear in spec order. `## Brand Assets` is last. Sections with no data are absent.
- **AC-18** Name detection passes a table test that covers each FR-30 step, a `co.uk` host, an IP host and `localhost`.
- **AC-19** Slug table: "Acme Corp, Inc." gives `acme-corp-inc_design.md`. "Café Déjà Vu" gives `cafe-deja-vu_design.md`. A Japanese-only name on `example.co.jp` gives `example_design.md`. A 90-character name gives a slug of 60 characters or fewer with no trailing `-`.
- **AC-20** Logo candidates follow FR-32 order. `data:` and inline SVG are skipped. Relative URLs are absolute. Duplicates are removed.
- **AC-21** UI: a name edit updates the preview. An empty name disables Download with its reason.
- **AC-22** UI: choosing a candidate or a valid hex updates the markdown. Invalid hex shows the error and does not change the markdown.
- **AC-23** UI: unchecking a group removes its section, adds the `omitted` reason "Not part of this design system" and leaves no broken reference (linter 0 errors).
- **AC-24** UI: after a text edit, a field change opens the Regenerate dialog. Cancel keeps the text and restores the field. Continue regenerates.
- **AC-25** UI: Download writes a request at `download:<windowId>` with the FR-31 name, the textarea text and a new `requestId`, in the same storage call as the clean review. Background (unit test): a new request calls `downloads.download()` with a `blob:` URL made in the background whose content equals the text, the file name, `conflictAction: "uniquify"` and `saveAs: false`, then removes the request and revokes the URL after 60 s.
- **AC-26** UI: text without front matter opens the Raw check dialog. "Download anyway" downloads.
- **AC-27** UI: a new scan with a dirty review opens the Replace dialog. Keep retains the old review. Replace loads the new one. A clean review is replaced with no dialog.
- **AC-28** UI: reloading the sidebar page restores the review, text edits and dirty flag.
- **AC-29** UI: two window IDs keep separate reviews.
- **AC-30** axe-core reports no serious or critical violations in the Empty, Loading, Error and Review states and in each dialog. Keyboard-only tests reach every control. Dialog focus moves in and returns.
- **AC-31** At 280 px width, no state has horizontal scroll.
- **AC-32** Fixture `large` (5,000+ elements): scan plus analysis under 3 s. Stored state under 1 MB.
- **AC-33** Static test: source has no `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `new Function`, `innerHTML` or `insertAdjacentHTML`.
- **AC-34** A title of `Evil"\nname: x` gives YAML that parses with exactly one `name` key. Font families with markdown or control characters are sanitized. The file does not contain the scanned URL, its query or its fragment.
- **AC-35** Same input and fixed clock give byte-identical output.
- **AC-36** `npm run build` makes a zip in `web-ext-artifacts/`. It contains `manifest.json` and no `tests/` or `node_modules/`.
- **AC-37** PNG icons are exactly 48, 96 and 128 px. Screenshots are exactly 1280 x 800. The summary is 250 characters or fewer. `PRIVACY.md` and an MIT `LICENSE` exist.
- **AC-38** `README.md` covers install, use, development, tests, build and AMO submission. The manual checklist exists.
- **AC-39** The CI workflow runs lint and tests on pull requests.
- **AC-40** The owner runs the manual Firefox checklist and all items pass. This cannot run in the build environment.
- **AC-42** The file has no tool name, version, scan date, source URL, usage counts or scan notes. The description and Overview follow FR-35 and FR-39. The sidebar shows the FR-42 scan notes and "(not verified)" on the favicon guess (unit and sidebar tests, brand-basic snapshot).
- **AC-43** A page whose only colored link text is the browser default `#0000EE` and whose header background is `#003B95` gets primary `#003B95`, and `#0000EE` is in no role and not in the palette (FR-21, unit test).
- **AC-44** Links styled as buttons in the default blue, including a `currentColor` border, add no color. Text and icons inside a link that inherit the default blue add no color either (unit test and `classify` fixture). A 110px filled link is a card, and a bordered link in the default blue reports `rgb(0, 0, 238)` in the browser (`classify` fixture). A system font stack is written as `system-ui` (unit test). Corner values on the same kind are grouped in the Overview (unit test).
- **AC-45** A transparent `button` with a covering `::before` fill is a button with that fill, its corners and its height. A small decorative layer is not a fill. A link with a covering fill layer is a button, also when the layer is scaled to 96%. A layer that is scaled to 0, translated or placed off the element, clipped, rotated, or placed by an ancestor is not a fill (`classify` fixture).
- **AC-41** UI: Download (mouse or keyboard) and "Download anyway" make the storage call of FR-48, then call `sidebarAction.close()` while the click is still handled. The test mock rejects `close()` outside user input, like Firefox. Cancel in the Raw check dialog makes neither call.

## 12. Testing Requirements

| Level | Tool | Scope |
|---|---|---|
| Unit | `node:test` | Color parsing and conversion, contrast, clustering, roles, typography, rounded, spacing, components, name, slug, logo order, YAML and markdown generation, sanitizing, determinism |
| Integration | `@google/design.md` linter API | AC-16, AC-23 |
| Browser | Playwright with Chromium | Collector on fixture pages, sidebar UI with a mocked `browser` API, performance |
| Accessibility | `@axe-core/playwright` | AC-30 |
| Static | `web-ext lint`, `eslint`, source scan test | AC-01, AC-33 |
| Regression | Snapshot of full output for `brand-basic` | Detects unintended output changes |
| Manual | `docs/manual-firefox-checklist.md` | Real Firefox behavior: sidebar open, activeTab scan, download, restricted pages, install prompt |

## 13. Documentation Requirements

- `README.md`: purpose, install (temporary and from AMO), use, output example, limits, development, tests, build, AMO submission steps.
- `PRIVACY.md`: no data collection, local processing, logo thumbnail requests to the scanned site.
- `LICENSE`: MIT.
- `amo/`: listing text and assets.
- `docs/manual-firefox-checklist.md`.
- This specification.

## 14. Deferred Items

| Item | Notes from discovery |
|---|---|
| html2pptx theme config and deck generation | Needs the html2pptx schema. |
| Dark-mode capture | Use `dark-` prefix names (`dark-surface`, `dark-primary`). Global override method needs the `browserSettings` permission. |
| Live linting in the sidebar | Needs a bundler and AMO source upload. |
| Silent overwrite of existing files | Possible since CR-1 with `conflictAction: "overwrite"`. The owner chose auto-rename. |
| Logo image download or embedding | |
| LLM-written prose | Needs an API key and sends data to a third party. |
| TODO markers in prose | |
| Interpolated typography levels | |
| Headline fallback for pages that use styled `div` headings | |
| Editing individual rounded, spacing and component values in the UI | |
| Per-site draft storage | |
| Element picker to exclude parts of the page | |
| Same-origin iframes and closed shadow roots | |
| Firefox for Android | |
| Localization | English only in v0.1.0. |
| Keyboard shortcut for scan | |
| Firefox end-to-end tests | Needs Mozilla hosts on the network allowlist. |

## 15. Open Questions

None.

---

## Appendix A: Specification Review

### Confirmed issues (fixed in this version)

| # | Issue | Fix |
|---|---|---|
| 1 | Nav links with an explicit background equal to their parent's were classified as buttons. | FR-11 compares with the parent's effective background. |
| 2 | Greedy clustering was order-dependent, so output could change between runs. | FR-16 defines sort order and ties. FR-41 requires byte-identical output. |
| 3 | SPA pages with a transparent `body` got a wrong white surface. | FR-19 adds the full-width wrapper step. |
| 4 | Title matching could match 1-letter segments or "site" inside "Website". | FR-30 needs 3+ characters and handles hosts with no domain label. |
| 5 | Component references could point to the wrong role after a review edit. | FR-38 binds references to the role's source cluster. |
| 6 | `nav` component source was ambiguous. | FR-37 names the source of each value. |
| 7 | "Style" was undefined for typography and buttons. | FR-26 and FR-37 define the tuples. |
| 8 | Denylist substring match (for example "cookie") could hide a bakery's brand content. | FR-09 uses whole-token exact or prefix match. |
| 9 | Dialogs put default focus on the destructive button. | Section 7.3 focuses Keep or Cancel. |
| 10 | Sidebar could stay in Loading forever if the background script unloads. | FR-50 adds a 20 s sidebar timeout. |
| 11 | Huge DOMs could stall the scan while it skips hidden nodes. | FR-10 caps visited nodes at 50,000. |
| 12 | Page text reaches an AI agent (prompt injection risk) and the sidebar DOM (XSS risk). | FR-40 sanitizes. FR-51 bans `innerHTML` with page data. The review step shows all text before download. |

| 13 | FR-25 made white `surface` and white `on-primary` impossible, which conflicts with AC-06. Found in plan review. | FR-25 lets measured roles share clusters. |
| 14 | FR-38 made button text reference `surface` in place of `on-primary`, which conflicts with AC-15. Found in plan review. | FR-38 prefers the component's own role. |

### Possible risks (not proven, watch during implementation)

| # | Risk | Mitigation |
|---|---|---|
| R1 | The CR-1 handoff (sidebar to background through `storage.session`) is verified by Firefox source reading, Chromium mocks and Node tests, not in real Firefox. | Manual checklist section "Download and close", including a download after the background has slept. |
| R2 | Firefox and Chromium serialize some computed values differently (modern colors, font-family quotes). | Parser accepts both forms. Manual checklist covers a real site. |
| R3 | Role heuristics are tuned on fixtures, not real sites. | The review step lets you correct roles. Weights live in one file. |
| R4 | The DESIGN.md spec is `alpha`. New linter versions may add rules. | Linter pinned to 0.4.0 in tests. |
| R5 | The sidebar closes before Firefox reports the download result. A failed download shows only in the Firefox Downloads panel. | FR-48 uses a fixed, sanitized file name and no Save dialog, so failures need a disk or profile problem. |
| R6 | Logo thumbnails load images in the sidebar. AMO reviewers may ask. | Disclosed in `PRIVACY.md` and AMO notes. |
| R7 | Performance is measured in Chromium only. | Manual checklist includes a large real page. |

### Scope added by the implementer (needs your approval)

- FR-60 GitHub Actions CI workflow.
- ESLint in `npm run lint` (FR-55).
- Output snapshot regression test.

## Appendix B: Change Requests

### CR-1: Close the sidebar after Download (2026-09-24)

- **Request (owner):** after you click Download, the file saves and the sidebar closes, because it is no longer needed.
- **Problem found:** with the v0.1.0 `<a download>` method, a close in the same click would very likely cancel the download (section 10). Firefox allows `sidebarAction.close()` only during the click, so the close cannot wait for the download.
- **Owner decisions:**
  - Add the `downloads` permission, so Firefox saves the file in the parent process. The install prompt now lists "Download files and read and modify the browser’s download history".
  - Keep auto-rename on name conflicts (`conflictAction: "uniquify"`).
- **Changed:** FR-02, FR-48, section 7.5, section 9, section 10, AC-25, new AC-41, deferred item "Silent overwrite", risks R1 and R5, `PRIVACY.md`, `amo/listing.md`, `README.md` and the manual checklist.
- **Side effect:** Firefox's "ask where to save files" setting no longer shows a Save dialog for this file (FR-48).
- **Fix 1 (owner test, 2026-09-24):** the sidebar closed, but every download failed. Cause: the sidebar made the `blob:` URL, and closing the sidebar revoked it before Firefox read it (section 10). My earlier reading of the 5 s keep-alive was wrong. Now the sidebar hands the text to the background script through `storage.session`, and the background makes the URL and calls `downloads.download()` (FR-48).

### CR-2: A clean DESIGN.md without scan details (2026-09-24)

- **Request (owner):** the file must read as a standard DESIGN.md. It must not say that the add-on extracted it.
- **Explained first:** the YAML block is the spec's machine-readable token layer, and the body is the human-readable layer. Both stay. The scan details (tool, URL, date, counts, notes) helped a reviewer trace each value. They do not help an agent that makes HTML or slides.
- **Owner decisions:**
  - Remove the tool name, version, source URL, scan date, usage counts and scan notes from the file. Keep where each value is used and the full font stack.
  - Write a factual look-and-feel Overview and description.
  - Show the scan notes and the unverified favicon in the sidebar.
  - Fix primary: the browser default link blue (`#0000EE`) was chosen for Booking.com over its dark-blue header (`#003B95`).
- **Implementer additions:**
  - Ignoring the default blue alone made primary the near-black link color. FR-21 step 3 (colored header or navigation) gives the expected `#003B95`.
  - As an "other" use, the default blue then became tertiary. Link text in a default link color now stays out of the palette.
- **Changed:** FR-10, FR-19, FR-21, FR-32, FR-35, FR-36, FR-39, FR-42, section 9, AC-08, AC-12, AC-34, new AC-42 and AC-43. Custom property names ("Declared as `--brand-primary`") are no longer in the Colors prose. They still help choose primary (FR-21 step 1).

### CR-3: Fixes from the owner's second Booking.com check (2026-09-24)

- **Owner check:** the new file was valid (0 lint errors), and download and close worked. Review of the values found 4 problems. The owner approved all 4 fixes:
  1. Secondary was `#0000EE`. Links styled as buttons kept the default blue, and the CR-2 rule covered plain links only. Now every `a` element is covered, text and border (FR-21).
  2. The Overview said "4px on buttons, 8px on buttons and fully rounded on buttons". Values that share a kind are now joined (FR-39).
  3. `button-primary` was 110px tall: a large filled link (tile) counted as a button. Styled links taller than 64px are now cards (FR-11).
  4. Body fonts were written as "BlinkMacSystemFont", which works only in Chrome and Safari on macOS. System font stacks are now written as `system-ui` (FR-26).
- **Fix 1b (owner's third file, 2026-09-24):** secondary was still `#0000EE`, with no named use. Cause: text inside a link (for example a `div` or `span` in an `a`) inherits the default blue, and fix 1 covered the `a` element only. The collector now marks link content `inLink`, and the rule covers its text, borders and nav icon fills (FR-12, FR-21). Reproduced in Chromium before the fix.
- **Implementer addition:** Firefox's default link color on dark pages (`#00CADB`, pref `browser.anchor_color.dark`) is also excluded. Source: `StaticPrefList.yaml` in Firefox `main`, read on 2026-09-24.
- **Changed:** FR-11, FR-21, FR-26, FR-39 and new AC-44.

### CR-4: Fill layers on buttons (2026-09-24)

- **Owner check:** the fourth Booking.com file had no `button-primary`, but the page shows a filled blue Search button. The sidebar showed only the stylesheet note, so the element limit was not the cause.
- **Evidence (owner's Firefox console):** the `button` background is `rgba(0, 0, 0, 0)`. Its `::before` has background `rgb(0, 108, 228)` and `position: absolute`. The scan read only the element's own background.
- **Fix:** FR-12 now reads a covering `::before` or `::after` fill on button-like elements and links with a transparent background, including its corner radius. Coverage uses the layer's painted box after offsets and transforms, so a hover effect such as `transform: scaleX(0)` does not add a fill. Other elements are not changed, so decorative layers on cards and sections do not change surface or card detection.
- **Expected effect on booking.com:** primary `#006CE4` gets button backgrounds, `button-primary` and `on-primary` (white, 4.92:1) are written, and the Do's and Don'ts gain the primary button rules.
- **Changed:** FR-12 and new AC-45.
