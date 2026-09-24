# AMO Answer Sheet: BrandChameleon 1.0

Use this sheet to submit BrandChameleon on addons.mozilla.org (AMO). The steps follow the order of the AMO forms. Copy each value from its box.

The field rules were checked against the AMO server source (`mozilla/addons-server`, main branch) on 2026-09-24.

## Package contents

| Item | File |
|---|---|
| Extension package | `web-ext-artifacts/brandchameleon_design.md_generator-1.0.zip` (build it in step 1) |
| Icon, 128 x 128 | `src/icons/icon-128.png` |
| Screenshots, 2400 x 1800 (4:3) | `amo/screenshots/1-colors.png`, `amo/screenshots/2-typography.png`, `amo/screenshots/3-markdown.png` |
| Privacy policy, AMO format | `amo/privacy-policy.md` |

## Step 1: Build the package

1. Run `npm ci`.
2. Run `npm run lint`. The result must show 0 errors. One warning is expected (see step 2).
3. Run `npm test`.
4. Run `npm run build`. The zip is in `web-ext-artifacts/`.

## Step 2: Upload the version

In the Developer Hub, click **Submit a New Add-on**.

| Question | Answer |
|---|---|
| How to distribute this version | **On this site** |
| File | `brandchameleon_design.md_generator-1.0.zip` |
| Compatible applications | **Firefox**: selected. **Firefox for Android**: not selected. |

- The extension uses the sidebar. Firefox for Android has no sidebar.
- Validation shows 1 warning: `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`. This is expected. The extension is for desktop only and keeps support for Firefox ESR 140.

## Step 3: Source code

"Do you need to submit source code?": **No**.

The zip contains the plain, unminified files from `src/`. No bundler, transpiler or minifier changes them.

## Step 4: Describe the add-on

### Name

```text
BrandChameleon: DESIGN.md Generator
```

### Add-on URL (slug)

```text
brandchameleon
```

If AMO says that this URL is already in use, use `brandchameleon-design-md`.

### Summary

178 of 250 characters. AMO does not allow URLs in the summary.

```text
Scan any website and download a DESIGN.md file with its brand colors, fonts, corner shapes, spacing and logo URL. Review and edit every value before you save. No data collection.
```

If AMO shows "Ensure name and summary combined are at most 70 characters", use this short summary (68 characters with the name):

```text
Save a site's brand as DESIGN.md.
```

### Description

AMO accepts Markdown here: bold text, lists and `code`.

```text
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

- No data collection. The only network requests are logo thumbnails, loaded from image URLs on the scanned page and from `/favicon.ico` on the scanned site.
- Reads only the tab you click, only when you click.
- Uses the downloads permission only to save the file you create. It does not read your download history.
- Skips common cookie banners and chat widgets.

**Limits**

- One page per scan. The rendered theme only (no dark mode capture).
- Stylesheets from other domains cannot be read, so their custom property names are not used.
```

### Checkboxes

| Checkbox | Answer |
|---|---|
| This add-on is experimental | Not selected |
| This add-on requires payment, non-free services or software, or additional hardware | Not selected |

### Categories

Select **Web Development** only.

Do not select Appearance. AMO describes it as extensions that change how websites or Firefox look. BrandChameleon does not change the page.

### Support email

Optional. Leave it empty, or use an address that you own. AMO shows it to users.

### Support website

```text
https://github.com/Penguin-Pants/BrandChameleon/issues
```

### License

Select **MIT License**.

### Privacy policy

1. Select **This add-on has a Privacy Policy**.
2. Paste all the text of `amo/privacy-policy.md`.

- A policy is not required, because the extension collects no data. It is recommended, because it tells users that the sidebar loads logo thumbnails from the scanned site.
- Do not paste `PRIVACY.md`. It uses headings and a table. AMO removes headings and does not support tables.

### End-User License Agreement

Do not select it.

### Notes to Reviewer

```text
How to test:
1. Open any public website, for example https://www.mozilla.org/.
2. Click the BrandChameleon toolbar button. The sidebar opens and shows the scan.
3. Click Download. The sidebar closes and Firefox saves <name>_design.md to the download folder.

How it works: the toolbar click uses activeTab and scripting to run a read-only scan in that tab. The Download button hands the Markdown text to the background script through storage.session and closes the sidebar. The background script saves it with downloads.download(). The downloads permission is used only for this file. The extension does not read or change other downloads.

The extension has no network code. Logo thumbnails in the sidebar are plain img elements that load URLs found on the scanned page, plus <origin>/favicon.ico of the scanned site (a guess, labeled "not verified").

There is no build step. The zip contains the files in src/ of https://github.com/Penguin-Pants/BrandChameleon without changes.
```

### Release notes for version 1.0

AMO shows this field on the submission page or on the version page (**Manage Status & Versions**, then **1.0**).

```text
First release. Scan a website, review its colors, typography, shapes, spacing, components and logo, then download a DESIGN.md file. The sidebar closes after the download.
```

## Step 5: Edit the product page

Open the add-on in the Developer Hub and click **Edit Product Page**.

### Images

- **Icon:** AMO normally uses the icon from the package. If the listing shows a default icon, upload `src/icons/icon-128.png`.
- **Screenshots:** upload them in this order, with these captions:

| File | Caption |
|---|---|
| `amo/screenshots/1-colors.png` | Review the detected color roles next to the site. |
| `amo/screenshots/2-typography.png` | Check typography levels and include or exclude token groups. |
| `amo/screenshots/3-markdown.png` | Pick a logo URL and edit the final DESIGN.md before you download it. |

The screenshots are 2400 x 1800 (4:3). AMO shows screenshots at 4:3, and it can reject other ratios.

### Additional details

| Field | Answer |
|---|---|
| Homepage | `https://github.com/Penguin-Pants/BrandChameleon` (AMO takes it from the manifest) |
| Tags | Leave empty. AMO allows only tags from a fixed list (for example "privacy", "dark mode" and "youtube"). None of them fit this extension. |
| Default locale | English (US) |
| Contributions URL | Leave empty |

### Technical details

Developer comments: leave empty.

## Data collection

The manifest declares `data_collection_permissions: { "required": ["none"] }`. AMO and the Firefox install prompt use this to show that the extension collects no data.
