#!/usr/bin/env bash
# Package DARKWEB into a Chrome Web Store-ready zip.
# Includes ONLY runtime files (manifest + src + assets); excludes tools, tests,
# node_modules, .venv, .git, store assets.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -e "process.stdout.write(require('./manifest.json').version)")
ZIP="darkweb-v${VERSION}.zip"

rm -f "$ZIP"
zip -r -q "$ZIP" manifest.json src assets \
  -x '*/.DS_Store' -x '.DS_Store'

echo "Built $ZIP"
unzip -l "$ZIP" | tail -n +2 | head -n 40
echo "Total size: $(du -h "$ZIP" | cut -f1)"
