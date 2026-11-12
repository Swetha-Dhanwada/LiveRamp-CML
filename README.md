# LiveRamp-CML

Mirrors the UAT1 and Prod `LiveRampConstraints` CalcProcedureDefinition (CML) so it can be browsed and diffed outside the org.

## Contents

- `docs/uat1/LiveRampConstraints.txt` — raw CML source as last fetched from UAT1 (compared byte-for-byte on each daily check to detect rule changes)
- `docs/uat1/cml_data.json` — parsed type/condition data extracted from the raw CML
- `docs/uat1/CML_Rule_Explorer.html` — self-contained, filterable HTML explorer built from `cml_data.json`; open directly in a browser
- `docs/CML_MEMORY.md` — human-readable summary of the business rules, pricing models, and known issues
- `docs/CML_Quote_Pricing_Guide.html` — tabbed narrative doc (stats synced from `uat1/LiveRampConstraints.txt` on refresh); mirrored under `RCASalesforce/docs/CML/` when present
- `docs/category_map.json` — product-type → category mapping used by the explorer's category filter

## Daily refresh

`scripts/cml-daily-refresh.js` pulls the active `ExpressionSetDefinitionVersion` for `LiveRampConstraints` from the UAT1 org and compares it to the `docs/uat1/LiveRampConstraints.txt` already committed on `main`. If nothing changed, it exits without touching git. If the CML changed, it updates `LiveRampConstraints.txt` / `cml_data.json` / `CML_Rule_Explorer.html` / the stats in `CML_MEMORY.md` in place and commits straight to `main`, with a commit message stamped with an ISO timestamp and a description of what changed (types/conditions added, removed, or changed counts), e.g.:

```
CML update 2026-09-30T14:05:12.000Z: 163 -> 165 types, 2110 -> 2118 conditions (+8); added: NewProductType; changed: Activation (+3)
```

Runs daily at 06:00 via the Windows Scheduled Task **"CML Rule Explorer Daily Refresh"**, which invokes `scripts/cml-daily-refresh.ps1`. Requires the `sf` CLI authenticated against the `UAT1` org alias on this machine.

### Prod mirror and UAT1 vs Prod differences

The same script can mirror Prod (read-only: one SOQL query and one GET on `ConstraintModel`):

```
node scripts/cml-daily-refresh.js --org Prod --alias <sf-alias-for-prod> [--no-git]
```

- Same three files per environment: `docs/uat1/` for UAT1, `docs/prod/` for Prod. Prod output goes to `docs/prod/` (`LiveRampConstraints.txt`, `cml_data.json`, `CML_Rule_Explorer.html`). The Prod page is built from the UAT1 page, so identical CML keeps its plain-English text.
- `docs/CML_UAT1_vs_Prod.html` is regenerated on every run once both mirrors exist (`node scripts/cml-diff.js` rebuilds it on its own).
- The explorer pages link to each other and to the diff report.
- `--no-git` regenerates files without checkout, commit or push. `CML_MEMORY.md` and the Quote Pricing Guide stay UAT1-only.
- The scheduled task still runs UAT1 only. To refresh Prod daily, add a second task that runs the command above.
- `scripts/cml-explorer-model.js` converts parser output into the shape the explorer page renders.

To run manually:

```
node scripts/cml-daily-refresh.js
```

Steps to Run the script:
Clone the repo anywhere (no fixed location required now):

git clone https://github.com/Swetha-Dhanwada/LiveRamp-CML.git C:\wherever\you\want\LiveRamp-CML

2. Install prerequisites on that machine:

Node.js (for node scripts\cml-daily-refresh.js)
Salesforce CLI (sf), authenticated against the UAT1 org alias — run sf org login web -a UAT1 (or sf org login jwt for unattended auth) so sf commands succeed non-interactively
Git configured with push access to origin (SSH key or stored credential) so the script's git push origin main doesn't prompt for credentials

3. Run it manually first to confirm it works:

cd C:\wherever\you\want\LiveRamp-CML
.\scripts\cml-daily-refresh.ps1

It'll write a log to <repo>\logs\cml-refresh-<timestamp>.log and only commit/push if the CML actually changed.

4. Register the Windows Scheduled Task pointing at the new location:

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\wherever\you\want\LiveRamp-CML\scripts\cml-daily-refresh.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 6am
Register-ScheduledTask -TaskName "CML Rule Explorer Daily Refresh" -Action $action -Trigger $trigger

Since the script now derives its root from its own location ($PSScriptRoot), you don't need to edit the script at all when moving machines — just point the scheduled task's -File argument at wherever you cloned the repo on that machine.

## Running on macOS

Everything above works on a Mac. The refresh script uses `sf` (not `sf.cmd`) on macOS, and `launchd` replaces the Windows Scheduled Task.

### Prerequisites

- Node.js, Salesforce CLI (`sf`) and git installed (`node -v`, `sf --version`, `git --version`).
- `sf` authenticated against each org you mirror. Use the aliases `UAT1` and `Prod`, or pass your own alias.
  ```bash
  sf org login web -a UAT1 --instance-url https://test.salesforce.com   # sandbox
  sf org login web -a Prod                                              # production
  sf org list                                                           # confirm aliases
  ```
  `sf org login jwt` is more reliable for unattended runs, because web logins expire.
- Git push access without a prompt, either the macOS keychain or SSH:
  ```bash
  git config --global credential.helper osxkeychain   # then do one manual `git push` and sign in
  # or use SSH
  git remote set-url origin git@github.com:Swetha-Dhanwada/LiveRamp-CML.git
  ```

### Run it manually

```bash
git clone https://github.com/Swetha-Dhanwada/LiveRamp-CML.git
cd LiveRamp-CML

# UAT1 -> docs/
./scripts/cml-daily-refresh.sh UAT1

# Prod -> docs/prod/  (read-only against the org; pass the alias if it is not "Prod")
./scripts/cml-daily-refresh.sh Prod [your-prod-alias]

# Or call node directly. --no-git regenerates files without checkout/commit/push,
# so you can review the diff before committing:
node scripts/cml-daily-refresh.js --org UAT1 --no-git
node scripts/cml-daily-refresh.js --org Prod --alias Prod --no-git
```

- Logs go to `logs/cml-refresh-<org>-<timestamp>.log`.
- If the CML hasn't changed, the script exits without touching git.
- To commit and push by hand after a `--no-git` run:
  ```bash
  git add docs scripts README.md
  git commit -m "CML update"
  git push origin main
  ```
- `node scripts/cml-diff.js` rebuilds `docs/CML_UAT1_vs_Prod.html` on its own.

### Schedule it (launchd)

```bash
./scripts/install-mac-schedule.sh              # UAT1 daily 06:00 + Prod daily 06:15
./scripts/install-mac-schedule.sh --uat1-only  # or --prod-only
CML_PROD_ALIAS=my-prod ./scripts/install-mac-schedule.sh   # custom alias
```

This writes `~/Library/LaunchAgents/com.liveramp.cml.UAT1.plist` and `com.liveramp.cml.Prod.plist` and loads them.

```bash
launchctl kickstart -k gui/$(id -u)/com.liveramp.cml.UAT1   # run one now
launchctl print gui/$(id -u)/com.liveramp.cml.Prod          # status
./scripts/uninstall-mac-schedule.sh                         # remove both jobs
```

- A Mac that is asleep at the scheduled time runs the job when it wakes. A Mac that is powered off skips that day.
- If a run fails with `could not read Username`, git credentials are not set up. See the prerequisites above.
- If a run fails with `No authorization information found` or similar, re-run `sf org login` for that alias.
