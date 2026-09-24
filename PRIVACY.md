# BrandChameleon Privacy Policy

Last updated: 2026-09-24

## Summary

BrandChameleon collects no data. The developer receives nothing: no scans, no files and no usage data. The only network requests are the logo thumbnails described under Network requests.

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

The extension's code sends no data over the network. The review sidebar shows small thumbnails of logo candidates. To show them, Firefox loads each image from the URL that the scanned page declares, for example its icon or `og:image`. It also tries `/favicon.ico` on the scanned site's own server, even when the page does not declare it. That URL can point to the site's own server or to another server, such as an image host. Like any web image, each request gives that server your IP address and the normal browser request headers, and it can include cookies that Firefox holds for that server. The extension adds no data to these requests and sends no referrer.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab after you click the toolbar button. |
| `downloads` | Save the DESIGN.md file to your download folder when you click Download. The extension does not read, change or delete your other downloads. |
| `scripting` | Run the read-only scan in that tab. |
| `storage` | Keep your review while the sidebar is closed and reopened. Pass the file text to the extension's background script when you click Download. The data stays in memory and is deleted when Firefox closes. |

The manifest declares `data_collection_permissions: { "required": ["none"] }`.

## Contact

Open an issue at https://github.com/Penguin-Pants/BrandChameleon/issues.
