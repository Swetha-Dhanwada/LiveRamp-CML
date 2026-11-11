# LiveRamp-CML

Mirrors the UAT1 and Prod `LiveRampConstraints` CalcProcedureDefinition (CML) so it can be browsed and diffed outside the org.

## Contents

- `docs/LiveRampConstraints.txt` — raw CML source as last fetched from UAT1 (compared byte-for-byte on each daily check to detect rule changes)
- `docs/cml_data.json` — parsed type/condition data extracted from the raw CML
- `docs/CML_Rule_Explorer.html` — self-contained, filterable HTML explorer built from `cml_data.json`; open directly in a browser
- `docs/CML_MEMORY.md` — human-readable summary of the business rules, pricing models, and known issues
- `docs/CML_Quote_Pricing_Guide.html` — tabbed narrative doc (stats synced from `LiveRampConstraints.txt` on refresh); mirrored under `RCASalesforce/docs/CML/` when present
- `docs/category_map.json` — product-type → category mapping used by the explorer's category filter

## Daily refresh

`scripts/cml-daily-refresh.js` pulls the active `ExpressionSetDefinitionVersion` for `LiveRampConstraints` from the UAT1 org and compares it to the `docs/LiveRampConstraints.txt` already committed on `main`. If nothing changed, it exits without touching git. If the CML changed, it updates `LiveRampConstraints.txt` / `cml_data.json` / `CML_Rule_Explorer.html` / the stats in `CML_MEMORY.md` in place and commits straight to `main`, with a commit message stamped with an ISO timestamp and a description of what changed (types/conditions added, removed, or changed counts), e.g.:

```
CML update 2026-09-30T14:05:12.000Z: 163 -> 165 types, 2110 -> 2118 conditions (+8); added: NewProductType; changed: Activation (+3)
```

Runs daily at 06:00 via the Windows Scheduled Task **"CML Rule Explorer Daily Refresh"**, which invokes `scripts/cml-daily-refresh.ps1`. Requires the `sf` CLI authenticated against the `UAT1` org alias on this machine.

### Prod mirror and UAT1 vs Prod differences

The same script can mirror Prod (read-only: one SOQL query and one GET on `ConstraintModel`):

```
node scripts/cml-daily-refresh.js --org Prod --alias <sf-alias-for-prod> [--no-git]
```

- Output goes to `docs/prod/` (`LiveRampConstraints.txt`, `cml_data.json`, `CML_Rule_Explorer.html`). The Prod page is built from the UAT1 page, so identical CML keeps its plain-English text.
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
