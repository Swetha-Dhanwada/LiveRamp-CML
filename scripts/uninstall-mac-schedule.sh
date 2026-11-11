#!/usr/bin/env bash
# Remove the launchd jobs installed by install-mac-schedule.sh.
set -euo pipefail

LAUNCH_AGENTS="${HOME}/Library/LaunchAgents"
LABEL_PREFIX="com.liveramp.cml"

for org in UAT1 Prod; do
  label="${LABEL_PREFIX}.${org}"
  launchctl bootout "gui/$(id -u)/${label}" 2>/dev/null || true
  rm -f "$LAUNCH_AGENTS/${label}.plist"
  echo "Removed ${label}"
done
