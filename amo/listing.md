# AMO Listing: BrandChameleon: DESIGN.md Generator

Use this text when you create the listing on addons.mozilla.org.

## Name

BrandChameleon: DESIGN.md Generator

## Summary (250 characters or fewer)

Scan any website and download a DESIGN.md file with its brand colors, fonts, corner shapes, spacing and logo URL. Review and edit every value before you save. No data collection.

## Description

BrandChameleon turns the look of a website into a DESIGN.md file. DESIGN.md is an open format that AI design and coding agents read to apply a brand.

**How it works**

1. Open a website and click the BrandChameleon toolbar button.
2. The sidebar shows the proposed name, colors, typography, shapes, spacing, components and logo.
3. Correct any value. Remove groups you do not want. Edit the final text if you like.
4. Click Download. Firefox saves `company-name_design.md` and the sidebar closes.

**What you get**

- Color roles: primary, secondary, tertiary, neutral, surface, on-surface and on-primary.
- Typography levels measured from real headings, body text and buttons.
- Corner radius and spacing scales.
- Button, link, navigation and page components with token references.
- Factual prose, WCAG contrast notes and the logo URL.
- A file that the official DESIGN.md linter accepts with 0 errors.

**Privacy**

- No data collection. No network requests of its own.
- Reads only the tab you click, only when you click.
- Uses the downloads permission only to save the file you create. It does not read your download history.
- Skips common cookie banners and chat widgets.

**Limits**

- One page per scan. The rendered theme only (no dark mode capture).
- Stylesheets from other domains cannot be read, so their custom property names are not used.

## Categories

- Web Development
- Appearance

## Tags

design, design-tokens, css, colors, fonts, branding

## Support

- Homepage: https://github.com/Penguin-Pants/BrandChameleon
- Support site: https://github.com/Penguin-Pants/BrandChameleon/issues

## License

MIT

## Privacy policy

Paste the content of `PRIVACY.md`.

## Screenshots

Upload in this order (1280 x 800):

1. `screenshots/1-colors.png`: "Review the detected color roles next to the site."
2. `screenshots/2-typography.png`: "Check typography levels and include or exclude token groups."
3. `screenshots/3-markdown.png`: "Pick a logo URL and edit the final DESIGN.md before you download it."

## Submission notes

- Compatibility: select **Firefox** (desktop) only. Do not select Firefox for Android: the extension uses the sidebar, which Android does not have.
- Source code: not required. The package contains plain, unminified JavaScript. No build step changes the files.
- Expected lint warning: `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`. The extension is desktop only and keeps Firefox ESR 140 support.
- Notes to reviewer: "Click the toolbar button on any website. The sidebar opens and shows the scan. The Download button saves a Markdown file with downloads.download() and closes the sidebar. The downloads permission is used only for this file; the extension does not read or change other downloads. The extension has no network code; logo thumbnails in the sidebar are plain img elements that load URLs found on the scanned page."

## Upload

1. Run `npm ci`, `npm run lint` and `npm test`.
2. Run `npm run build`.
3. Upload `web-ext-artifacts/brandchameleon_design.md_generator-0.1.0.zip`.
