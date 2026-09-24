# Manual Firefox Checklist

Run this checklist in real Firefox before each AMO submission. Automated tests run in Chromium, so they cannot prove Firefox-only behavior.

## Setup

- [ ] Use Firefox desktop 140 or later.
- [ ] Run `npm ci` and `npm run build`.
- [ ] Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on** and select `src/manifest.json`.
- [ ] The toolbar shows the BrandChameleon icon.
- [ ] The sidebar does not open by itself after install.

## Install prompt (signed build only)

- [ ] Install the signed `.xpi` from AMO or a self-distribution build.
- [ ] The prompt shows no "Access your data for all websites" warning.
- [ ] The prompt says the extension does not collect data.

## Scan and review

- [ ] Open a public website (for example your target company's home page).
- [ ] Click the toolbar button once. The sidebar opens and shows "Scanning <host>...", then the review.
- [ ] Name, colors, typography, shapes, spacing, components and logo candidates look plausible.
- [ ] Logo thumbnails load. A missing `/favicon.ico` shows an empty box, not a broken image icon.
- [ ] Change a color with the **Pick** control. The native color dialog opens and the sidebar stays open.
- [ ] Type an invalid hex such as `#12`. The error text appears and the markdown does not change.
- [ ] Uncheck **Include shapes**. The markdown loses `rounded:` and gains an `omitted` entry.

## Download (risk R1)

- [ ] Click **Download**. Firefox saves `<slug>_design.md` to the default download folder.
- [ ] Open the file. It matches the text in the sidebar.
- [ ] Download again. Firefox saves `<slug>_design(1).md` (auto-rename).
- [ ] If the download does not start at all, stop and report it: the fix needs the `downloads` permission, which is a product decision.

## Validate the file

- [ ] Run `npx @google/design.md lint <file>`. The summary shows `"errors": 0`.

## Edits and state

- [ ] Edit the markdown text, then change a field. The "Regenerate markdown?" dialog appears. **Cancel** keeps your text.
- [ ] Close the sidebar (View > Sidebar) and reopen it. The review and your edits are still there.
- [ ] With unsaved edits, click the toolbar button on another site. The "Replace review?" dialog appears. **Keep** keeps the old review.
- [ ] Open a second window and scan a different site. Each window shows its own review.

## Errors

- [ ] Click the toolbar button on `about:addons`. The sidebar shows "BrandChameleon cannot scan this page..." and "Click the toolbar button to scan again."
- [ ] Click the toolbar button on `https://addons.mozilla.org`. Same message.
- [ ] Start a scan and navigate away at once. The sidebar shows an error, not an endless loading state.

## Accessibility and layout

- [ ] Use only the keyboard: Tab reaches every control; Space and Enter work; Escape closes dialogs.
- [ ] Focus is always visible.
- [ ] Drag the sidebar to its narrowest width. Nothing scrolls sideways.
- [ ] Switch Firefox to a dark theme. The sidebar follows it and stays readable.

## Performance

- [ ] Scan a large page (for example a long news home page). The review appears in under 3 seconds after the page finished loading.

## Result

Record the Firefox version, date and any failures in the pull request or release notes.
