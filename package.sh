#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/splitscreen-browser-sync-<version>.zip
# Only the files the extension needs at runtime are included.
set -euo pipefail

cd "$(dirname "$0")"

VERSION="$(node -p "require('./manifest.json').version")"
NAME="splitscreen-browser-sync-${VERSION}"
OUT="dist/${NAME}.zip"

echo "Checking JavaScript syntax"
for file in background.js content.js popup.js; do
  node --check "$file"
done

echo "Checking JSON"
for file in manifest.json _locales/*/messages.json; do
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$file"
done

FILES=(
  manifest.json
  background.js
  content.js
  content.css
  popup.html
  popup.css
  popup.js
  _locales/en/messages.json
  _locales/nl/messages.json
  icons/icon.svg
  icons/icon16.png
  icons/icon24.png
  icons/icon32.png
  icons/icon48.png
  icons/icon64.png
  icons/icon128.png
  icons/icon256.png
)

for file in "${FILES[@]}"; do
  [[ -f "$file" ]] || { echo "Missing: $file" >&2; exit 1; }
done

mkdir -p dist
rm -f "$OUT"
zip -q -X "$OUT" "${FILES[@]}"

echo "Created $OUT"
unzip -l "$OUT"
