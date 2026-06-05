#!/usr/bin/env bash
# Guileo — one-command build + deploy to the Cloudflare Pages preview branch.
# Usage:  bash scripts/deploy.sh
# Prints the preview URL/hash on success. Production is NEVER touched here.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Building…"
npm run build 2>&1 | tail -3

echo "▸ Deploying to preview…"
OUT=$(npx wrangler pages deploy dist --project-name=guileoai --branch=preview 2>&1)
echo "$OUT" | grep -iE "peek|alias" || true

HASH=$(echo "$OUT" | grep -oE "https://[a-z0-9]+\.guileoai\.pages\.dev" | head -1)
echo ""
echo "✅ Preview: ${HASH:-<see output above>}"
echo "   Portal:  ${HASH:-?}/portal"
