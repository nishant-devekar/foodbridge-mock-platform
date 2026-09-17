#!/usr/bin/env bash
# Deploy the Zoho bridge to Vercel. Run AFTER `vercel login`.
#
#   ./deploy.sh
#
# Pushes every value from .env into the Vercel project's environment (so the
# Zoho credentials live there, never in the repo or the browser) and deploys.
set -euo pipefail
cd "$(dirname "$0")"
# The CLI is not a dependency of the bridge; use the local copy when one is
# installed, otherwise fetch it once with npx.
if [ -x ./node_modules/.bin/vercel ]; then V=./node_modules/.bin/vercel; else V="npx -y vercel@latest"; fi

$V whoami >/dev/null 2>&1 || { echo "Not logged in. Run: $V login"; exit 1; }

# Where Zoho sends the user back after the onboarding sign-in (api/zoho/start).
# It has to be THIS deployment's callback, and the same URL must be listed
# under the client's Authorized Redirect URIs in the Zoho API console
# (api-console.zoho.in) — Zoho refuses any URI it has not been told about.
PROD_CALLBACK="${PROD_CALLBACK:-https://zoho-function-nu.vercel.app/api/callback}"
# Xero's is its own route, registered with the Xero app at developer.xero.com.
PROD_XERO_CALLBACK="${PROD_XERO_CALLBACK:-https://zoho-function-nu.vercel.app/api/xero/callback}"

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
    ZOHO_REDIRECT_URI) value="$PROD_CALLBACK";;   # the per-user sign-in returns here
    XERO_REDIRECT_URI) value="$PROD_XERO_CALLBACK";;
  esac
  push "$name" "$value"
done < .env
# .env may predate the onboarding sign-in and carry no redirect URIs at all.
grep -q '^ZOHO_REDIRECT_URI=' .env || push ZOHO_REDIRECT_URI "$PROD_CALLBACK"
if grep -q '^XERO_CLIENT_ID=' .env && ! grep -q '^XERO_REDIRECT_URI=' .env; then push XERO_REDIRECT_URI "$PROD_XERO_CALLBACK"; fi

echo "==> Deploying to production"
$V deploy --prod

echo
echo "Check:  curl -s https://zoho-function-nu.vercel.app/api/zoho/ready   → {\"ready\":true}"
echo "Zoho:   $PROD_CALLBACK must be an Authorized Redirect URI of the client in api-console.zoho.in"
echo "Xero:   $PROD_XERO_CALLBACK must be a Redirect URI of the app at developer.xero.com (XERO_CLIENT_ID/SECRET in .env)"
