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
- [ ] The prompt lists "Download files and read and modify the browser’s download history" (the `downloads` permission).
- [ ] The prompt says the extension does not collect data.

## Scan and review

- [ ] Open a public website (for example your target company's home page).
- [ ] Click the toolbar button once. The sidebar opens and shows "Scanning <host>...", then the review.
- [ ] Name, colors, typography, shapes, spacing, components and logo candidates look plausible.
- [ ] Logo thumbnails load. A missing `/favicon.ico` shows an empty box, not a broken image icon.
- [ ] Change a color with the **Pick** control. The native color dialog opens and the sidebar stays open.
- [ ] Type an invalid hex such as `#12`. The error text appears and the markdown does not change.
- [ ] Uncheck **Include shapes**. The markdown loses `rounded:` and gains an `omitted` entry.

## Download and close (risk R1)

- [ ] Before you click, copy the text from the **Markdown** box.
- [ ] Click **Download**. The sidebar closes. Firefox saves `<slug>_design.md` to the default download folder, and the Downloads toolbar button shows it.
- [ ] Open the file. It is complete and matches the text you copied.
- [ ] Scan the same site again and click **Download**. Firefox saves `<slug>_design(1).md` (auto-rename) and keeps the first file.
- [ ] Scan again, focus **Download** with the Tab key and press Enter. The file saves and the sidebar closes.
- [ ] Scan again and wait 2 minutes before you click **Download** (the background script sleeps after about 30 s). The file still saves and the sidebar closes.
- [ ] Scan again and delete the first `---` line in the Markdown box. Click **Download**. The "Check the markdown" dialog opens. Click **Cancel**: the sidebar stays open and no file saves.
- [ ] Click **Download** again, then **Download anyway**. The file saves and the sidebar closes.
- [ ] In Firefox Settings, turn on "Ask where to save files before downloading" (older versions: "Always ask you where to save files"). Scan and click **Download**. The file saves to the default download folder with no Save dialog, and the sidebar closes. Turn the setting off again.
- [ ] If a file does not save or is empty, stop and report it. Also report if the sidebar stays open after the file saves.

## Validate the file

- [ ] Run `npx -p @google/design.md designmd lint <file>`. The summary shows `"errors": 0`. Warnings are allowed.
  - Use the `designmd` command name. On Windows, `npx @google/design.md` opens the `design.md` launcher file in your Markdown editor and does not run the linter.

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
