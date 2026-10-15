#!/bin/sh
# Rebuild v10's copy of store activation from a released tag of the module (default store-activation-v0.1.12).
#   sh build.sh [/path/to/foodbridge-module-digital-assistant] [tag]
# Takes the tag's development/ folder into a temp dir, installs it, puts ./adapter beside the frontend's source and
# builds into ../app/. Nothing in the module repo is changed.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${1:-$HERE/../../../../../foodbridge-module-digital-assistant}
TAG=${2:-store-activation-v0.1.12}
TMP=$(mktemp -d)
git -C "$REPO" archive "$TAG" development | tar -x -C "$TMP"
cd "$TMP/development" && npm install --no-audit --no-fund
cp -R "$HERE/adapter" "$TMP/development/frontend/v10-adapter"
cd "$TMP/development/frontend" && SA_OUT="$HERE/../app" npx vite build --config v10-adapter/vite.config.mjs
echo "$TAG" > "$HERE/../app/VERSION"
echo "Built $TAG into $(cd "$HERE/../app" && pwd)"
