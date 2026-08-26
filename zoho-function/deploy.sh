#!/usr/bin/env bash
# Deploy the Zoho bridge to Vercel. Run AFTER `vercel login`.
#
#   ./deploy.sh
#
# Pushes every value from .env into the Vercel project's environment (so the
# Zoho credentials live there, never in the repo or the browser) and deploys.
set -euo pipefail
cd "$(dirname "$0")"
V=./node_modules/.bin/vercel

$V whoami >/dev/null 2>&1 || { echo "Not logged in. Run: ./node_modules/.bin/vercel login"; exit 1; }

echo "==> Linking project (creates it on first run)"
$V link --yes >/dev/null

echo "==> Pushing environment"
# ALLOWED_ORIGINS is rewritten for production: the deployed function is called
# by the GitHub Pages app, not by localhost:8003.
PROD_ORIGINS="${PROD_ORIGINS:-https://nishant-devekar.github.io}"

push() {  # push NAME VALUE
  local name="$1" value="$2"
  [ -z "$value" ] && return 0
  $V env rm "$name" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | $V env add "$name" production >/dev/null
  echo "    $name"
}

# shellcheck disable=SC2046
while IFS= read -r line; do
  case "$line" in ''|\#*) continue;; esac
  name="${line%%=*}"; value="${line#*=}"
  case "$name" in
    PORT) continue;;                       # Vercel assigns the port
    ALLOWED_ORIGINS) value="$PROD_ORIGINS";;
    ZOHO_REDIRECT_URI) continue;;          # OAuth was a one-time local step
  esac
  push "$name" "$value"
done < .env

echo "==> Deploying to production"
$V deploy --prod
