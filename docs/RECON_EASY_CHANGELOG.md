# ReconEasy Changelog

---

## Unprocessed

_(empty — all entries processed into RECON_EASY_CONTEXT.md on 2026-09-24)_

---

## Processed

### 2026-06-02 — Dashboard frontend update
- [2026-06-02] [dashboard] Split leakage KPI into 3 cards: total (red), return (orange), fee overcharge (amber)
- [2026-06-02] [dashboard] Reconciliation health reads from reconciliation_health.matched / .mismatch / .missing_payment
- [2026-06-02] [dashboard] Recent Runs table: run_number as "Run #N", orders_matched (emerald), orders_overcharged (amber), orders_missing (red)
- [2026-06-02] [dashboard] Top Leakage Orders: leakage_type badge (RETURN_LEAKAGE=orange, FEE_OVERCHARGE=amber)
- [2026-06-02] [dashboard] Marketplace Health: fee_leakage as separate column from return_leakage
- [2026-06-02] [dashboard] Added instant CSS tooltip on Recent Runs "Missing" column header
- [2026-06-02] [dashboard] Fixed "Missing" column header alignment

### 2026-06-03 — Payment Reconciliation + Rate Card guards
- [2026-06-03] [payment-reconciliation] Table EXPECTED/CHARGED → EXPECTED PAYOUT / ACTUAL PAYOUT (net payout)
- [2026-06-03] [payment-reconciliation] Backend: added expected_net_payout and actual_net_payout to orders row endpoint
- [2026-06-03] [payment-reconciliation] Drawer: full visual redesign — width 440px → 600px, 7-section layout
- [2026-06-03] [payment-reconciliation] Drawer: "Why flagged" first, fee table 3 columns, confidence warning under table
- [2026-06-03] [payment-reconciliation] Drawer: Dispatched + Delivered date pills, rate card as clickable link
- [2026-06-03] [payment-reconciliation] Drawer: rupee/% amounts auto-bolded in why-flagged text
- [2026-06-03] [rate-cards] Removed destructive PUT /rate-cards-v2/:id route (P0-A)
- [2026-06-03] [rate-cards] Hard delete guarded — blocks if used in reconciliation, writes audit log (P0-B)
- [2026-06-03] [rate-cards] Rate card selector standardized to selectActiveRateCardForOrder() (P0-C)
- [2026-06-03] [rate-cards] Stale claim warning added on DRAFT/READY_TO_SUBMIT claims (P0-D)

### 2026-06-03 — Dashboard KPI + Returns redesign
- [2026-06-03] [dashboard] Removed Return Leakage KPI card and Total Leakage card
- [2026-06-03] [dashboard] Top Leakage Orders filtered to FEE_OVERCHARGE only with net payout columns
- [2026-06-03] [dashboard] Fee Overcharge subtitle: "Marketplace fee mismatches"
- [2026-06-03] [dashboard] Removed all "Engine B" customer-facing references
- [2026-06-03] [dashboard] Rate Card Coverage case-insensitive matching fixed
- [2026-06-03] [dashboard] Myntra hidden when no orders or rate cards
- [2026-06-03] [dashboard] Status/Claim Stages filters disabled with "SOON" badge
- [2026-06-03] [dashboard] Review → link navigates to /reconciliation?marketplace=amazon
- [2026-06-03] [dashboard] Import History collapsed behind toggle on Rate Cards page
- [2026-06-03] [returns] Full redesign: Settlement Movement + Operational Disputes tabs
- [2026-06-03] [returns] Dispute type auto-mapping from return_reason_desc
- [2026-06-03] [returns] No "leakage" language — Settlement Gap instead

### 2026-09-08 — Smoke test fixes
- [2026-09-08] [auth] Fixed shouldMount flag to prevent console errors on unauthenticated load
- [2026-09-08] [rate-cards] Dark mode fix across all 8 wizard steps
- [2026-09-08] [rate-cards] Rate card wizard shell dark mode completed
- [2026-09-08] [orders] Pagination fixed — was fake/static, now real currentPage state
- [2026-09-08] [orders] Chat widget no longer overlaps pagination (mb-16)
- [2026-09-08] [settlements] Settlement parser: horizontal metadata parsing fixed
- [2026-09-08] [settlements] Auto-reconciliation removed from upload flow
- [2026-09-08] [settlements] Delete button added with claims guard and audit log
- [2026-09-08] [settlements] Delete moved to ⋮ dropdown (not next to primary CTA)
- [2026-09-08] [settlements] Duplicate detection excludes DELETED files (partial unique index + migration 0022)
- [2026-09-08] [settlements] Edge Function deployed after parser fix
- [2026-09-08] [payment-reconciliation] Claim state 3-way: NOT_RAISED / DRAFT / SUBMITTED
- [2026-09-08] [payment-reconciliation] Row color changes based on claim state
- [2026-09-08] [claims] Success toast after claim creation
- [2026-09-08] [claims] "Submitted to marketplace · [date]" replaces missing button post-submission
- [2026-09-08] [claims] Stale rate card warning on DRAFT/SUBMITTED claims
- [2026-09-08] [search] Order result navigates to /data-hub?subtab=orders&search=<orderId>
- [2026-09-08] [search] Claim result navigates to /claims/<claimId>

### 2026-09-24 — Engine B v2 + Amazon settlement spec
- [2026-09-24] [rate-cards] TCS corrected from 1% to 0.5% on both Amazon and Flipkart rate cards
- [2026-09-24] [settlement-parser] Parser v8 deployed: tab/comma detection, all 24 Amazon V2 columns
- [2026-09-24] [settlement-parser] Full bucket mapping: 27 amount-descriptions → named buckets
- [2026-09-24] [settlement-parser] Multi-format date parsing (MM/DD/YY, YYYY-MM-DD, DD.MM.YYYY)
- [2026-09-24] [settlement-parser] Settlement integrity check (detail sum vs header total)
- [2026-09-24] [settlement-parser] fulfillment_id (AFN/MFN) stored per settlement line
- [2026-09-24] [engine-b] 9 components in calculation_breakdown: commission, commission_gst, closing_fee, closing_fee_gst, logistics, logistics_gst, tcs, tds_194o (informational), principal
- [2026-09-24] [engine-b] Net payout formula expanded: gross − commission − commission_gst − closing_fee − closing_fee_gst − logistics − logistics_gst − tcs
- [2026-09-24] [engine-b] TDS 194-O calculated informational only — not in net payout
- [2026-09-24] [engine-b] TCS now correctly matches at 0.5% per order
- [2026-09-24] [engine-b] Engine version updated to v2_typescript_amazon_v2
- [2026-09-24] [engine-b] 44 tests passing, 128 existing summaries unchanged

---

## How to append (add to every Codex prompt)

```
After completing the task, append one line to docs/RECON_EASY_CHANGELOG.md 
under ## Unprocessed:
[YYYY-MM-DD] [area] what changed
```
