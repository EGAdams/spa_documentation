#!/usr/bin/env bash
# Serve spa_documentation locally.
cd "$(dirname "$0")"
PORT="${1:-8931}"
python3 -m http.server "$PORT"
