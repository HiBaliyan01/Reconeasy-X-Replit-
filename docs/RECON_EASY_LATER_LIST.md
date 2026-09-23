# ReconEasy — Later List
> Approved ideas not in current scope. Revisit after pilot launch.

---

## Post-Pilot Features

### Rate Cards
- [ ] Marketplace-specific rate card extension tables (amazon_rate_card_extensions, flipkart_rate_card_extensions) — build before Flipkart onboarding
- [ ] Rate card highlight on /rate-cards page when opened from drawer link — needs query param + scroll logic
- [ ] Add true order_date column to orders table
- [ ] Rate card impact preview before publishing (how many orders affected)
- [ ] Rate card overlap detection with tenant_id filter (multi-tenant safety)
- [ ] Rate card snapshot including slabs and fees (not just base card)
- [ ] Closing fee UI in AddRateCardWizard (currently configured manually in DB)
- [ ] Settlement cadence (weekly/biweekly/monthly) in rate card wizard Step 5
- [ ] Marketplace-specific hints in wizard (Amazon: T+7, Flipkart: T+14)

### Reconciliation
- [ ] Reconciliation history page — compare runs over time
- [ ] Run comparison UI — show what changed between Run N and Run N-1
- [ ] Incremental reconciliation — only process changed orders
- [ ] Nightly scheduler — auto-trigger full run
- [ ] Rate card historical rerun — rerun old orders against updated rate card
- [ ] Claim recalculation warning when newer run differs from claim's source run

### Settlement & Parsing
- [ ] Flipkart settlement parser
- [ ] Myntra settlement parser
- [ ] Auto-download settlements from marketplace APIs (Amazon SP-API)
- [ ] Settlement upload UX redesign (single clean flow)
- [ ] Settlement supersede model (full audit trail for replaced files)
- [ ] Daily reminder notification for pending reconciliation
- [ ] Auto-reconcile after upload (optional user setting, default off)

### Returns & Disputes
- [ ] Operational Disputes tab — requires WMS integration
- [ ] EasyEcom integration (Phase 1: orders + returns sync)
- [ ] WMS integration tables (warehouse_receipts, dispute_evidence)
- [ ] Return policy engine for computing expected reversal amounts
- [ ] Return claim workflow integrated with main Claims page

### Claims
- [ ] Claim deadline indicator — days remaining to file per marketplace SLA
- [ ] Claim batch management — group by marketplace + issue type + settlement cycle
- [ ] Direct Amazon Seller Central integration (vs copy-paste claim text)
- [ ] Claim recalculation warning when rate card changes post-claim

### Orders
- [ ] Row actions (view/edit/more) on Orders page
- [ ] Inline weight/category edit without re-upload
- [ ] Better order filters (marketplace, date range, SKU, weight coverage)
- [ ] Order import control totals (show total amount on import confirmation)
- [ ] Duplicate order detection with clear warning
- [ ] Import error report (downloadable CSV of failed rows)

### Dashboard
- [ ] Full dashboard redesign (post-pilot, based on brand feedback)
- [ ] Working date filter (7/30/90 days)
- [ ] Working status and claim stage filters
- [ ] Revenue trend chart with real data
- [ ] "Open report" link to detailed revenue report

### Infrastructure
- [ ] Multi-brand / multi-tenant UI
- [ ] User roles (analyst/admin) enforced in API middleware
- [ ] Audit log filters by module, date, action type
- [ ] Audit log showing actual user name (not "System") — GAP-125
- [ ] Reconciliation runs logged in audit log
- [ ] DB indexes on orders(tenant_id, marketplace) and returns(tenant_id, marketplace)
- [ ] Job queue (BullMQ) for async reconciliation
- [ ] Delivery zone capture for logistics fee calculation

---

## Product Ideas (Not Yet Approved)

- [ ] Price Lens — category-level pricing intelligence
- [ ] RIA — AI-powered reconciliation analyst (Coming Soon UI exists)
- [ ] GST Summary — tax-level reconciliation reporting
- [ ] Revenue by Category — requires product catalog upload
- [ ] Multi-brand benchmarking — compare fee rates across brands
- [ ] Projected Income — forecast based on orders dispatched

---

## How to Use

- When an idea comes up that isn't P0/P1, add it here
- When a Later item gets promoted, move it to RECON_EASY_CONTEXT.md P0 list
- Review at start of every planning session
