#!/usr/bin/env bash
# Install macOS launchd jobs for the daily CML refresh.
#   UAT1 daily 06:00   -> docs/
#   Prod daily 06:15   -> docs/prod/
#
# Usage: scripts/install-mac-schedule.sh [--uat1-only | --prod-only]
# Env:   CML_UAT1_ALIAS (default UAT1), CML_PROD_ALIAS (default Prod)
# Remove with scripts/uninstall-mac-schedule.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCH_AGENTS="${HOME}/Library/LaunchAgents"
LABEL_PREFIX="com.liveramp.cml"
UAT1_ALIAS="${CML_UAT1_ALIAS:-UAT1}"
PROD_ALIAS="${CML_PROD_ALIAS:-Prod}"

mkdir -p "$LAUNCH_AGENTS" "$ROOT/logs"
chmod +x "$ROOT/scripts/cml-daily-refresh.sh"

install_plist() {
  local org="$1" alias="$2" hour="$3" minute="$4"
  local label="${LABEL_PREFIX}.${org}"
  local plist="$LAUNCH_AGENTS/${label}.plist"

  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${label}</string>
	<key>WorkingDirectory</key>
	<string>${ROOT}</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>${ROOT}/scripts/cml-daily-refresh.sh</string>
		<string>${org}</string>
		<string>${alias}</string>
	</array>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>${hour}</integer>
		<key>Minute</key>
		<integer>${minute}</integer>
	</dict>
	<key>StandardOutPath</key>
	<string>${ROOT}/logs/${org}-launchd.out.log</string>
	<key>StandardErrorPath</key>
	<string>${ROOT}/logs/${org}-launchd.err.log</string>
</dict>
</plist>
EOF

  plutil -lint "$plist" >/dev/null
  # Reload if already loaded, then load.
  launchctl bootout "gui/$(id -u)/${label}" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "Installed ${label}: daily at $(printf '%02d:%02d' "$hour" "$minute") (alias ${alias})"
}

case "${1:-}" in
  --uat1-only) install_plist UAT1 "$UAT1_ALIAS" 6 0 ;;
  --prod-only) install_plist Prod "$PROD_ALIAS" 6 15 ;;
  "")
    install_plist UAT1 "$UAT1_ALIAS" 6 0
    install_plist Prod "$PROD_ALIAS" 6 15
    ;;
  *) echo "Usage: $0 [--uat1-only | --prod-only]" >&2; exit 1 ;;
esac

echo "Logs: $ROOT/logs/  | Test now: launchctl kickstart -k gui/$(id -u)/${LABEL_PREFIX}.UAT1"
