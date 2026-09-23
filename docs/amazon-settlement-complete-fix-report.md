# Amazon settlement fix — implementation report

Implemented on 23 September 2026 for tenant `1935f074-7acd-4799-8090-1f8cb085d1a4`.

## 1. Rate cards — applied to the live database

The requested tenant-scoped update changed both non-archived cards. Values were read back after the migration:

| id | platform_id | tcs_percent |
|---|---|---:|
| f59c1387-e745-42aa-bce2-0034c6df6a81 | Amazon | 0.5 |
| 7ee48e1e-0391-4072-a9b2-385c151feefc | Flipkart | 0.5 |

Added a database column comment and TypeScript rate-card comment distinguishing GST TCS (0.5%, since 10-Jul-2024, ItemWithheldTax) from TDS 194-O (0.1%, since 1-Oct-2024, other-transaction).

Migration: `supabase/migrations/20260923160502_amazon_settlement_v2_components.sql`. Applied remotely and recorded in migration history.

## 2. Settlement parser — deployed

`process-settlement-upload` version **8** is ACTIVE with JWT verification retained. The Edge Function uses the tested pure parser in `shared/settlements/amazon.ts` and canonical mappings in `shared/settlements/buckets.ts`.

- Detects tabs in the first line, otherwise uses commas; supports quoted fields and escaped quotes.
- Accepts `.txt`, `.tsv`, and `.csv`. The settlement upload page also accepts these extensions.
- Reads V2 `amount-type`, `amount-description`, and `amount`. Preserves old CSV fee/price columns, including both amounts when present on a row.
- Normalizes headers to lowercase with hyphens preserved. Maps `order-item-code` to `order_item_id`.
- Added and verified `fulfillment_id`, `posted_date_time`, `shipment_id`, and `marketplace_name` columns. The original timestamp text is preserved without inventing a timezone.
- Parses MM/DD/YY, YYYY-MM-DD, and DD.MM.YYYY into ISO dates; rejects impossible calendar dates.
- Skips summary rows; sums signed detail amounts in paise, including unknown fees, refunds, reserves, and adjustments. A difference greater than ₹0.01 produces the requested warning without failing upload. Warnings are returned by the API and displayed on the upload page.
- Unknown valid-amount rows are stored as UNMAPPED; descriptions are logged and returned. Malformed/missing amounts produce explicit skipped-row warnings.
- Expanded the settlement bucket constraint while retaining every existing bucket.

Amazon's [official V2 settlement report documentation](https://developer-docs.amazon/sp-api/docs/report-type-values-settlement) confirms the tab-delimited format and the three V2 amount columns.

All mappings added or changed are listed below. Matching is case-insensitive; transaction-specific refund/adjustment rules take precedence. Amount signs are preserved from the file.

| Condition / description | Bucket |
|---|---|
| ItemPrice + description containing Principal | PRINCIPAL |
| ItemFees + exact Commission | COMMISSION |
| Commission IGST / CGST / SGST | COMMISSION_GST |
| Shipping commission | SHIPPING_COMMISSION |
| Shipping commission IGST | SHIPPING_COMMISSION_GST |
| Fixed closing fee; legacy Closing Fee | CLOSING_FEE |
| Fixed closing fee IGST | CLOSING_FEE_GST |
| FBA Weight Handling Fee | WEIGHT_HANDLING |
| FBA Weight Handling Fee IGST | WEIGHT_HANDLING_GST |
| FBA Pick & Pack Fee | PICK_PACK |
| FBA Pick & Pack Fee IGST / GST | PICK_PACK_GST |
| Easy Ship weight handling fees | EASY_SHIP_WEIGHT |
| Easy Ship weight handling fees IGST | EASY_SHIP_WEIGHT_GST |
| Amazon Easy Ship Charges | EASY_SHIP_CHARGES |
| MFN Postage Purchase Complete | MFN_POSTAGE |
| ItemWithheldTax + TCS-IGST / TCS-CGST / TCS-SGST | TCS |
| TDS - Section 194-O | TDS_194O |
| ItemPrice + Tax | ITEM_TAX |
| ItemPrice + ShippingTax | SHIPPING_TAX |
| amount-type Promotion | PROMOTION |
| Refund + Principal | REFUND_PRINCIPAL |
| Refund + Commission | REFUND_COMMISSION |
| Refund + Refund commission | REFUND_COMMISSION_FEE |
| Adjustment + FBA Inventory Reimbursement | REIMBURSEMENT |
| Other Adjustment transactions | ADJUSTMENT |
| Current Reserve Amount | RESERVE_DEBIT |
| Previous Reserve Amount Balance | RESERVE_CREDIT |
| Description containing Storage Fee / Removal / Disposal | STORAGE |
| Cost of Advertising | ADVERTISING |
| Anything else | UNMAPPED |

## 3. Engine B — implemented in the workspace

The expected payout calculation, reconciliation runner, and dashboard readers are updated. These Express/frontend changes have **not been deployed to an external application host**. Existing database results were not recomputed.

Formula for the requested Amazon components:

```text
expected net payout = gross principal
  - commission - commission GST
  - closing fee - closing fee GST
  - logistics - logistics GST
  - GST TCS
```

Existing configured platform/collection deductions and platform GST remain supported for backward compatibility. TCS uses the selected card's percentage; there is no hardcoded 1% fallback. TDS is separately computed as `gross × 0.001` and excluded from expected net and discrepancy matching, as requested. Thus the expected/actual comparison basis is **before TDS**, not the final bank deposit. The breakdown separately stores `settlement_net_cash`, the signed sum of all order-linked settlement lines, including TDS and other categories.

Each monetary component is rounded to paise before totals are calculated.

| Component | Actual buckets |
|---|---|
| commission | COMMISSION |
| commission_gst | COMMISSION_GST |
| closing_fee | CLOSING_FEE; legacy PLATFORM_FEE |
| closing_fee_gst | CLOSING_FEE_GST |
| logistics | WEIGHT_HANDLING + EASY_SHIP_WEIGHT + PICK_PACK + EASY_SHIP_CHARGES; legacy LOGISTICS |
| logistics_gst | WEIGHT_HANDLING_GST + EASY_SHIP_WEIGHT_GST + PICK_PACK_GST |
| tcs | TCS; all IGST or CGST/SGST lines combined |
| tds_194o | TDS_194O; informational only |
| principal | PRINCIPAL; legacy SALE_PRICE |

Recognizable legacy raw labels are mapped in memory for new runs without modifying stored settlement lines. Refunds and adjustments do not inflate forward-order charges. Positive fee credits reduce charges rather than being converted into additional deductions.

Per-component tolerance is `max(₹1, 0.5% of expected component)`. MATCHED means all tracked, configured fee components fall within tolerance; OVERCHARGED takes precedence when any exceeds its expectation beyond tolerance; otherwise any shortfall gives UNDERCHARGED. No lines gives MISSING. A run request without a processed settlement returns SETTLEMENT_NOT_UPLOADED. Missing rate cards or no comparable components are marked NEEDS_REVIEW rather than falsely MATCHED.

Settlement AFN selects FBA rules. MFN retains a compatible non-FBA order model, without assuming MFN always means Easy Ship. Logistics uses configured fee components or weight slabs with the required matching inputs. This tenant currently has **no logistics slabs**. Missing logistics rules/weight/zone are recorded as unverified and excluded from discrepancy matching; other configured components can still be compared. A MATCHED status with missing rules is not a complete verification of those missing components.

New runs use `v2_typescript_amazon_v2`. Readers accept both old and new versions, retain historical behavior for old runs, and use the new stored status/component discrepancy for new runs.

## 4. Expanded persistence

The nine components are stored in `reconciliation_order_summary.calculation_breakdown.components` for each new order/run:

`commission`, `commission_gst`, `closing_fee`, `closing_fee_gst`, `logistics`, `logistics_gst`, `tcs`, `tds_194o`, `principal`.

Each includes expected, actual, discrepancy, tracked/informational flags, and tolerance. Components are included in the calculation hash. The existing five aggregate fee-component rows remain supported. Neither `reconciliation_runs` nor `reconciliation_order_summary` structure was changed.

## Verification

- `npm run check`: **PASS**.
- `npx tsx --test tests/amazon-settlement.test.ts`: **44/44 PASS**.
- `npx --yes deno check supabase/functions/process-settlement-upload/index.ts`: **PASS**.
- Live parser smoke check: authenticated empty request returns the expected HTTP 400 validation response; no test settlement rows were inserted.
- Changed order-list and summary SQL readers executed successfully as read-only queries against existing data.
- All **128** existing tenant reconciliation summaries are unchanged: before/after content checksum `caebe506f22b060e1ea3e1901667a6f6`.
- Database rate values and all four added settlement columns were read back successfully.

Example tested end to end through parsing and comparison: ₹1,000 principal, ₹100 commission, ₹20 closing fee, ₹50 logistics, ₹30.60 fee GST, ₹5 TCS, ₹1 TDS. Expected/actual comparison payout is ₹794.40, while signed settlement cash is ₹793.40. Status: MATCHED.

Historical files/results were not automatically reprocessed. Newly supported fees that were previously skipped require re-importing the original source report and running reconciliation after the application code is deployed.
