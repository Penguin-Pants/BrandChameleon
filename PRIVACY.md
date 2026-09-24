# BrandChameleon Privacy Policy

Last updated: 2026-09-23

## Summary

BrandChameleon collects no data. It sends no data to the developer or to any third party.

## What the extension reads

When you click the BrandChameleon toolbar button, the extension reads the page in the active tab:

- Computed styles (colors, fonts, corner radius, spacing, shadows) of visible elements.
- Custom CSS properties from stylesheets that the page itself can read.
- The page title, `og:site_name`, `application-name`, `og:image` and icon links.

It reads only the tab where you clicked the button, and only at that moment (`activeTab` permission).

## Where the data goes

- All processing happens in your browser.
- The review lives in Firefox session storage for that window. Firefox deletes it when you quit.
- The DESIGN.md file is saved only when you click Download.
- The file contains the page URL without its query string and fragment.

## Network requests

The extension itself makes no network requests. The review sidebar shows small thumbnails of logo candidates. To show them, Firefox loads those images from the URLs found on the scanned page. These requests go to the same servers the page already uses and send no referrer.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab after you click the toolbar button. |
| `downloads` | Save the DESIGN.md file to your download folder when you click Download. The extension does not read, change or delete your other downloads. |
| `scripting` | Run the read-only scan in that tab. |
| `storage` | Keep your review while the sidebar is closed and reopened. |

The manifest declares `data_collection_permissions: { "required": ["none"] }`.

## Contact

Open an issue at https://github.com/Penguin-Pants/BrandChameleon/issues.
