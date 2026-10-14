# Build notes

Based on local inspection of LINE Chrome extension 3.7.2 (`ophjlpahpchlmihnnnihgmmeilfjmjjc`). These observations may change with upstream releases.

## Theme

The app loads `static/js/main.js` and `static/css/main.0e756bd5.css` from `index.html`. Its popup uses `popup.html` and `static/js/popup.js`.

`src/darkfy.css` overrides colors using CSS Module class prefixes such as `chatroom-module__` and `chatlist-module__`. Rules are scoped to `html[data-line-darkfy="dark"]`.

## Local build

The build script:

1. Downloads the official CRX into `vendor/line.crx`, or reuses the cached copy.
2. Extracts it into `dist/line-darkfy` and removes `_metadata` and `manifest.update_url`.
3. Sets the name to `LINE Darkfy` and copies the CRX public key into `manifest.key` to preserve the extension ID.
4. Adds the theme marker and stylesheet to `index.html` and `popup.html`, and registers the CSS in `asset-manifest.json`.

In the inspected version, LINE's sandbox checks the extension origin. A different ID causes `Invalid origin` and `ltsm_not_available` errors. Preserving the ID also prevents loading Darkfy alongside the official extension.

## Repository scope

`vendor/`, `extracted/`, `dist/`, and CRX files are excluded from Git. Keep LINE binaries, assets, and modified builds out of commits and release attachments.
