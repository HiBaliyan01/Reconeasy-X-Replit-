# ReconEasy Context

Last updated: 2026-06-01

This document is the handoff context for continuing development in this repository.

## 1. Project Overview

**Product name:** ReconEasy

**What it does:** ReconEasy helps ecommerce brands reconcile marketplace payouts. It compares brand-configured marketplace rate cards against uploaded settlement data, identifies fee overcharges, missing payouts, return/refund leakage, and turns claimable issues into marketplace claims with frozen evidence.

**Who it is for:** Finance, operations, and marketplace teams at ecommerce brands selling on Amazon, Flipkart, Myntra, and similar marketplaces. The current pilot brand is Reverie Apparel Co.

**Tech stack:**

- Frontend: React 18, TypeScript, Tailwind CSS, Vite, lucide-react, recharts/chart.js.
- Backend: Express, TypeScript, Node/tsx.
- Database: PostgreSQL via Supabase connection pooler.
- Supabase: database, uploaded file settlement data, legacy Edge Functions still present but Engine B is now the active reconciliation path.
- ORM status: Drizzle exists in shared schema and legacy rate-card routes, but new reconciliation/dashboard/claims route work should use `pool.query()` directly.

**Local dev:**

- Run: `npm run dev`
- Default preferred URL: `http://localhost:9092`
- The server falls forward if the port is busy, e.g. `9093`, `9094`, `9095`.
- Type check: `npm run check`

**Pilot tenant ID:**

```text
1935f074-7acd-4799-8090-1f8cb085d1a4
```

Tenant constants:

- Frontend: `client/src/config/tenant.ts`
- Backend: `server/config/tenant.ts`

## 2. Architecture Decisions

These are locked. Do not change them without explicit product decision.

1. **Engine B is the reconciliation engine.**
   - Engine B is TypeScript code running in-process in Express.
   - It replaces Engine A Supabase Edge Function calls for payment reconciliation.
   - Engine A code remains as commented fallback / legacy reference only.

2. **Rate cards are brand-configured.**
   - Never hardcode marketplace fee values in the engine.
   - Marketplace-specific rates, TCS, GST, settlement timelines, and fee rules must come from rate-card tables.
   - If a rate rule is missing, surface confidence and missing rule warnings instead of inventing a value.

3. **Routes use `pool.query()` directly for database writes/reads.**
   - Especially for `server/routes/reconciliation.ts`, use raw SQL through `pool.query()`.
   - Do not add new Drizzle ORM route logic in reconciliation/dashboard/claims routes.
   - Note: legacy rate-card route code still uses Drizzle in places; do not extend that pattern for new reconciliation work.

4. **Run ID system is mandatory.**
   - Every reconciliation run creates a `reconciliation_runs` row.
   - Every order summary links to a run via `run_id`.
   - Every fee component links to a run and summary.
   - Run snapshots and calculation hashes are part of the audit trail.

5. **MISSING vs SETTLEMENT_NOT_UPLOADED distinction is required.**
   - `MISSING` / `MISSING_PAYMENT`: settlement file exists for the relevant period, but no payment was found for the order.
   - `SETTLEMENT_NOT_UPLOADED`: no settlement file exists for the relevant marketplace/period, so the missing payout is not yet claim-confirmed.
   - UI should allow claims only for confirmed missing payments, not upload-needed rows.

6. **Claim evidence freezes at creation time.**
   - Claim records carry an `evidence_snapshot`.
   - Future recalculation should not silently mutate already-created claim evidence.

## 3. Current State: Built and Working

### Dashboard

- UI: `client/src/components/Dashboard.tsx`
- API: `GET /api/dashboard` in `server/routes/reconciliation.ts`
- Current dashboard reads:
  - Total revenue from all orders using `selling_price * quantity`.
  - Combined leakage from returns and Engine B fee overcharges.
  - Missing payment totals from the missing-payment evaluator.
  - Reconciliation health from latest completed Engine B run.
  - Recent runs filtered to meaningful Engine B completed runs.
  - Top leakage orders merged from returns and Engine B fee overcharges.

### Payment Reconciliation Page

- UI: `client/src/pages/financial-intelligence/PaymentReconciliation.tsx`
- Route: `/reconciliation`
- Old component archived: `client/src/archive/PaymentReconciliation.tsx`
- Mounted from: `client/src/App.tsx`
- APIs used:
  - `GET /api/reconciliation/orders`
  - `GET /api/claims/payment-alerts`
  - `GET /api/reconciliation/summary`
  - `GET /api/reconciliation/last-run`
  - `GET /api/reconciliation/order/:orderId`
  - `POST /api/claims`
  - `POST /api/reconciliation/run`
- Built features:
  - Recoverable hero.
  - KPI tiles.
  - Discrepancy and missing payment tabs.
  - Include matched orders toggle.
  - Row drawer with Engine B `calculation_breakdown`.
  - Confirm modal for create-all-claims.
  - Bulk selection and bulk claim bar.
  - Toasts after claim actions.
  - Missing payment drawer distinguishes Amazon confirmed missing vs Flipkart upload-needed.

### Engine B Reconciliation

- Core expected payout: `shared/reconciliation/computeExpectedPayout.ts`
- Rate-card lookup: `shared/rateCards/v2.ts`
- Order-level recon wrapper: `server/src/reconciliation/reconcileOrder.ts`
- Calculation JSON/hash helper: `server/src/reconciliation/buildCalculationBreakdown.ts`
- Run handler: `POST /api/reconciliation/run` in `server/routes/reconciliation.ts`
- Detail endpoint: `GET /api/reconciliation/order/:orderId` in `server/routes/reconciliation.ts`
- Engine B writes:
  - `reconciliation_runs`
  - `reconciliation_order_summary`
  - `reconciliation_fee_components`

### Rate Cards

- Main UI: `client/src/pages/RateCardV2Page.tsx`
- Add/edit wizard: `client/src/pages/RateCards/AddRateCardWizard/index.tsx`
- Publish summary: `client/src/pages/RateCards/components/PublishSummaryCard.tsx`
- Backend: `server/src/routes/rateCards.ts`
- Shared transforms and lookup: `shared/rateCards/v2.ts`
- Supports:
  - Flat commission.
  - Tiered commission slab storage via `rate_card_slabs`.
  - GST percent.
  - TCS percent.
  - T+ settlement rules and grace days.
  - Fee rules table exists for closing/platform/collection fees but pilot has no data yet.

### Claims

- List UI: `client/src/components/claims/ClaimsPage.tsx`
- Detail UI: `client/src/components/claims/ClaimDetails.tsx`
- Prepare claim modal: `client/src/components/claims/PrepareClaimModal.tsx`
- Backend endpoints: claims section in `server/routes/reconciliation.ts`
- Current pilot claims:
  - 2 commission overcharge claims.
  - 3 payment-not-received claims.
  - All are DRAFT.

### Settlement Uploads / Data Hub

- Settlement UI: `client/src/components/SettlementPage.tsx`
- Orders upload UI: `client/src/components/OrdersUpload.tsx`
- Returns UI: `client/src/pages/Returns.tsx`
- Settlement endpoints:
  - `GET /api/settlements/files`
  - upload route in `server/routes/reconciliation.ts`
  - legacy/modular settlement routes also exist in `server/routes.ts` and `server/src/routes/rateCards.ts`

### Reconciliation Settings

- UI: `client/src/components/ReconciliationSettings.tsx`
- Backend:
  - `GET /api/settings/reconciliation`
  - `PATCH /api/settings/reconciliation`
- Stores missing payment rules, leakage sensitivity, and rate-card conflict behavior.

### Audit Trail / Users

- Audit dashboard: `client/src/components/AuditTrailDashboard.tsx`
- Audit tab: `client/src/components/AuditLogTab.tsx`
- User management: `client/src/components/UserManagement.tsx`
- Backend:
  - `GET /api/audit-log`
  - `GET /api/users`
  - `GET /api/users/by-auth-id`
  - `PATCH /api/users/:id`
  - `DELETE /api/users/:id`

## 4. Database Schema

### All public tables

Query:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Output:

```text
          table_name
-------------------------------
 alerts
 audit_log
 claim_batches
 claim_comments
 claims
 fee_code_library
 integration_votes
 latest_reconciliation_runs
 latest_reconciliation_summary
 orders
 products
 profiles
 rate_card_data
 rate_card_fees
 rate_card_logistics_slabs
 rate_card_slabs
 rate_card_templates
 rate_cards
 rate_cards_v2
 rate_cards_view
 reconciliation_fee_components
 reconciliation_order_summary
 reconciliation_runs
 reconciliation_settings
 reconciliations_v0
 returns
 settlement_fee_lines
 settlements
 uploaded_files
 user_profiles
 users
(31 rows)
```

### Key table columns

Query:

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
  'orders',
  'settlement_fee_lines',
  'uploaded_files',
  'rate_cards_v2',
  'rate_card_fees',
  'rate_card_slabs',
  'rate_card_logistics_slabs',
  'reconciliation_runs',
  'reconciliation_order_summary',
  'reconciliation_fee_components',
  'claims',
  'claim_items',
  'returns',
  'reconciliation_settings',
  'audit_log',
  'user_profiles'
)
ORDER BY table_name, ordinal_position;
```

Important note: `claim_items` does not currently exist.

Output:

```text
audit_log: id uuid not null default uuid_generate_v4()
audit_log: tenant_id text not null
audit_log: user_profile_id uuid nullable
audit_log: user_name text nullable
audit_log: action text not null
audit_log: module text not null
audit_log: entity_type text nullable
audit_log: entity_id text nullable
audit_log: description text not null
audit_log: metadata jsonb nullable
audit_log: status text not null default 'success'
audit_log: created_at timestamptz nullable default now()

claims: id uuid not null default gen_random_uuid()
claims: tenant_id text not null
claims: marketplace text not null
claims: order_id text not null
claims: bucket text not null
claims: claim_amount numeric not null
claims: expected_amount numeric not null
claims: actual_amount numeric not null
claims: discrepancy_amount numeric not null
claims: claim_status text not null default 'DRAFT'
claims: reconciliation_run_id uuid not null
claims: reconciliation_component_id uuid nullable
claims: uploaded_file_id uuid nullable
claims: marketplace_ticket_id text nullable
claims: claim_reason text nullable
claims: evidence_snapshot jsonb nullable
claims: created_by text nullable
claims: submitted_at timestamptz nullable
claims: recovered_at timestamptz nullable
claims: created_at timestamptz not null default now()
claims: updated_at timestamptz not null default now()
claims: batch_id uuid nullable
claims: group_key text nullable
claims: zone text nullable
claims: resolution_status text nullable default 'PENDING'
claims: resolution_updated_at timestamptz nullable

orders: id uuid not null default uuid_generate_v4()
orders: brand_id text nullable default 'default-brand'
orders: order_id text not null
orders: sku text not null
orders: quantity integer not null
orders: selling_price double precision nullable
orders: dispatch_date date nullable
orders: order_status text nullable
orders: marketplace text nullable
orders: created_at timestamptz nullable default now()
orders: delivery_date date nullable
orders: category_id text nullable
orders: weight_grams integer nullable
orders: tenant_id text not null
orders: updated_at timestamptz nullable default now()
orders: operational_status text nullable
orders: fulfillment_type text nullable

rate_card_fees: id uuid not null default uuid_generate_v4()
rate_card_fees: rate_card_id uuid not null
rate_card_fees: fee_code text not null
rate_card_fees: fee_type text not null
rate_card_fees: fee_value numeric not null
rate_card_fees: applies_to_fulfillment_type text nullable
rate_card_fees: min_price numeric nullable
rate_card_fees: max_price numeric nullable
rate_card_fees: effective_from date nullable
rate_card_fees: effective_to date nullable
rate_card_fees: is_active boolean nullable default true
rate_card_fees: tenant_id text nullable

rate_card_logistics_slabs: id uuid not null default gen_random_uuid()
rate_card_logistics_slabs: rate_card_id uuid not null
rate_card_logistics_slabs: marketplace text not null
rate_card_logistics_slabs: weight_min_grams integer not null
rate_card_logistics_slabs: weight_max_grams integer not null
rate_card_logistics_slabs: zone text not null default 'national'
rate_card_logistics_slabs: service_level text nullable default 'standard'
rate_card_logistics_slabs: forward_fee numeric not null
rate_card_logistics_slabs: reverse_fee numeric nullable
rate_card_logistics_slabs: effective_from date not null
rate_card_logistics_slabs: effective_to date nullable
rate_card_logistics_slabs: created_at timestamptz nullable default now()
rate_card_logistics_slabs: base_weight_grams integer nullable
rate_card_logistics_slabs: forward_fee_per_kg numeric nullable
rate_card_logistics_slabs: reverse_fee_per_kg numeric nullable
rate_card_logistics_slabs: fulfillment_type text nullable
rate_card_logistics_slabs: is_active boolean nullable default true
rate_card_logistics_slabs: tenant_id text nullable

rate_card_slabs: id uuid not null default uuid_generate_v4()
rate_card_slabs: rate_card_id uuid not null
rate_card_slabs: min_price numeric not null default 0
rate_card_slabs: max_price numeric nullable
rate_card_slabs: commission_percent numeric not null
rate_card_slabs: tenant_id text nullable

rate_cards_v2: id uuid not null default uuid_generate_v4()
rate_cards_v2: platform_id text not null
rate_cards_v2: category_id text not null
rate_cards_v2: commission_type text not null
rate_cards_v2: commission_percent numeric nullable
rate_cards_v2: gst_percent numeric not null default 18
rate_cards_v2: tcs_percent numeric not null default 1
rate_cards_v2: settlement_basis text not null
rate_cards_v2: t_plus_days integer not null
rate_cards_v2: weekly_weekday integer nullable
rate_cards_v2: bi_weekly_weekday integer nullable
rate_cards_v2: bi_weekly_which text nullable
rate_cards_v2: monthly_day text nullable
rate_cards_v2: grace_days integer not null default 0
rate_cards_v2: effective_from date not null
rate_cards_v2: effective_to date nullable
rate_cards_v2: global_min_price numeric nullable
rate_cards_v2: global_max_price numeric nullable
rate_cards_v2: notes text nullable
rate_cards_v2: created_at timestamptz nullable default now()
rate_cards_v2: updated_at timestamptz nullable default now()
rate_cards_v2: archived boolean not null default false
rate_cards_v2: template_type text nullable
rate_cards_v2: template_version text nullable
rate_cards_v2: uploaded_by text nullable
rate_cards_v2: source_upload_id uuid nullable
rate_cards_v2: raw_payload jsonb nullable
rate_cards_v2: version_number integer not null default 1
rate_cards_v2: tenant_id text not null

reconciliation_fee_components: id uuid not null default gen_random_uuid()
reconciliation_fee_components: tenant_id text not null
reconciliation_fee_components: marketplace text not null
reconciliation_fee_components: order_id text not null
reconciliation_fee_components: run_id uuid nullable
reconciliation_fee_components: bucket text not null
reconciliation_fee_components: expected_amount numeric not null default 0
reconciliation_fee_components: actual_amount numeric not null default 0
reconciliation_fee_components: created_at timestamptz not null default now()
reconciliation_fee_components: discrepancy_amount numeric nullable
reconciliation_fee_components: reconciliation_order_summary_id uuid nullable
reconciliation_fee_components: component_code text nullable
reconciliation_fee_components: component_label text nullable
reconciliation_fee_components: calculation_method text nullable
reconciliation_fee_components: source_table text nullable
reconciliation_fee_components: source_id uuid nullable
reconciliation_fee_components: source_version integer nullable
reconciliation_fee_components: confidence text nullable default 'MEDIUM'
reconciliation_fee_components: metadata jsonb nullable

reconciliation_order_summary: id uuid not null default gen_random_uuid()
reconciliation_order_summary: tenant_id text not null
reconciliation_order_summary: marketplace text not null
reconciliation_order_summary: run_id uuid not null
reconciliation_order_summary: order_id text not null
reconciliation_order_summary: expected_commission numeric not null
reconciliation_order_summary: actual_commission numeric not null
reconciliation_order_summary: commission_discrepancy numeric nullable
reconciliation_order_summary: status text not null
reconciliation_order_summary: created_at timestamptz nullable default now()
reconciliation_order_summary: expected_logistics numeric nullable
reconciliation_order_summary: actual_logistics numeric nullable
reconciliation_order_summary: logistics_discrepancy numeric nullable
reconciliation_order_summary: logistics_status text nullable
reconciliation_order_summary: rate_card_id uuid nullable
reconciliation_order_summary: rate_card_version integer nullable
reconciliation_order_summary: fulfillment_type text nullable
reconciliation_order_summary: expected_payout_date date nullable
reconciliation_order_summary: gross_order_value numeric nullable
reconciliation_order_summary: expected_gst numeric nullable default 0
reconciliation_order_summary: actual_gst numeric nullable default 0
reconciliation_order_summary: gst_discrepancy numeric nullable default 0
reconciliation_order_summary: expected_tcs numeric nullable default 0
reconciliation_order_summary: actual_tcs numeric nullable default 0
reconciliation_order_summary: tcs_discrepancy numeric nullable default 0
reconciliation_order_summary: expected_closing_fee numeric nullable default 0
reconciliation_order_summary: actual_closing_fee numeric nullable default 0
reconciliation_order_summary: closing_fee_discrepancy numeric nullable default 0
reconciliation_order_summary: expected_net_payout numeric nullable
reconciliation_order_summary: actual_net_payout numeric nullable
reconciliation_order_summary: claim_readiness text nullable default 'NEEDS_REVIEW'
reconciliation_order_summary: confidence text nullable default 'MEDIUM'
reconciliation_order_summary: matched_settlement_line_ids jsonb nullable
reconciliation_order_summary: missing_rule_codes text[] nullable
reconciliation_order_summary: calculation_breakdown jsonb nullable
reconciliation_order_summary: calculation_hash text nullable
reconciliation_order_summary: engine_version text nullable

reconciliation_runs: id uuid not null default gen_random_uuid()
reconciliation_runs: parent_run_id uuid nullable
reconciliation_runs: trigger_type text nullable
reconciliation_runs: status text nullable default 'STARTED'
reconciliation_runs: is_latest boolean nullable default false
reconciliation_runs: created_at timestamptz nullable default now()
reconciliation_runs: completed_at timestamptz nullable
reconciliation_runs: total_orders_processed integer nullable default 0
reconciliation_runs: affected_orders_count integer nullable default 0
reconciliation_runs: failure_reason text nullable
reconciliation_runs: input_orders_count integer nullable
reconciliation_runs: input_orders_last_updated timestamptz nullable
reconciliation_runs: input_settlements_count integer nullable
reconciliation_runs: input_settlements_last_updated timestamptz nullable
reconciliation_runs: input_rate_cards_count integer nullable
reconciliation_runs: input_rate_cards_last_updated timestamptz nullable
reconciliation_runs: tenant_id text not null
reconciliation_runs: marketplace text nullable
reconciliation_runs: settlement_id text nullable
reconciliation_runs: started_at timestamptz nullable default now()
reconciliation_runs: run_number integer not null
reconciliation_runs: run_scope text nullable default 'FULL'
reconciliation_runs: rerun_reason text nullable
reconciliation_runs: triggered_by text nullable
reconciliation_runs: settlement_period_from date nullable
reconciliation_runs: settlement_period_to date nullable
reconciliation_runs: orders_processed integer nullable default 0
reconciliation_runs: orders_matched integer nullable default 0
reconciliation_runs: orders_overcharged integer nullable default 0
reconciliation_runs: orders_undercharged integer nullable default 0
reconciliation_runs: orders_missing integer nullable default 0
reconciliation_runs: orders_not_in_settlement integer nullable default 0
reconciliation_runs: orders_error integer nullable default 0
reconciliation_runs: claimable_order_count integer nullable default 0
reconciliation_runs: exact_leakage numeric nullable default 0
reconciliation_runs: estimated_leakage numeric nullable default 0
reconciliation_runs: currency text nullable default 'INR'
reconciliation_runs: engine_version text nullable
reconciliation_runs: rate_card_snapshot jsonb nullable
reconciliation_runs: rate_card_snapshot_hash text nullable
reconciliation_runs: warning_count integer nullable default 0
reconciliation_runs: data_quality_warnings jsonb nullable
reconciliation_runs: metadata jsonb nullable

reconciliation_settings: id uuid not null default uuid_generate_v4()
reconciliation_settings: tenant_id text not null
reconciliation_settings: missing_payment_rules jsonb not null
reconciliation_settings: leakage_sensitivity jsonb not null
reconciliation_settings: rate_card_conflict_behavior text not null default 'warn_only'
reconciliation_settings: created_at timestamptz nullable default now()
reconciliation_settings: updated_at timestamptz nullable default now()

returns: id uuid not null default uuid_generate_v4()
returns: marketplace text not null
returns: order_id text not null
returns: return_id text not null
returns: sku text not null
returns: qty_returned integer not null
returns: return_type text nullable
returns: return_reason_code text nullable
returns: return_reason_desc text nullable
returns: return_date date nullable
returns: refund_amount double precision nullable
returns: return_status text nullable
returns: received_date_wh date nullable
returns: qc_result text nullable
returns: disposition text nullable
returns: commission_reversal double precision nullable
returns: logistics_reversal double precision nullable
returns: other_fee_reversal double precision nullable
returns: settlement_ref_id text nullable
returns: utr_number text nullable
returns: refund_mode text nullable
returns: pickup_date date nullable
returns: pickup_partner text nullable
returns: customer_pin text nullable
returns: warehouse_code text nullable
returns: brand_sku text nullable
returns: asin_style_code text nullable
returns: evidence_url text nullable
returns: claim_deadline date nullable
returns: claim_status text nullable
returns: claim_amount_requested double precision nullable
returns: claim_amount_approved double precision nullable
returns: created_at timestamptz nullable default now()
returns: tenant_id text not null
returns: fulfillment_type text nullable
returns: claim_id uuid nullable
returns: reimbursement_claim_status text nullable
returns: reimbursement_amount numeric nullable
returns: expected_refund_amount numeric nullable
returns: expected_commission_reversal numeric nullable
returns: expected_logistics_reversal numeric nullable
returns: reconciliation_status text nullable default 'pending'
returns: leakage_amount numeric nullable
returns: refund_leakage numeric nullable
returns: commission_leakage numeric nullable
returns: logistics_leakage numeric nullable

settlement_fee_lines: id uuid not null default gen_random_uuid()
settlement_fee_lines: uploaded_file_id uuid not null
settlement_fee_lines: tenant_id text not null
settlement_fee_lines: marketplace text not null
settlement_fee_lines: settlement_id text nullable
settlement_fee_lines: posted_date date nullable
settlement_fee_lines: payout_date date nullable
settlement_fee_lines: transaction_type text nullable
settlement_fee_lines: raw_amount_type text nullable
settlement_fee_lines: raw_amount_description text nullable
settlement_fee_lines: order_id text nullable
settlement_fee_lines: adjustment_id text nullable
settlement_fee_lines: sku text nullable
settlement_fee_lines: quantity_purchased integer nullable
settlement_fee_lines: bucket text not null
settlement_fee_lines: amount numeric not null
settlement_fee_lines: currency text nullable default 'INR'
settlement_fee_lines: is_reconcilable boolean not null default true
settlement_fee_lines: created_at timestamptz not null default now()
settlement_fee_lines: order_item_id text nullable

uploaded_files: id uuid not null default gen_random_uuid()
uploaded_files: tenant_id text not null
uploaded_files: marketplace text not null
uploaded_files: settlement_id text nullable
uploaded_files: file_name text nullable
uploaded_files: file_source text nullable default 'manual_upload'
uploaded_files: storage_path text nullable
uploaded_files: uploaded_by text nullable
uploaded_files: status text not null default 'UPLOADED'
uploaded_files: row_count integer nullable
uploaded_files: error_message text nullable
uploaded_files: processed_at timestamptz nullable
uploaded_files: settlement_start_date date nullable
uploaded_files: settlement_end_date date nullable
uploaded_files: created_at timestamptz not null default now()
uploaded_files: updated_at timestamptz not null default now()

user_profiles: id uuid not null default uuid_generate_v4()
user_profiles: auth_user_id uuid nullable
user_profiles: tenant_id text not null
user_profiles: full_name text nullable
user_profiles: email text not null
user_profiles: role text not null default 'analyst'
user_profiles: department text nullable
user_profiles: status text not null default 'active'
user_profiles: avatar_color text nullable default '#0f6e56'
user_profiles: created_at timestamptz nullable default now()
user_profiles: last_login timestamptz nullable
```

## 5. Pilot Dataset

**Brand:** Reverie Apparel Co.

**Tenant ID:** `1935f074-7acd-4799-8090-1f8cb085d1a4`

### Seeded/current counts

```text
entity                    | total
--------------------------+-------
orders                    | 35
amazon_orders             | 25
flipkart_orders           | 10
rate_cards_v2             | 2
settlement_fee_lines      | 66
claims                    | 5
engine_b_summaries_latest | 25
```

### Order mix

```text
 marketplace | operational_status | fulfillment_type | count | gross_value
-------------+--------------------+------------------+-------+-------------
 amazon      | DELIVERED          | FBA              |    16 |       27682
 amazon      | DELIVERED          | SELF_SHIP        |     9 |       14091
 flipkart    | CANCELLED          | FBF              |     1 |        2499
 flipkart    | CANCELLED          | SELLER_SHIP      |     1 |         599
 flipkart    | DELIVERED          | FBF              |     2 |        4398
 flipkart    | DELIVERED          | SELLER_SHIP      |     1 |        1899
 flipkart    | SHIPPED            | FBF              |     2 |        3198
 flipkart    | SHIPPED            | SELLER_SHIP      |     3 |        4396
```

### Rate cards for pilot tenant

```text
platform_id | category_id | commission_type | commission_percent | gst_percent | tcs_percent | settlement_basis | t_plus_days | grace_days | effective_from | archived | version
------------+-------------+-----------------+--------------------+-------------+-------------+------------------+-------------+------------+----------------+----------+--------
amazon      | apparel     | flat            | 12                 | 18          | 1           | delivery_date    | 7           | 2          | 2026-01-01     | false    | 1
flipkart    | apparel     | flat            | 10                 | 18          | 1           | delivery_date    | 7           | 2          | 2026-01-01     | false    | 1
```

### Fee/slab data for pilot tenant

```text
rate_card_fees: 0 rows
rate_card_slabs: 0 rows
rate_card_logistics_slabs: 0 rows
```

This is why Engine B currently returns `MEDIUM` confidence and `missing_rule_codes = ['closing_fee']` for all pilot payment recon rows.

### Uploaded settlement data

```text
 marketplace | settlement_id  | file_name                                          | status    | row_count | settlement_start_date | settlement_end_date
-------------+----------------+----------------------------------------------------+-----------+-----------+-----------------------+--------------------
 amazon      | SETTLE-REV-001 | reverie-apparel-amazon-settlement-apr-may-2026.csv | PROCESSED | 66        | 2026-04-01            | 2026-05-31
```

Settlement line buckets:

```text
 bucket       | transaction_type | lines | amount
--------------+------------------+-------+----------
 COMMISSION   | Order            | 22    | -4644.03
 PLATFORM_FEE | Order            | 22    | -880
 SALE_PRICE   | Order            | 22    | 37276
```

### Latest Engine B run

```text
 run_number | engine_version | status    | marketplace | orders_processed | orders_matched | orders_overcharged | orders_missing | exact_leakage | completed_at
------------+----------------+-----------+-------------+------------------+----------------+--------------------+----------------+---------------+-------------------------------
 1          |                | COMPLETED | amazon      | 0                | 0              | 0                  | 0              | 0             | 2026-05-30 14:59:23.565723+00
 2          |                | COMPLETED | amazon      | 0                | 0              | 0                  | 0              | 0             | 2026-05-30 14:59:23.357+00
 5          | v2_typescript  | COMPLETED | amazon      | 25               | 20             | 2                  | 3              | 170.91        | 2026-05-31 22:03:08.124585+00
```

Latest Engine B summary:

```text
status counts: 20 MATCHED, 2 OVERCHARGED, 3 MISSING
overcharge orders: AMZ-2026-51276, AMZ-2026-53582
missing payment orders: AMZ-2026-48391, AMZ-2026-48527, AMZ-2026-48964
latest exact leakage: 170.91
```

### Claims current state

```text
claim_status | bucket               | count | amount
-------------+----------------------+-------+--------
DRAFT        | COMMISSION           | 2     | 170.91
DRAFT        | PAYMENT_NOT_RECEIVED | 3     | 4497
```

Current claim rows:

```text
order_id        | marketplace | bucket               | claim_amount | expected_amount | actual_amount | discrepancy_amount | claim_status
----------------+-------------+----------------------+--------------+-----------------+---------------+--------------------+-------------
AMZ-2026-48964  | amazon      | PAYMENT_NOT_RECEIVED | 1899         | 1899            | 0             | 1899               | DRAFT
AMZ-2026-48527  | amazon      | PAYMENT_NOT_RECEIVED | 1299         | 1299            | 0             | 1299               | DRAFT
AMZ-2026-48391  | amazon      | PAYMENT_NOT_RECEIVED | 1299         | 1299            | 0             | 1299               | DRAFT
AMZ-2026-53582  | amazon      | COMMISSION           | 56.97        | 227.88          | 284.85        | -56.97             | DRAFT
AMZ-2026-51276  | amazon      | COMMISSION           | 113.94       | 455.76          | 569.7         | -113.94            | DRAFT
```

Known issue: current claim rows link to old Engine A run `b69f90cb...`; future claim creation should link to latest Engine B run/component.

## 6. Engine B: How It Works

### Files

- `shared/rateCards/v2.ts`
  - Normalizes rate-card rows.
  - Looks up the active rate card by tenant, platform, category, date, and optional template type.
  - Loads related `rate_card_slabs` and `rate_card_fees`.

- `shared/reconciliation/computeExpectedPayout.ts`
  - Pure calculation function.
  - Accepts order input and `RateCardWithRelations`.
  - Returns expected payout components, confidence, missing rules, and notes.

- `server/src/reconciliation/reconcileOrder.ts`
  - Wraps rate-card lookup and payout computation.
  - Computes expected payout date and delay threshold.
  - Passes `tenantId` and `fulfillment_type`.

- `server/src/reconciliation/buildCalculationBreakdown.ts`
  - Builds audit JSON for each order.
  - Hashes the breakdown with SHA-256.

- `server/routes/reconciliation.ts`
  - `POST /api/reconciliation/run` executes Engine B for delivered marketplace orders.
  - `GET /api/reconciliation/order/:orderId` returns latest Engine B detail and calculation breakdown.

### What Engine B calculates

- Gross order value: `selling_price * quantity`
- Commission:
  - Flat commission from `rate_cards_v2.commission_percent`
  - Tiered commission from `rate_card_slabs`
- Platform/tech fee from `rate_card_fees` with codes `tech`, `technology`, `platform`
- Collection fee from `rate_card_fees` with code `collection`
- Closing fee from `rate_card_fees` with codes `closing_fee`, `fixed_fee`, `closing`
- GST on fees:
  - Based on `rate_cards_v2.gst_percent`
  - Applied on commission + platform fee + closing fee
- TCS:
  - Based on `rate_cards_v2.tcs_percent`
  - Applied on gross order value
- Expected total deductions
- Expected net payout
- Confidence:
  - `LOW` if commission slab missing
  - `MEDIUM` if closing fee missing or GST percent is zero
  - `HIGH` when no required rules are missing

### Rate-card fields used

From `rate_cards_v2`:

- `tenant_id`
- `platform_id`
- `category_id`
- `commission_type`
- `commission_percent`
- `gst_percent`
- `tcs_percent`
- `settlement_basis`
- `t_plus_days`
- `grace_days`
- `effective_from`
- `effective_to`
- `archived`
- `template_type`
- `version_number`

From `rate_card_slabs`:

- `min_price`
- `max_price`
- `commission_percent`

From `rate_card_fees`:

- `fee_code`
- `fee_type`
- `fee_value`
- `applies_to_fulfillment_type`
- `min_price`
- `max_price`

### Current limitations

- Closing fee rules are not configured for the pilot tenant.
- Platform/tech and collection fee rules are not configured for the pilot tenant.
- Logistics expected fee is not fully calculated because delivery zone is not captured.
- GST/TCS actuals are not separately identifiable from current per-order settlement lines.
- Engine B status is currently driven primarily by commission discrepancy.
- Claims exist but some were created against old runs; claim-linking to latest Engine B components needs cleanup.

## 7. Run ID System

### `reconciliation_runs`

Purpose: top-level run record and audit container.

Important fields:

- `id`
- `tenant_id`
- `marketplace`
- `settlement_id`
- `uploaded_file_id`
- `run_number`
- `run_scope`
- `parent_run_id`
- `rerun_reason`
- `trigger_type`
- `triggered_by`
- `status`
- `engine_version`
- `settlement_period_from`
- `settlement_period_to`
- `orders_processed`
- `orders_matched`
- `orders_overcharged`
- `orders_undercharged`
- `orders_missing`
- `orders_error`
- `claimable_order_count`
- `exact_leakage`
- `estimated_leakage`
- `rate_card_snapshot`
- `rate_card_snapshot_hash`
- `data_quality_warnings`
- `metadata`

### `reconciliation_order_summary`

Purpose: one row per order per run.

Important fields:

- `id`
- `tenant_id`
- `run_id`
- `order_id`
- `marketplace`
- `settlement_id`
- `rate_card_id`
- `rate_card_version`
- `fulfillment_type`
- `expected_payout_date`
- `gross_order_value`
- `expected_commission`
- `actual_commission`
- `commission_discrepancy`
- `expected_gst`
- `actual_gst`
- `gst_discrepancy`
- `expected_tcs`
- `actual_tcs`
- `tcs_discrepancy`
- `expected_closing_fee`
- `actual_closing_fee`
- `closing_fee_discrepancy`
- `expected_logistics`
- `actual_logistics`
- `logistics_discrepancy`
- `expected_net_payout`
- `actual_net_payout`
- `total_discrepancy`
- `status`
- `claim_readiness`
- `confidence`
- `matched_settlement_line_ids`
- `missing_rule_codes`
- `calculation_breakdown`
- `calculation_hash`
- `engine_version`

### `reconciliation_fee_components`

Purpose: one row per component per order per run.

Expected Engine B components per order:

- `commission`
- `gst`
- `tcs`
- `closing_fee`
- `logistics`

### How reruns should work

- Each rerun creates a new `reconciliation_runs` row with the next tenant-scoped `run_number`.
- If rerun is derived from an earlier run, set `parent_run_id`.
- Add `rerun_reason`.
- Never mutate old run summaries to represent new results.
- UI should read latest completed Engine B run by default, but history and comparison UI should expose older runs.

### How claims link to runs

- `claims.reconciliation_run_id` links the claim to the run that generated the claimable issue.
- `claims.reconciliation_component_id` should link to the exact `reconciliation_fee_components` row when applicable.
- `claims.evidence_snapshot` freezes calculation and settlement evidence at creation time.
- If a newer run changes the amount/status, the UI should warn rather than silently alter the claim.

## 8. P0: Must Complete Before Pilot

1. **Fix claim run/component linkage for Engine B.**
   - Existing pilot claims currently point at an old run.
   - New claims should use latest Engine B `run_id` and component IDs.

2. **Add closing fee rules to rate cards.**
   - Pilot currently has no `rate_card_fees`.
   - Engine B confidence stays `MEDIUM` until closing fee rules are configured.

3. **Add rate-card UI for closing/platform/collection fee rules.**
   - Must support fulfillment type and price bands.

4. **Wire logistics expected fee only if enough data exists.**
   - Need delivery zone capture or a brand decision on default zone behavior.

5. **Build reconciliation history UI.**
   - Show runs, run number, engine version, counts, leakage, and period.

6. **Build run detail/drilldown UI.**
   - Allow users to inspect one run and its order summaries.

7. **Add claim recalculation warning.**
   - If latest run differs from frozen claim evidence, warn the user.

8. **Clean up legacy/duplicate API paths.**
   - There are overlapping rate-card and settlement endpoints in `server/routes.ts`, `server/routes/reconciliation.ts`, and `server/src/routes/rateCards.ts`.

9. **Normalize dashboard `leakage_by_marketplace`.**
   - Dashboard KPI and marketplace health now include Engine B fee leakage.
   - `leakage_by_marketplace` still reads returns only.

10. **Run full manual QA flow.**
    - Upload settlement.
    - Run reconciliation.
    - Open dashboard.
    - Open payment reconciliation.
    - Create claims.
    - Submit and track claims.

## 9. P1: Post Pilot / Next Sprint

1. Reconciliation run comparison between two runs.
2. Changed-since-last-run indicators on orders.
3. Batch/rerun workflows with `parent_run_id`.
4. Better logistics engine with zones, weights, service levels, reverse fees.
5. Full marketplace connector integrations for Amazon/Flipkart/Myntra.
6. Dynamic tenant/auth instead of hardcoded default tenant.
7. Settlement-file coverage API for drawer instead of hardcoded Amazon settlement labels.
8. Claim items table or claim-line model if grouped claims need durable child rows.
9. More robust automated tests for Engine B and dashboard queries.
10. Archive/delete legacy mock pages and old components after pilot confidence.

## 10. Product Decisions Made

These decisions were made with ChatGPT during the build:

- TCS is brand-configured, not hardcoded.
- No side-by-side Engine A/B comparison; use a clean switch to Engine B.
- No hardcoded marketplace fee values; brand provides rates via rate cards.
- Recoverable amount remains visible for now; final product decision after Engine B completion.
- Run ID full audit trail is required.
- Option B architecture chosen: TypeScript engine, not Postgres functions.
- Rate card is the single source of truth.
- Missing vs Settlement Not Uploaded distinction is mandatory.
- Claim evidence is frozen at claim creation time.

## 11. Key API Endpoints

Base path is `/api`.

### Dashboard/search/settings

- `GET /dashboard`
  - Returns KPIs, revenue trend, leakage, claims status, missing payments, reconciliation health, marketplace health, top leakage orders, recent runs, rate-card summary, and last reconciliation timestamp.
- `GET /search`
  - Returns matching orders, claims, and returns.
- `GET /settings/reconciliation`
  - Returns reconciliation settings for tenant.
- `PATCH /settings/reconciliation`
  - Updates missing payment rules, leakage sensitivity, and conflict behavior.

### Payment reconciliation

- `GET /reconciliation/orders`
  - Returns latest Engine B order summary rows for payment reconciliation table.
- `GET /reconciliation/order/:orderId`
  - Returns order detail, latest Engine B summary, rate-card context, raw settlement lines, legacy fee breakdown, and full `calculation_breakdown`.
- `GET /reconciliation/summary`
  - Returns latest Engine B summary counts/leakage for tenant/marketplace.
- `GET /reconciliation/last-run`
  - Returns latest completed reconciliation run timestamp.
- `POST /reconciliation/run`
  - Creates a run and executes Engine B in-process for delivered orders and settlement lines.
- `POST /reconciliation/run-logistics`
  - Legacy logistics reconciliation trigger via Supabase Edge Function.

### Missing payments / alerts

- `GET /claims/payment-alerts`
  - Returns delivered orders past expected payout date with `MISSING_PAYMENT` or `SETTLEMENT_NOT_UPLOADED` state.

### Claims

- `GET /claims`
  - Returns claim list.
- `GET /claims/grouped`
  - Returns grouped claims and summary for claims page.
- `GET /claims/by-order`
  - Returns claim(s) for an order.
- `GET /claims/detail`
  - Returns grouped claim detail.
- `PATCH /claims/detail`
  - Updates grouped claim workflow fields.
- `GET /claims/:id`
  - Returns one claim.
- `PATCH /claims/:id`
  - Updates claim workflow/status/recovered fields.
- `POST /claims`
  - Creates or returns existing claim for an order/bucket/run.
- `GET /claims/batch/preview`
  - Previews grouped claims for batch creation.
- `POST /claims/batch`
  - Creates grouped/batch claims.
- `PATCH /claims/:id/resolution`
  - Updates marketplace resolution state.
- `GET /claims/:id/comments`
  - Returns comments for claim.
- `POST /claims/:id/comments`
  - Adds comment to claim.

### Orders/returns/settlements

- `GET /orders`
  - Returns uploaded/seeded orders.
- `PATCH /orders/:id`
  - Updates an order.
- `GET /returns`
  - Returns returns rows.
- `POST /returns/upload`
  - Uploads return CSV data.
- `GET /returns/count`
  - Returns returns count.
- `GET /settlements/files`
  - Returns uploaded settlement files.
- Settlement upload route in `server/routes/reconciliation.ts`
  - Parses and stores settlement file data into `uploaded_files` and `settlement_fee_lines`.
- Legacy `GET/POST /settlements` and `POST /settlements/upload` also exist in `server/routes.ts`.

### Rate cards

Main routes in `server/src/routes/rateCards.ts`:

- `GET /rate-cards/template`
- `GET /rate-cards/template.csv`
- `POST /rate-cards/validate-upload`
- `POST /rate-cards/parse`
- `POST /rate-cards/parse-row`
- `POST /rate-cards/import`
- `GET /rate-cards/conflicts`
- `GET /rate-cards`
- `GET /rate-cards/:id`
- `POST /rate-cards/validate`
- `POST /rate-cards/apply`
- `POST /rate-cards`
- `PUT /rate-cards`
- `PUT /rate-cards/:id`
- `PATCH /rate-cards/:id`
- `DELETE /rate-cards/:id`
- `GET /rate-cards-v2`
- `GET /rate-cards-v2/:id`
- `POST /rate-cards-v2`
- `PUT /rate-cards-v2/:id`
- `PATCH /rate-cards-v2/:id`
- `DELETE /rate-cards-v2/:id`
- `POST /reconcile-order`
- `GET /reconciliations`
- `GET /reconciliations/summary`
- `POST /reconciliation-runs`
- `POST /settlements/upload`
- `GET /settlements`

Note: `server/routes.ts` also defines older `/api/rate-cards-v2` handlers. Prefer consolidating before adding more rate-card API surface.

### Integrations/users/audit/notifications

- `POST /integrations/vote`
- `DELETE /integrations/vote`
- `GET /integrations/votes`
- Myntra routes in `server/routes.ts`:
  - `GET /integrations/myntra/connect`
  - `GET /integrations/myntra/callback`
  - `GET /integrations/myntra/status`
  - `POST /integrations/myntra/disconnect`
  - `POST /integrations/myntra/sync`
- `GET /users`
- `GET /users/by-auth-id`
- `PATCH /users/:id`
- `DELETE /users/:id`
- `GET /audit-log`
- Notifications:
  - `GET /notifications/config`
  - `PUT /notifications/config`
  - `GET /notifications/expiring`
  - `POST /notifications/check`

## 12. Files Changed This Session

The working tree contains many historical source changes, archived files, screenshots, generated artifacts, and untracked validation scripts. The high-signal source files changed or added during this broader build session are:

### Core backend / Engine B

- `server/routes/reconciliation.ts`
- `server/src/reconciliation/reconcileOrder.ts`
- `server/src/reconciliation/buildCalculationBreakdown.ts`
- `shared/reconciliation/computeExpectedPayout.ts`
- `shared/rateCards/v2.ts`
- `server/config/tenant.ts`

### Routing/layout/frontend

- `client/src/App.tsx`
- `client/src/components/EnhancedLayout.tsx`
- `client/src/pages/financial-intelligence/PaymentReconciliation.tsx`
- `client/src/components/Dashboard.tsx`
- `client/src/config/tenant.ts`

### Claims/audit/users

- `client/src/components/claims/ClaimsPage.tsx`
- `client/src/components/claims/ClaimDetails.tsx`
- `client/src/components/claims/PrepareClaimModal.tsx`
- `client/src/components/AuditLogTab.tsx`
- `client/src/components/AuditTrailDashboard.tsx`
- `client/src/components/UserManagement.tsx`

### Rate cards / settings / uploads

- `client/src/pages/RateCardV2Page.tsx`
- `client/src/pages/RateCards/AddRateCardWizard/index.tsx`
- `client/src/pages/RateCards/components/PublishSummaryCard.tsx`
- `client/src/components/RateCardFormV2.tsx`
- `client/src/components/ReconciliationSettings.tsx`
- `client/src/components/OrdersUpload.tsx`
- `client/src/components/SettlementPage.tsx`
- `server/src/routes/rateCards.ts`

### Migrations / schema

- `migrations/0016_phase2_logistics_schema.sql`
- `migrations/0018_claim_batches.sql`
- `migrations/0019_allow_duplicate_uploaded_file_status.sql`
- `migrations/0020_payment_not_received_claims.sql`
- `shared/schema.ts`

### Archived/retired

- `client/src/archive/PaymentReconciliation.tsx`
- Several old components have been deleted from `client/src/components` and archived/replaced by newer pages.

### Current git status warning

`git status --short` currently shows a large dirty worktree with many deleted legacy components and many untracked screenshots under `artifacts/` and `attached_assets/`. Do not assume every untracked artifact is source code. Before committing, review and stage intentionally.

## 13. Agreed With ChatGPT But Not Yet Built

- Reconciliation history UI.
- Run comparison between runs.
- Closing fee rules in rate card.
- Changed-since-last-run indicators on orders.
- Claim recalculation warning when newer run differs from frozen claim evidence.
- Full cleanup/consolidation of duplicate legacy endpoints.
- Better logistics expected-fee engine after zone/service-level data is captured.
- Dynamic tenant/auth context to replace hardcoded pilot tenant.

## Current Verification Snapshot

Latest verified dashboard response for pilot tenant:

```text
kpis.total_revenue: 58762
kpis.total_leakage: 970.67
kpis.fee_overcharge_leakage: 170.91
kpis.return_leakage: 799.76
kpis.overcharged_orders: 2
kpis.missing_payments_count: 6

reconciliation_health:
  total: 25
  matched: 20
  mismatch: 2
  missing_payment: 3
  claimable: 5

recent_runs:
  only run #5, engine_version v2_typescript
```

Latest `npm run check` result after dashboard changes:

```text
> rest-express@1.0.0 check
> tsc
```

