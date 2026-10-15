#!/usr/bin/env bash
# Serve this cut. It needs HTTP — the screens fetch() their seed JSON and nav
# config, which browsers block on file://.
cd "$(dirname "$0")" && python3 serve.py "${1:-8007}"
