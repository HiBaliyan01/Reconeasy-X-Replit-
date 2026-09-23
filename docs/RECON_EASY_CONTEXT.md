# ReconEasy — Context File
> Upload this file at the start of every new Claude session.
> Last consolidated: 2026-09-24

---

## 1. Product Vision

ReconEasy is a financial reconciliation platform for D2C brands selling on Indian marketplaces (Amazon, Flipkart, Myntra). It detects fee overcharges, missing payments, and return settlement gaps — and helps brands raise claims to recover money.

---

## 2. Current Stack

- **Frontend:** React + TypeScript + Tailwind — `client/src/`
- **Backend:** Express.js — `server/`
- **DB:** PostgreSQL via Supabase (Pro plan — upgrade from free to prevent auto-pause)
- **Reconciliation Engine:** Engine B v2 — TypeScript, lives in `shared/`
- **Settlement Parser:** Supabase Edge Function `process-settlement-upload` (v8)
- **Local dev:** localhost:9092
- **Tenant ID:** 1935f074-7acd-4799-8090-1f8cb085d1a4

---

## 3. Current Module Status

| Module | Status | Notes |
|--------|--------|-------|
| Dashboard | ✅ Complete | KPI cards, filters (SOON), charts, Marketplace Health |
| Orders | ✅ Working | 45 orders (25 Amazon pilot + 10 edge case + 10 Flipkart) |
| Settlements | ✅ Working | Delete + re-upload flow working, v8 parser deployed |
| Payment Reconciliation | ✅ Complete | Net payout table, full drawer redesign, 3-state claim buttons |
| Returns | ✅ Complete | Redesigned — Settlement Movement + Operational Disputes (Coming Soon) |
| Claims | ✅ Working | Full workflow: Draft → Prepare → Submit → Track |
| Rate Cards | ✅ Working | 2 active (Amazon 12%, Flipkart 10%), TCS corrected to 0.5% |
| Audit Log | ✅ Working | In Settings, logs all actions (user shows "System" — GAP-125) |
| Global Search | ✅ Working | Finds orders + claims, navigates correctly |
| Recent Summary Sidebar | ⏳ Needs real data | Shows revenue and matched % |
| Analytics / RIA | 🔒 Coming soon | Not in pilot scope |
| GST Summary | 🔒 Setup required | Not in pilot scope |
| Revenue by Category | 🔒 Setup required | Not in pilot scope |

---

## 4. Current Pilot Data State

```
Orders:           45 (25 Amazon pilot + 10 Amazon edge cases + 10 Flipkart)
Settlement:       SETTLE-REV-001-v3 (Amazon, 138 lines, tab-delimited, full V2 format)
Returns:          3 (1 settled, 2 needs review)
Rate Cards:       2 (Amazon 12%, Flipkart 10%) — TCS = 0.5% on both
Claims:           2 (AMZ-2026-51276: SUBMITTED ₹134.45, AMZ-2026-53582: DRAFT)

Latest Run:       Run #6
  run_id:         e987125d-84af-42a3-9db3-d6442f5a3706
  engine_version: v2_typescript_amazon_v2
  status:         COMPLETED
  matched:        20
  overcharged:    2
  missing:        10 (3 genuine + 7 edge case orders without settlement)
  exact_leakage:  ₹242.45

Overcharged orders:
  AMZ-2026-51276: commission ₹113.94 + commission GST ₹20.51 = ₹134.45
  AMZ-2026-53582: TBD (similar pattern)

Genuine missing:  AMZ-2026-48391, AMZ-2026-48527, AMZ-2026-48964
Flipkart orders:  SETTLEMENT_NOT_UPLOADED (no Flipkart settlement parser yet)

Return settlement gaps:
  RET-REV-1002 (AMZ-2026-52095): Partial Refund Posted, gap ₹499.88 — Needs Review  
  RET-REV-1003 (AMZ-2026-54308): Commission Not Reversed, gap ₹299.88 — Needs Review
  RET-REV-1001 (AMZ-2026-50142): Normal Customer Return — Settled
```

---

## 5. Architecture — LOCKED RULES

1. Engine B (v2_typescript_amazon_v2) is the reconciliation engine — NOT Postgres functions
2. Rate cards are brand-configured — never hardcode marketplace fee values
3. All Express routes use `pool.query()` directly — no Drizzle ORM
4. Run ID system — every run creates an immutable audit trail
5. `MISSING` vs `SETTLEMENT_NOT_UPLOADED` — always distinguish, never merge
6. TCS is brand-configured — engine reads from rate card (currently 0.5% per GST TCS law since Jul 2024)
7. Claims are frozen at creation — never mutate claim evidence after creation
8. `GET /api/dashboard` is the single dashboard endpoint — do not create new endpoints
9. Archived files in `client/src/archive/` must never be touched
10. Settlement files that have been used in reconciliation with existing claims cannot be hard deleted — use soft delete (status = DELETED)
11. Rate cards used in reconciliation cannot be edited in place — create new version
12. Hard delete of rate cards blocked if used in reconciliation (returns 409)

---

## 6. Engine B v2 — What It Calculates

```
gross_order_value    = selling_price × quantity
expected_commission  = gross × commission_percent (flat or tiered slab)
expected_commission_gst = expected_commission × gst_percent (18%)
expected_closing_fee = from rate_card_fees (by fulfillment_type + price_band)
                       → MEDIUM confidence if no rule found (current pilot state)
expected_closing_fee_gst = expected_closing_fee × gst_percent
expected_logistics   = from rate_card_logistics_slabs (weight × zone)
                       → "Not evaluated" if zone not captured
expected_logistics_gst = expected_logistics × gst_percent
expected_tcs         = gross × tcs_percent (0.5% since Jul 2024)
expected_tds_194o    = gross × 0.001 (0.1% since Oct 2024) — INFORMATIONAL ONLY
expected_net_payout  = gross − commission − commission_gst − closing_fee
                       − closing_fee_gst − logistics − logistics_gst − tcs

confidence = HIGH   (all fee rules configured)
           = MEDIUM (closing_fee rule missing — current pilot state)
           = LOW    (multiple rules missing)
```

**9 components stored in calculation_breakdown JSON per order:**
commission, commission_gst, closing_fee, closing_fee_gst,
logistics, logistics_gst, tcs, tds_194o (informational), principal

**Known limitations — acceptable for pilot:**
- `rate_card_fees` has 0 rows → closing fee not tracked → confidence = MEDIUM
- Delivery zone not captured → logistics = "Not evaluated"
- TDS 194-O calculated but informational only — not included in net payout

---

## 7. Amazon Settlement Parser v8

File: `supabase/functions/process-settlement-upload/index.ts`
**Must be deployed to Supabase after any changes:** `supabase functions deploy process-settlement-upload`

**Format:** Amazon Flat File V2 (`GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2`)
- Tab-delimited (real Amazon exports) — parser auto-detects tab vs comma
- Row 1: header, Row 2: summary (cols 1-6 only), Rows 3+: detail
- 24 columns including: settlement-id, transaction-type, order-id, amount-type, amount-description, amount, fulfillment-id, posted-date, sku

**Bucket mapping (amount-description → bucket):**

| amount-description | Bucket | Sign |
|---|---|---|
| Principal (ItemPrice) | PRINCIPAL | + |
| Commission (ItemFees) | COMMISSION | - |
| Commission IGST/CGST/SGST | COMMISSION_GST | - |
| Fixed closing fee | CLOSING_FEE | - |
| Fixed closing fee IGST | CLOSING_FEE_GST | - |
| FBA Weight Handling Fee | WEIGHT_HANDLING | - |
| FBA Weight Handling Fee IGST | WEIGHT_HANDLING_GST | - |
| Easy Ship weight handling fees | EASY_SHIP_WEIGHT | - |
| Easy Ship weight handling fees IGST | EASY_SHIP_WEIGHT_GST | - |
| FBA Pick & Pack Fee | PICK_PACK | - |
| TCS-IGST / TCS-CGST / TCS-SGST (ItemWithheldTax) | TCS | - |
| TDS - Section 194-O (other-transaction) | TDS_194O | - |
| Refund — Principal | REFUND_PRINCIPAL | - |
| Refund — Commission | REFUND_COMMISSION | + |
| Current Reserve Amount | RESERVE_DEBIT | - |
| Previous Reserve Amount Balance | RESERVE_CREDIT | + |
| Unknown | UNMAPPED | (never fail) |

**Tax rates (per Indian law):**
- GST TCS: 0.5% (0.25 CGST + 0.25 SGST or 0.5 IGST) — since 10-Jul-2024
- TDS 194-O: 0.1% of gross — since 1-Oct-2024
- GST on Amazon fees: 18%

**Integrity check:** After parsing, verifies SUM(detail rows) = total-amount from summary. Shows warning if mismatch > ₹0.01 but does NOT fail the upload.

---

## 8. Key Files

```
client/src/components/Dashboard.tsx
client/src/components/OrdersUpload.tsx
client/src/components/SettlementPage.tsx
client/src/pages/financial-intelligence/PaymentReconciliation.tsx
client/src/pages/Returns.tsx
client/src/components/claims/ClaimsPage.tsx
client/src/components/claims/ClaimDetails.tsx
client/src/components/claims/PrepareClaimModal.tsx

shared/rateCards/v2.ts                          ← selectActiveRateCardForOrder() — single selector
shared/reconciliation/computeExpectedPayout.ts   ← Engine B v2 calculations
server/routes/reconciliation.ts                  ← all reconciliation + claims API routes
server/src/routes/rateCards.ts                   ← rate card CRUD with guards
supabase/functions/process-settlement-upload/    ← Edge Function v8

client/src/archive/  ← DO NOT TOUCH
docs/               ← context files, gap sheet, architecture docs
```

---

## 9. Database — Key Notes

```
orders table: No order_date column (created_at ≠ customer order date)
rate_cards_v2: tcs_percent = 0.5 (corrected from 1.0 on 2026-09-24)
uploaded_files: soft delete via status = 'DELETED' (partial unique index excludes DELETED)
reconciliation_runs: linked to uploaded_files via settlement_id text (no FK)
claims: ON DELETE RESTRICT on reconciliation_run_id — cannot delete runs with claims
```

**Rate card selection — single shared function:**
All three prior selection paths now use `selectActiveRateCardForOrder()` in `shared/rateCards/v2.ts`
Selection rule: marketplace + category + archived=false + effective date coverage
Tie-breaker: `effective_from DESC, version_number DESC, created_at DESC`

---

## 10. Smoke Test — Completed 2026-09-24

Full pilot smoke test completed. 105 gaps found, 35 fixed during test.
Gap sheet: `docs/RECON_EASY_GAP_SHEET.md`

**Key findings:**
- Engine B v2 producing correct results with full Amazon V2 settlement data
- TCS was wrong at 1% — corrected to 0.5%
- Settlement parser was missing Commission GST, TCS, closing fee GST lines — all added
- Overcharge now correctly calculated as commission + commission GST
- Claims workflow fully functional end to end
- Returns page redesigned to Settlement Movement + Operational Disputes

---

## 11. Payment Reconciliation — Current State

### Claim States (3-state system)
- `NOT_RAISED` → "Create Claim" button (teal)
- `DRAFT` → "View Claim" button (slate, teal left border on row)
- `SUBMITTED` → "✓ Claim Submitted" (teal, with checkmark)

### Order Detail Drawer (w-[600px])
9 fee components shown: commission, commission_gst, closing_fee, closing_fee_gst,
logistics, logistics_gst, tcs, tds_194o (informational), principal

---

## 12. Returns — Current State

**Tabs:** Settlement Movement (active) | Operational Disputes (Coming Soon — WMS required)

**Settlement Movement columns:**
Return ID / Order ID / SKU / Return Date / Dispute Type / Settlement Movement / Settlement Gap / Status / Action

**Dispute Types (auto-mapped from return_reason_desc):**
- "commission reversal missing" → "Commission Not Reversed"
- "partial refund" → "Partial Refund Posted"
- default → "Normal Customer Return"

**Status:** Needs Review (amber) | Settled (green) | Pending (slate)
**Actions:** View | Mark Reviewed | Link to Dispute (Coming Soon)

---

## 13. Locked Product Decisions

See `RECON_EASY_DECISIONS.md` for full log.

**Architecture:**
1. Engine B v2 only — Engine A deprecated
2. MISSING ≠ SETTLEMENT_NOT_UPLOADED — always distinct
3. Claims frozen at creation — evidence never mutated
4. Rate card selector standardized to single shared function
5. Hard delete blocked for rate cards used in reconciliation (409)
6. Settlement file soft delete — status = DELETED, not hard delete
7. Duplicate settlement detection excludes DELETED files (partial unique index)

**Product:**
8. TCS = 0.5% (GST TCS since Jul 2024) and TDS = 0.1% (194-O since Oct 2024) are separate
9. TDS 194-O is informational only — not included in expected net payout
10. Confidence MEDIUM acceptable for pilot (closing fee not configured)
11. Rate card architecture: marketplace-specific extension tables planned post-pilot
12. Marketplace dropdown in rate card wizard must be a dropdown (not free text) — GAP-019
13. "Keep Both Active" must be removed from overlap modal — GAP-047
14. Returns page uses Settlement Movement framing — not "leakage" language
15. Claim prepare flow: copy text to Amazon Seller Central manually (no direct API)
16. Settlement upload is manual trigger — no auto-reconciliation on upload

---

## 14. Current P0 (Must Complete Before Pilot)

- [x] Dashboard frontend — all sections updated ✅
- [x] Dashboard backend — correct Engine B data ✅
- [x] Payment Reconciliation table — net payout columns ✅
- [x] Payment Reconciliation drawer — full redesign ✅
- [x] Claims workflow — full end to end ✅
- [x] Returns page — redesigned to Settlement Movement ✅
- [x] TCS rate corrected to 0.5% ✅
- [x] Settlement parser v8 — full Amazon V2 support ✅
- [x] Engine B v2 — 9 components, correct GST formula ✅
- [x] Rate card architecture guards (P0-A through P0-D) ✅
- [x] Smoke test completed ✅
- [ ] GAP-019: Marketplace field must be dropdown (not free text)
- [ ] GAP-047: Remove "Keep Both Active" from overlap modal
- [ ] GAP-027: Add closing fee rules to rate_card_fees (MEDIUM → HIGH confidence)
- [ ] GAP-131: Verify/fix Leakage chart showing wrong amount
- [ ] GAP-125: Audit log showing "System" not actual user name
- [ ] GAP-091: Dashboard date filter not working
- [ ] Fix settlement file header total (v3 integrity warning — detail sum ≠ header)

## 15. Post-Pilot (P1/P2/Later)

- Rate card marketplace-specific extension tables (amazon_rate_card_extensions etc.)
- Rate card overlap detection with tenant_id filter
- Rate card snapshot including slabs and fees
- Stale claim warning when rate card changes post-claim
- Dashboard full redesign
- Flipkart settlement parser
- Operational Disputes tab (WMS integration)
- EasyEcom integration (Phase planned)
- Auto-reconciliation trigger after settlement upload (optional setting)
- Daily reminder for pending reconciliation
- Order date column in orders table
- Row actions (view/edit/more) on Orders page
- Order import UI/UX redesign

---

## 16. Tooling Notes

- **Codex** for all file edits — read-and-report before every change
- **ChatGPT** for product decisions — flag explicitly in session
- **This file** is the single source of truth — upload at every new session start
- **Standard prompts** in `docs/STANDARD_PROMPTS.md`
- After every Codex task: append to `docs/RECON_EASY_CHANGELOG.md`
- End of session: update context files

---

## 17. Last Consolidated

Updated through: 2026-09-24
Sources: Smoke test session + Amazon settlement spec + Engine B v2 implementation
