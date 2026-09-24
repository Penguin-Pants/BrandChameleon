# BrandChameleon

Firefox extension that scans a website's styles and downloads a [DESIGN.md](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md) file with its brand colors, fonts, shapes, spacing, components and logo URL.

AI design and coding agents read DESIGN.md to apply a brand. BrandChameleon proposes the values; you review and correct them before you save.

## Install

- **From AMO:** search for "BrandChameleon: DESIGN.md Generator" on addons.mozilla.org (after the listing is live).
- **Temporary (development):**
  1. Open `about:debugging#/runtime/this-firefox`.
  2. Click **Load Temporary Add-on**.
  3. Select `src/manifest.json`.

  Firefox removes a temporary add-on when it restarts.

Requires Firefox desktop 140 or later. Firefox for Android is not supported.

## Use

1. Open a website.
2. Click the BrandChameleon toolbar button. The sidebar opens and scans the page.
3. Review the proposal:
   - **Name:** used for the `name` field and the file name.
   - **Colors:** pick a detected color, type a hex value or use the color picker for each role.
   - **Typography, Shapes, Spacing, Components:** include or exclude each group. Edit font families.
   - **Logo:** choose a candidate URL or None.
   - **Markdown:** edit the final text if you like.
4. Click **Download**. Firefox saves `<company-slug>_design.md` to your download folder and the sidebar closes.

### Output example

```markdown
---
version: alpha
name: "Acme Corp"
description: "Light theme with violet (#635BFF) as the primary color."
colors:
  primary: "#635BFF"
  secondary: "#00D4FF"
  surface: "#FFFFFF"
  on-surface: "#1A1F36"
  on-primary: "#FFFFFF"
typography:
  headline-lg:
    fontFamily: "Inter"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
---

# Acme Corp

## Overview

Light theme with white (#FFFFFF) pages and dark grayish blue (#1A1F36) text. The primary color is violet (#635BFF), with cyan (#00D4FF) as an accent. Headings and body text use Inter.

## Colors

- **Primary (#635BFF):** Main brand color. Used for button backgrounds, link text, button borders and button text.
...
## Brand Assets

- **Logo:** https://acme.example/logo.svg (Header logo, 120 x 32 px)
```

The full example is in [`tests/snapshots/brand-basic.md`](tests/snapshots/brand-basic.md).

### Limits

- One page per scan. No crawling.
- Captures only the theme that is rendered (light or dark), not both.
- Reads the top-level page and open shadow roots. Skips iframes and closed shadow roots.
- Cannot read stylesheets from other domains, so their custom property names are not used. Their computed colors still count.
- Skips common cookie banners and chat widgets (list in `src/shared/overlay-denylist.js`).
- Prose is factual. It does not describe brand personality.

## Privacy

No data collection. See [PRIVACY.md](PRIVACY.md).

## How it works

| Step | File |
|---|---|
| Toolbar click opens the sidebar and injects the collector | `src/background/background.js` |
| Collector reads computed styles of visible elements | `src/collector/collect-page.js` |
| Colors are parsed, clustered in OKLab and assigned to roles | `src/shared/color.js`, `src/shared/analyze.js` |
| DESIGN.md text is generated from the model and your edits | `src/shared/generate.js` |
| Review sidebar | `src/sidebar/` |

Weights and thresholds live in `src/shared/constants.js`. The full specification is [docs/feature-spec.md](docs/feature-spec.md).

## Development

Requirements: Node.js 20 or later.

```bash
npm ci
npx playwright install chromium   # once, for browser tests
npm run lint                      # web-ext lint gate + ESLint
npm test                          # unit tests (node:test) + browser tests (Playwright, Chromium)
npm start                         # run in Firefox with web-ext
```

- Unit tests: `tests/unit/`.
- Browser tests run the real collector on fixture pages in `tests/fixtures/pages/` and lint every output with the official `@google/design.md` linter.
- The sidebar tests use a mocked `browser` API (`tests/support/mock-browser.js`).
- Update the output snapshot after an intended change: `npx playwright test --update-snapshots`.

Automated tests run in Chromium. Before each release, run [docs/manual-firefox-checklist.md](docs/manual-firefox-checklist.md) in Firefox.

## Build and release

```bash
npm run build     # web-ext-artifacts/brandchameleon_design.md_generator-<version>.zip
npm run assets    # re-render PNG icons and AMO screenshots
```

AMO submission:

1. Run `npm run lint`, `npm test` and the manual checklist.
2. Run `npm run build`.
3. Upload the zip on addons.mozilla.org. Select Firefox desktop only.
4. Follow the answer sheet in [amo/listing.md](amo/listing.md). It gives every AMO form value in form order, the screenshots, the icon and the AMO version of the privacy policy ([amo/privacy-policy.md](amo/privacy-policy.md)).

`web-ext lint` reports one expected warning, `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`, because the extension supports Firefox ESR 140 on desktop only.

## License

MIT. See [LICENSE](LICENSE).
