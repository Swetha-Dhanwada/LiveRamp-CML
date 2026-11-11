#!/bin/bash
# macOS/Linux equivalent of cml-daily-refresh.ps1 — schedule via launchd (macOS) or cron.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/cml-refresh-$(date +%Y-%m-%d_%H%M%S).log"

node scripts/cml-daily-refresh.js > "$LOG_FILE" 2>&1
