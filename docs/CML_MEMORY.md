# UAT1 LiveRampConstraints (CML) - LiveRamp Quote Pricing System

**Canonical source:** `docs/uat1/LiveRampConstraints.txt` in this repo (`C:\Users\sdhanw\RCASalesforce\CML-UAT\docs\uat1\LiveRampConstraints.txt`). All parsers, explorers, and narrative docs must derive from this file — not from ad-hoc sandbox exports.

**Backup Date:** 2026-11-12 (auto-refreshed from UAT1)
**Expression Set Name:** LiveRampConstraints (UAT1 active ConstraintModel)  
**System:** LiveRamp Quote-to-Cash

---

## Overview

This is the Salesforce **LiveRampConstraints** expression set (CML / CalcML) that manages quote configuration, validation, and pricing for LiveRamp's product portfolio. It enforces business rules around product bundles, cross-sells, dependencies, and pricing model constraints (Token, CPM, Legacy).

**Key Responsibility:** Validate line items on quotes, enforce product relationships, apply intelligent defaults based on pricing type, and manage bundled product configurations.

---

## Pricing Models

### Token Pricing
- Usage-based with "LiveRamp Tokens" as unit of measure
- Bundle-centric (LiveRamp Platform and Usage)
- Default revenue type: Fixed or Revenue Share
- Cannot sell product both standalone AND in bundle on same quote

### CPM Pricing
- Cost-per-thousand-impressions model
- Reaches/frequency and impression-volume-based products
- Default revenue type: Fixed

### Legacy Pricing
- Older agreements, typically Clean Room products
- Requires custom pricing and Premier Custom Services
- Lower automation

---

## Core Product Bundle: LiveRamp Platform and Usage

- **Parent product** containing 35+ child products
- Customers quote bundle with children OR children standalone (not both)
- Must have at least one child product selected
- Default UOM: LiveRamp Tokens, Default Revenue: Fixed
- Token Tiers: Tier 1–Tier 12

### Major Child Products
Activation (all variants), Measurement Enablement (all variants), Analytics Environment, Cross Media Intelligence, Customer Profiles, Identity Engine, Real Time ID Service, Monetization Distribution, and 25+ identity/API services

---

## Key Validation Rules

### 1. Dual-Inclusion Prevention
Product cannot be on quote BOTH standalone AND as bundle component (Token pricing)

### 2. Product Dependencies
Certain products require parent products:
- Additional/Included Destinations → Activation variants
- Additional/Included Connections → LiveRamp Clean Room (Consumer)
- Analytics Environment → Measurement Enablement
- Identity services → Activation or Measurement variants
- Asset checks: If customer owns product, dependency satisfied

### 3. Service Package Exclusivity (CRM-41997)
Net New quotes: Only ONE of {Standard Services, Premier Services, Premier Flex variants, etc.}

### 4. Quantity Auto-Calculation
- **Included Connections:** Tied to Clean Room Monthly Records tier (qty 1/2/3)
- **Included Destinations:** Tied to Activation tier/package (qty 2–8 based on tier)

### 5. Publicis Funded Exclusivity
Clean Room Publicis Funded must be standalone-only (cannot combine with other products)

---

## Smart Defaults

### Token Model
- Activation/variants: UOM = Revenue Share, Revenue = Fixed
- Identity/APIs: UOM = Revenue Share, Revenue = Fixed
- In bundle: All forced to UOM = Tokens

### CPM Model
- Most products: UOM = CPM, Revenue = Fixed
- Same for activation and measurement variants

---

## Major Product Categories (200+ SKUs Total)

| Category | Examples | Notes |
|----------|----------|-------|
| Activation | Activation, B2B, NPI, Healthcare, Reseller | With tiering: RUM (5M–300M+), Impressions, LiveRamp Units |
| Measurement | Measurement Enablement, B2B, Healthcare, NPI | Supports Events, Tokens, CPM UOM |
| Clean Room | Consumer (20M–10B+ Monthly Records), Enhanced/Enterprise/Media Intel Owners | Publicis Funded is standalone-only |
| Identity Services | 100+ types: Device ID, Hashed Email, Known-to-Pseudonymous, Envelope APIs, Real Time ID | Cloud-Embedded & API variants |
| Conversion APIs | Meta, Amazon, Google, TikTok, LinkedIn, Pinterest, Snap, etc. | Requires Authenticated Traffic Solution |
| Services | Standard, Premier (Flex/Enhanced/Strategic), Custom, Baseline Support | Standard Services: Net New limit = 1 |
| Analytics & Data | Analytics Environment, Cross Media Intelligence, Customer Profiles, Identity Engine, Monetization | Often require Measurement Enablement |

---

## File Statistics

- **Total Lines:** 7,029
- **Product Types (type blocks parsed):** 162
- **Total Conditions (message/require/preference/rule/constraint):** 2,056
- **Asset Relations:** 30+ (for dependency checks)

For the exact per-type breakdown, use `CML_Rule_Explorer.html` (below) instead of these rounded figures.

---

## CML Quote Pricing Guide (narrative artifact)

`docs/CML_Quote_Pricing_Guide.html` — tabbed functional + language reference; stats (`cml-meta-*`, `cml-stat-*` classes) auto-updated from `uat1/LiveRampConstraints.txt` when `cml-daily-refresh.js` runs. A copy may also exist at `RCASalesforce/docs/CML/CML_Quote_Pricing_Guide.html`.

## CML Rule Explorer (searchable artifact)

`docs/uat1/CML_Rule_Explorer.html` is a self-contained, filterable HTML explorer generated from `docs/uat1/LiveRampConstraints.txt`. Open it directly in a browser — no server needed. Styled with the same light theme (off-white page, white cards, blue/red/amber/green accents) as the RCA Attribute-Based Product Catalog artifact for a consistent look and feel across CML docs.

- **Search** across condition text and product/type names (e.g. `"Revenue Share"`, `"CRM-43819"`, `"Publicis"`)
- **Category filter**: Activation, Measurement, Clean Room, Identity Services, Conversion APIs, Services, Analytics & Data, Connections/Destinations, Core/Bundle, Other
- **Condition-kind chips**: toggle `message` / `require` / `preference` / `rule` / `constraint` independently
- Each product type is a collapsible section showing its parent type (e.g. `Activation extends LineItem`) and every condition defined on it, with match counts

Use this instead of scrolling the raw CML in the org to find or audit a specific rule. Regenerate after any UAT1 change with `node scripts/cml-daily-refresh.js` so `uat1/LiveRampConstraints.txt`, `uat1/cml_data.json`, this explorer, `CML_MEMORY.md` stats, and `CML_Quote_Pricing_Guide.html` stay in sync.

---

## Known Issues & Limitations

1. **Large File:** 7,153 lines cause performance impact on quote loads
2. **Complex Bundle:** 35+ nested child products; any change requires full regression testing
3. **Overlapping Models:** Products exist in both Token and CPM contexts
4. **Asset Dependency:** Proper Asset record creation/linking required for dependency validation
5. **Partial Implementations:** Several rules commented out pending CRM ticket resolution (CRM-43531, CRM-43551)

---

## Related Salesforce Objects

- **SalesTransaction:** Quote header
- **SalesTransactionItem:** Line item source for product relations
- **Asset:** Customer-owned products (for dependency validation)
- **Quote Fields:** Pricing_Type__c, Quote_Type__c, Quantity_Override__c, LineItemCount__c

---

## CRM Ticket References

| Ticket | Change |
|--------|--------|
| CRM-41997 | Services Package count constraint (Net New = 1 max) |
| CRM-44420 | Quantity Override flag for Included Destinations |
| CRM-40498 | Publicis Funded SKU exclusivity |
| CRM-43531 | Disabled Included Destinations auto-qty rules (most tiers) |
| CRM-41869 | Added Clean Room Enhanced/Enterprise variants |
| CRM-44142 | Cross Media Intelligence requires Custom Measurement Services |
| CRM-44166 | Monetization Distribution in Activation API dependency |
| CRM-44558 | Platform and Usage requires ≥1 child SKU |
| CRM-43551 | Token tier UOM refinement (partial) |

---

## For Admins Maintaining This CML

1. **Adding Products:** Create type definition + add relation to Quote type + add validation rules
2. **Changing Dependencies:** Update both message AND require rules (must be consistent)
3. **New Pricing Model:** Create preference section + UI rules + update existing conditions
4. **Testing:** Regression test across Token/CPM/Legacy and all pricing scenarios
5. **Performance:** Monitor quote load time; consider archiving/splitting if >8000 lines

