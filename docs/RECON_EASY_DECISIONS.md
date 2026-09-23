# ReconEasy — Decision Log
> Decisions made in Claude, ChatGPT, or founder discussions.
> Status labels: [ACTIVE] [SUPERSEDED] [DEFERRED]

---

## Engine & Architecture

- [2026-06-02] [engine] [ACTIVE] Engine B (TypeScript in shared/) is the only reconciliation engine — Engine A deprecated. Reason: auditable, tenant-scoped, per-order calculation breakdowns with SHA-256 hash.

- [2026-06-02] [engine] [ACTIVE] Every reconciliation run is immutable — stored with run ID and frozen evidence. Claims reference source run_id. Evidence never mutated after creation.

- [2026-06-02] [engine] [ACTIVE] Rate cards are brand-configured — never hardcode marketplace fee values. Reason: fees vary by brand tier, category, and negotiated contracts.

- [2026-06-02] [backend] [ACTIVE] All Express routes use pool.query() directly — no Drizzle ORM.

- [2026-09-24] [engine] [ACTIVE] Engine B v2 (v2_typescript_amazon_v2) uses 9-component fee model. TCS 0.5% (GST TCS since Jul 2024). TDS 194-O 0.1% informational only — not in net payout. Net payout = gross − commission − commission_gst − closing_fee − closing_fee_gst − logistics − logistics_gst − tcs.

- [2026-09-24] [engine] [ACTIVE] TCS (GST TCS, ItemWithheldTax) and TDS 194-O (other-transaction) are two separate deductions. Never merge or confuse them. TCS = cost to brand. TDS 194-O = income tax credit, not a cost.

---

## Rate Cards

- [2026-06-03] [rate-cards] [ACTIVE] Rate card selector standardized to single shared function selectActiveRateCardForOrder() in shared/rateCards/v2.ts. All three prior selection paths now use this. Tie-breaker: effective_from DESC, version_number DESC, created_at DESC.

- [2026-06-03] [rate-cards] [ACTIVE] Hard delete of rate cards blocked if used in reconciliation (returns 409 RATE_CARD_IN_USE). Reason: prevents silent corruption of reconciliation audit trail.

- [2026-06-03] [rate-cards] [ACTIVE] Destructive in-place edit of rate card financial fields blocked if used in reconciliation. Wizard creates new versions — never edits in place.

- [2026-09-24] [rate-cards] [ACTIVE] TCS percent on all rate cards is 0.5% (corrected from 1.0%). GST TCS rate reduced to 0.5% effective 10-Jul-2024 per Indian GST law.

- [2026-09-24] [rate-cards] [DEFERRED] Marketplace-specific rate card extension tables (amazon_rate_card_extensions, flipkart_rate_card_extensions). Current generic schema is sufficient for Amazon pilot. Build before Flipkart onboarding. Recommended: hybrid approach — common fields in rate_cards_v2, marketplace-specific in extension tables with JSONB for slabs/fees. Reason: fee models are structurally different per marketplace (not just different values).

- [2026-09-24] [rate-cards] [ACTIVE] Marketplace field in rate card wizard MUST be a dropdown (not free text). GAP-019. Free text allows typos that silently break rate card matching.

- [2026-09-24] [rate-cards] [ACTIVE] "Keep Both Active" option in rate card overlap modal must be removed. Overlapping active rate cards for same marketplace + category are never allowed. Only Cancel and Replace should exist.

---

## Settlement

- [2026-09-08] [settlement] [ACTIVE] Settlement upload is manual trigger — system does NOT auto-reconcile after upload. Reason: pilot brands need trust > automation. Settlement files can be incomplete or uploaded in batches.

- [2026-09-08] [settlement] [ACTIVE] Settlement files use soft delete (status = DELETED). Hard delete only if no reconciliation runs reference the file. Partial unique index on (tenant_id, marketplace, settlement_id) excludes DELETED rows — allows re-upload after deletion.

- [2026-09-08] [settlement] [ACTIVE] Settlement file deletion blocked if claims exist from the reconciliation run that used this file. Reason: claim evidence must remain intact.

- [2026-09-24] [settlement] [ACTIVE] Amazon settlement format is Flat File V2 (GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2), tab-delimited. Parser v8 handles all 24 columns, 27+ amount-description values, 3 date formats, integrity check. UNMAPPED bucket catches unknown descriptions — never fail on unknown.

- [2026-09-24] [settlement] [ACTIVE] Settlement integrity check: SUM(detail rows) must equal total-amount from summary row. Mismatch > ₹0.01 shows warning but does NOT fail the upload. Reason: partial settlements are valid; warn, don't block.

---

## Payment Status

- [2026-06-02] [reconciliation] [ACTIVE] MISSING and SETTLEMENT_NOT_UPLOADED are always distinct. MISSING = order reconciled, absent from uploaded settlement. SETTLEMENT_NOT_UPLOADED = no settlement file for that marketplace.

- [2026-06-02] [dashboard] [ACTIVE] "Missing = 3" in Recent Runs and "Missing Payment Orders = 6" are intentionally different. Tooltip explains scope. Do not merge.

---

## Claims

- [2026-06-02] [claims] [ACTIVE] Claims frozen at creation — evidence (calculation_breakdown, leakage amount, run_id) never mutated after creation.

- [2026-09-08] [claims] [ACTIVE] Claim states are 3-way: NOT_RAISED / DRAFT / SUBMITTED. Payment Reconciliation table shows different button/color per state.

- [2026-09-08] [claims] [ACTIVE] Stale rate card warning shown on DRAFT/READY_TO_SUBMIT claims when newer rate card exists for the order period. Confirmation required before submitting stale claim. Do not hard-block — let user proceed with warning.

- [2026-09-08] [claims] [ACTIVE] Claim prepare flow: generates claim text for user to copy into Amazon Seller Central manually. No direct Amazon API submission in MVP.

---

## Returns

- [2026-06-03] [returns] [ACTIVE] Returns page uses "Settlement Movement" framing — not "leakage" language. Settlement gap ≠ claimable leakage. Reason: we can't prove claimability from settlement data alone.

- [2026-06-03] [returns] [ACTIVE] No claim CTA on Settlement Movement tab. Claims for returns come from Operational Disputes tab (not yet built). Reason: settlement movement alone doesn't prove the marketplace made a claimable mistake.

- [2026-06-03] [returns] [ACTIVE] Operational Disputes tab is "Coming Soon" — requires WMS integration. Dispute types: in-transit overdue, delivered not received, wrong/damaged item, lost in transit.

- [2026-09-24] [returns] [ACTIVE] Returns data will eventually come from WMS integration (EasyEcom planned). CSV upload is temporary MVP path. No marketplace selector needed in UI — marketplace comes from CSV column.

---

## Dashboard

- [2026-06-02] [dashboard] [ACTIVE] GET /api/dashboard is the single dashboard endpoint. Do not create additional endpoints.

- [2026-06-03] [dashboard] [ACTIVE] Dashboard shows Fee Overcharge only (not Total Leakage). Return leakage removed until Returns module matures. Subtitle: "Marketplace fee mismatches".

- [2026-09-08] [dashboard] [ACTIVE] Dashboard date/status/claim filters show "SOON" — not functional yet. Do not show as active-looking dropdowns.

---

## UI / Design

- [2026-06-02] [design] [ACTIVE] Archived files (client/src/archive/) must never be modified or referenced.

- [2026-09-08] [design] [ACTIVE] "Engine B" language never shown to customers. Use "ReconEasy analysis" if a label is needed.

- [2026-09-08] [design] [ACTIVE] Confidence = MEDIUM shown with tooltip explaining what's missing. Never hidden. Never shown as ₹0 — show "Not evaluated" when logistics not calculated.

---

## How to append

At end of Claude/ChatGPT sessions:
```
Summarize locked decisions from this session for RECON_EASY_DECISIONS.md.
Format: [YYYY-MM-DD] [area] [ACTIVE/DEFERRED/SUPERSEDED] Decision — reason.
```
