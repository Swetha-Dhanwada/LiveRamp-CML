#!/usr/bin/env bash
# macOS/Linux wrapper for the daily CML refresh (the counterpart of cml-daily-refresh.ps1).
#
# Usage: scripts/cml-daily-refresh.sh [UAT1|Prod] [sf-alias]
#   UAT1 (default) mirrors UAT1 into docs/uat1/; Prod mirrors Prod into docs/prod/.
#   sf-alias defaults to the org name. Only read-only calls are made against the org.
#
# launchd does not load your shell profile, so PATH is set explicitly, and git
# is told never to prompt (a missing credential fails the run instead of hanging).
set -uo pipefail

ORG="${1:-UAT1}"
ALIAS="${2:-$ORG}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/cml-refresh-${ORG}-$(date +%Y-%m-%d_%H%M%S).log"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.local/bin:${PATH:-}"
export GIT_TERMINAL_PROMPT=0

cd "$ROOT"
node scripts/cml-daily-refresh.js --org "$ORG" --alias "$ALIAS" >"$LOG_FILE" 2>&1
status=$?
echo "exit status: $status" >>"$LOG_FILE"
exit "$status"
