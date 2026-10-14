# LINE Darkfy

An unofficial dark theme for the LINE Chrome extension. Not affiliated with or endorsed by LY Corporation.

This repository contains custom CSS, a local build script, and documentation. LINE binaries and assets are excluded.

## Build

Requires Node.js 20+, npm, and 7-Zip (`7z` on your PATH). No npm dependencies are needed.

```bash
git clone https://github.com/ultsaza/line-darkfy.git
cd line-darkfy
npm run build
```

The script downloads the official LINE extension from Google's update service and adds the theme to a local copy in `dist/line-darkfy`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Disable the official LINE extension and remove any previous unpacked Darkfy copy.
3. Enable **Developer mode** and click **Load unpacked**.
4. Select `dist/line-darkfy`.

Darkfy uses LINE's extension ID (`ophjlpahpchlmihnnnihgmmeilfjmjjc`), so both copies cannot be loaded at the same time.

## Update

Download a fresh LINE package and rebuild:

```bash
npm run build:download
```

Reload Darkfy in `chrome://extensions` after rebuilding. Automatic LINE updates are disabled for the local copy.

The theme was written against LINE 3.7.2. Later versions may require CSS or build changes. See [build notes](docs/analysis.md).

## License

[MIT](LICENSE) applies to project-authored files only. LINE and its bundled dependencies remain subject to their own licenses and terms. Review [LINE's terms](https://terms.line.me/line_terms?lang=en) before building or using a modified copy; this project's license grants no rights to LINE itself.
