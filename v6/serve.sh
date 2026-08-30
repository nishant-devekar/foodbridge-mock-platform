#!/usr/bin/env bash
# Serve this snapshot. It needs HTTP — several screens fetch() their seed JSON,
# which browsers block on file://.
cd "$(dirname "$0")" && python3 -m http.server "${1:-8004}"
