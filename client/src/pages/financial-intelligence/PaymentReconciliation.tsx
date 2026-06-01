import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, ChevronRight, Download, Loader2, Ticket, X, Zap } from "lucide-react";
import { DEFAULT_TENANT_ID } from "../../config/tenant";

type DrawerState =
  | {
      orderId: string;
      kind: "discrepancy" | "missing";
      extraData?: {
        daysOverdue?: number;
        expectedPayoutDate?: string;
        paymentStatus?: string;
      };
    }
  | null;
type ToastState = { id: string; message: string; amount?: string };

const MP_TINT: Record<string, { bg: string; fg: string; dot: string }> = {
  amazon: { bg: "#F4EFE6", fg: "#8A5A12", dot: "#E08A18" },
  flipkart: { bg: "#EAF1FB", fg: "#1F5BB8", dot: "#2874F0" },
  myntra: { bg: "#FBECEC", fg: "#B23A4A", dot: "#E04A5F" },
};

const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (n: number) => {
  if (!n) return "0";
  return Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatShortDate = (d?: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatRelativeTime = (d?: string | null) => {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return formatShortDate(d);
};

const marketplaceLabel = (value?: string | null) => {
  const mp = value?.toLowerCase() || "amazon";
  return mp.charAt(0).toUpperCase() + mp.slice(1);
};

const csvEscape = (value: unknown) => {
  const raw = String(value ?? "");
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

function MarketplacePill({ value }: { value?: string | null }) {
  const mp = value?.toLowerCase() || "amazon";
  const tint = MP_TINT[mp] || MP_TINT.amazon;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[12px] font-semibold"
      style={{ background: tint.bg, color: tint.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.dot }} />
      {marketplaceLabel(mp)}
    </span>
  );
}

export default function PaymentReconciliation() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [missingPayments, setMissingPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState<"discrepancies" | "missing">("discrepancies");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [drawerData, setDrawerData] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [marketplace, setMarketplace] = useState("all");
  const [isRunning, setIsRunning] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; failed: number } | null>(null);

  const addToast = useCallback((message: string, amount?: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, amount }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const mp = marketplace !== "all" ? `&marketplace=${marketplace}` : "";
      const [ordersRes, alertsRes, summaryRes, lastRunRes] = await Promise.all([
        fetch(`/api/reconciliation/orders?tenant_id=${DEFAULT_TENANT_ID}${mp}&limit=100`),
        fetch(`/api/claims/payment-alerts?tenant_id=${DEFAULT_TENANT_ID}${mp}`),
        fetch(`/api/reconciliation/summary?tenant_id=${DEFAULT_TENANT_ID}${mp}`),
        fetch(`/api/reconciliation/last-run?tenant_id=${DEFAULT_TENANT_ID}`),
      ]);
      const [ordersData, alertsData, summaryData, lastRunData] = await Promise.all([
        ordersRes.json(),
        alertsRes.json(),
        summaryRes.json(),
        lastRunRes.json(),
      ]);

      if (!ordersRes.ok) throw new Error(ordersData?.error || "Failed to fetch orders");
      if (!alertsRes.ok) throw new Error(alertsData?.error || "Failed to fetch payment alerts");
      if (!summaryRes.ok) throw new Error(summaryData?.error || "Failed to fetch summary");
      if (!lastRunRes.ok) throw new Error(lastRunData?.error || "Failed to fetch last run");

      const alerts = Array.isArray(alertsData)
        ? alertsData
        : Array.isArray(alertsData?.alerts)
          ? alertsData.alerts
          : [];
      const lastRunValue = lastRunData?.last_run;
      setRows(Array.isArray(ordersData?.rows) ? ordersData.rows : []);
      setMissingPayments(alerts);
      setSummary({
        ...(summaryData || {}),
        delayed_count: alertsData?.summary?.delayed_count ?? summaryData?.delayed_count ?? 0,
      });
      setLastRun(
        typeof lastRunValue === "string"
          ? lastRunValue
          : lastRunValue?.completed_at || lastRunValue?.created_at || null,
      );
    } catch (err) {
      console.error("fetch error:", err);
      setRows([]);
      setMissingPayments([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [marketplace]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!drawer) {
      setDrawerData(null);
      return;
    }
    let cancelled = false;
    setDrawerLoading(true);
    fetch(
      `/api/reconciliation/order/${drawer.orderId}?tenant_id=${DEFAULT_TENANT_ID}&marketplace=${
        marketplace === "all" ? "amazon" : marketplace
      }`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDrawerData(data?.error ? null : data);
      })
      .catch(() => {
        if (!cancelled) setDrawerData(null);
      })
      .finally(() => {
        if (!cancelled) setDrawerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawer, marketplace]);

  const discrepancyRows = useMemo(() => {
    const filtered = showAll
      ? rows.filter((row) => row.status !== "MISSING")
      : rows.filter((row) => row.status === "OVERCHARGED");

    return [...filtered].sort((a, b) => {
      const aDate = new Date(a.dispatchDate || 0).getTime();
      const bDate = new Date(b.dispatchDate || 0).getTime();
      if (aDate !== bDate) return aDate - bDate;
      return String(a.orderId || "").localeCompare(String(b.orderId || ""));
    });
  }, [rows, showAll]);

  const sortedMissingPayments = useMemo(
    () =>
      [...missingPayments].sort((a, b) => {
        const aDate = new Date(a.expected_payout_date || 0).getTime();
        const bDate = new Date(b.expected_payout_date || 0).getTime();
        if (aDate !== bDate) return aDate - bDate;
        return String(a.order_id || "").localeCompare(String(b.order_id || ""));
      }),
    [missingPayments],
  );

  const overchargedCount = rows.filter((row) => row.status === "OVERCHARGED").length;
  const confirmedMissingCount = missingPayments.filter(
    (row) => row.payment_status === "MISSING_PAYMENT",
  ).length;
  const pendingUploadCount = missingPayments.filter(
    (row) => row.payment_status === "SETTLEMENT_NOT_UPLOADED",
  ).length;
  const overchargeTotal = rows
    .filter((row) => row.status === "OVERCHARGED")
    .reduce((sum, row) => sum + Math.abs(asNumber(row.totalDiscrepancy)), 0);
  const missingTotal = missingPayments
    .filter((row) => row.payment_status === "MISSING_PAYMENT")
    .reduce((sum, row) => sum + asNumber(row.selling_price), 0);
  const recoverableTotal = overchargeTotal + missingTotal;
  const bulkAmount = Array.from(selected).reduce((sum, id) => {
    const row = rows.find((item) => item.orderId === id);
    const missing = missingPayments.find((item) => item.order_id === id);
    return sum + Math.abs(asNumber(row?.totalDiscrepancy)) + asNumber(missing?.selling_price);
  }, 0);

  const toggleSelect = (orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const createClaimForOrder = async (orderId: string, row: any, kind: "discrepancy" | "missing") => {
    try {
      const payload =
        kind === "discrepancy"
          ? {
              tenant_id: DEFAULT_TENANT_ID,
              order_id: orderId,
              marketplace: row.marketplace || "amazon",
              bucket: "COMMISSION",
              reconciliation_run_id: row.runId,
              claim_amount: Math.abs(asNumber(row.totalDiscrepancy)),
              expected_amount: asNumber(row.expectedCommission),
              actual_amount: asNumber(row.actualCommission),
            }
          : {
              tenant_id: DEFAULT_TENANT_ID,
              order_id: orderId,
              marketplace: row.marketplace || "amazon",
              bucket: "PAYMENT_NOT_RECEIVED",
              expected_amount: asNumber(row.selling_price),
              actual_amount: 0,
              claim_amount: asNumber(row.selling_price),
              notes: `Payment not received. Expected by ${row.expected_payout_date}.`,
            };

      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return response.status === 200;
    } catch (err) {
      console.error("Create claim error:", err);
      return false;
    }
  };

  const handleCreateClaim = async (orderId: string) => {
    const discrepancyRow = rows.find((row) => row.orderId === orderId);
    const missingRow = missingPayments.find((row) => row.order_id === orderId);
    const ok = discrepancyRow
      ? await createClaimForOrder(orderId, discrepancyRow, "discrepancy")
      : missingRow
        ? await createClaimForOrder(orderId, missingRow, "missing")
        : false;

    if (ok) {
      const amount = discrepancyRow
        ? Math.abs(asNumber(discrepancyRow.totalDiscrepancy))
        : asNumber(missingRow?.selling_price);
      addToast(`Claim created for ${orderId}`, `₹${formatNumber(amount)}`);
      setRows((prev) =>
        prev.map((row) => (row.orderId === orderId ? { ...row, claimState: "Draft" } : row)),
      );
      await fetchData();
    } else {
      addToast(`Could not create claim for ${orderId}`);
    }
  };

  const handleBulkClaim = async () => {
    const ids = Array.from(selected);
    let created = 0;
    for (const id of ids) {
      const row = rows.find((item) => item.orderId === id);
      const missing = missingPayments.find((item) => item.order_id === id);
      const ok = row
        ? await createClaimForOrder(id, row, "discrepancy")
        : missing
          ? await createClaimForOrder(id, missing, "missing")
          : false;
      if (ok) created += 1;
    }
    addToast(`Created ${created} claim${created === 1 ? "" : "s"}`, `₹${formatNumber(bulkAmount)}`);
    setSelected(new Set());
    await fetchData();
  };

  const handleCreateAllClaims = async () => {
    setBulkCreating(true);
    setBulkResult(null);

    const overchargeRows = rows.filter(
      (row) => row.status === "OVERCHARGED" && row.claimState === "Not Raised",
    );
    const missingRows = missingPayments.filter((row) => row.payment_status === "MISSING_PAYMENT");

    let created = 0;
    let failed = 0;

    for (const row of overchargeRows) {
      const ok = await createClaimForOrder(row.orderId, row, "discrepancy");
      ok ? created++ : failed++;
    }
    for (const row of missingRows) {
      const ok = await createClaimForOrder(row.order_id, row, "missing");
      ok ? created++ : failed++;
    }

    setBulkCreating(false);
    setBulkResult({ created, failed });

    if (failed === 0) {
      addToast(`${created} claim${created === 1 ? "" : "s"} created successfully`);
      setTimeout(() => {
        setShowBulkConfirm(false);
        setBulkResult(null);
      }, 1800);
    }

    setSelected(new Set());
    await fetchData();
  };

  const handleRunReconciliation = async () => {
    setIsRunning(true);
    try {
      const targets = marketplace === "all" ? ["amazon", "flipkart", "myntra"] : [marketplace];
      const results = await Promise.allSettled(
        targets.map(async (target) => {
          const response = await fetch("/api/reconciliation/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenant_id: DEFAULT_TENANT_ID, marketplace: target }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error || `Failed for ${target}`);
          return data;
        }),
      );
      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      if (succeeded === 0) throw new Error("No reconciliation run completed");
      addToast(`Reconciliation completed for ${succeeded} marketplace${succeeded > 1 ? "s" : ""}`);
      await fetchData();
    } catch (err) {
      console.error("Run reconciliation error:", err);
      addToast("Reconciliation run failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportCsv = () => {
    const sourceRows = activeTab === "missing" ? sortedMissingPayments : discrepancyRows;
    const columns =
      activeTab === "missing"
        ? ["order_id", "marketplace", "sku", "expected_payout_date", "selling_price", "days_overdue", "payment_status"]
        : ["orderId", "marketplace", "sku", "expectedCommission", "actualCommission", "totalDiscrepancy", "status"];
    const csv = [
      columns.join(","),
      ...sourceRows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payment-reconciliation-${activeTab}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const drawerMissingRow = drawer
    ? missingPayments.find((row) => row.order_id === drawer.orderId)
    : null;
  const drawerMarketplace = String(drawerData?.marketplace || drawerMissingRow?.marketplace || "").toLowerCase();
  const drawerDaysOverdue = asNumber(drawer?.extraData?.daysOverdue ?? drawerMissingRow?.days_overdue);
  const drawerNeedsSettlementUpload =
    drawer?.kind === "missing" && drawer.extraData?.paymentStatus === "SETTLEMENT_NOT_UPLOADED";
  const drawerCalculationBreakdown = drawerData?.calculation_breakdown ?? drawerData?.calculationBreakdown ?? null;
  const drawerSellingPrice = asNumber(drawerData?.sellingPrice ?? drawerData?.selling_price ?? drawerMissingRow?.selling_price);
  const drawerQuantity = asNumber(drawerData?.quantity ?? drawerMissingRow?.quantity ?? 1) || 1;
  const drawerClaimable =
    drawer?.kind === "missing"
      ? asNumber(drawerCalculationBreakdown?.summary?.expected_net_payout ?? drawerMissingRow?.selling_price)
      : Math.abs(asNumber(drawerData?.discrepancy ?? drawerCalculationBreakdown?.summary?.total_discrepancy));

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">Payment Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track expected vs actual marketplace deductions and recover leakage.
          </p>
          {lastRun && (
            <div className="flex items-center gap-2 mt-1.5 text-[12.5px] text-slate-400">
              <span>Last run: {formatRelativeTime(lastRun)}</span>
              <span>·</span>
              <span>Manual</span>
              <span>·</span>
              <span className="text-emerald-600 font-semibold">
                {rows.filter((row) => row.status === "MATCHED").length} matched · {rows.length} checked
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={marketplace}
            onChange={(event) => {
              setMarketplace(event.target.value);
              setSelected(new Set());
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            <option value="all">All marketplaces</option>
            <option value="amazon">Amazon</option>
            <option value="flipkart">Flipkart</option>
            <option value="myntra">Myntra</option>
          </select>
          <button
            onClick={handleExportCsv}
            className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handleRunReconciliation}
            disabled={isRunning}
            className="h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {isRunning ? "Running..." : "Run Reconciliation"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl mb-5 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-teal-700 uppercase tracking-wide mb-1">
              <Zap className="w-3.5 h-3.5" /> Recoverable this cycle
            </div>
            <div className="text-[32px] font-semibold text-slate-900 leading-none">
              ₹{formatNumber(recoverableTotal)}
            </div>
            <div className="text-[12.5px] text-slate-400 mt-1.5">
              Across{" "}
              <strong className="text-slate-600">{confirmedMissingCount + overchargedCount} confirmed orders</strong>
              {pendingUploadCount > 0 && (
                <>
                  {" "}
                  · <strong className="text-slate-600">{pendingUploadCount} more</strong> pending settlement upload
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center gap-2 mb-3"
            >
              <Ticket className="w-4 h-4" /> Create all claims
            </button>
            <div className="flex gap-4 text-[12px] text-slate-500">
              <span>
                Overcharges <strong className="text-slate-700">₹{formatNumber(overchargeTotal)}</strong>
              </span>
              <span>
                Missing payouts <strong className="text-slate-700">₹{formatNumber(missingTotal)}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4">
          {[
            { label: "Matched Orders", value: rows.filter((row) => row.status === "MATCHED").length, tone: "ok", foot: "Fees within tolerance" },
            { label: "Orders Checked", value: rows.length, tone: "ok", foot: "In last reconciliation run" },
            { label: "Missing Payments", value: confirmedMissingCount, tone: "bad", foot: "Past expected payout" },
            { label: "Overcharges", value: overchargedCount, tone: "bad", foot: "Fee above rate card" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`px-5 py-4 border-r border-slate-100 last:border-r-0 relative ${
                kpi.tone === "ok" ? "" : kpi.tone === "warn" ? "bg-amber-50/40" : "bg-red-50/30"
              }`}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-r ${
                  kpi.tone === "ok" ? "bg-teal-400" : kpi.tone === "warn" ? "bg-amber-400" : "bg-red-400"
                }`}
              />
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{kpi.label}</div>
              <div
                className={`text-[28px] font-semibold leading-none mb-1 ${
                  kpi.tone === "ok" ? "text-slate-900" : kpi.tone === "warn" ? "text-amber-700" : "text-red-600"
                }`}
              >
                {kpi.value}
              </div>
              <div className="text-[11.5px] text-slate-400">{kpi.foot}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 border-t border-slate-100">
          <span className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wide">
            Leakage breakdown
          </span>
          {[
            { label: "Commission", amount: overchargeTotal, color: "#ef4444" },
            { label: "Logistics", amount: 0, color: "#f59e0b" },
            { label: "Returns", amount: 0, color: "#94a3b8" },
          ].map((item) => (
            <span
              key={item.label}
              className={`flex items-center gap-2 text-[12.5px] ${
                item.amount === 0 ? "text-slate-300" : "text-slate-600"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
              {item.label}{" "}
              <strong className={item.amount === 0 ? "text-slate-300" : "text-slate-700"}>
                ₹{formatNumber(item.amount)}
              </strong>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-0 border-b border-slate-200 mb-0">
        {[
          { key: "discrepancies", label: "Order Discrepancies", count: overchargedCount, color: "red" },
          { key: "missing", label: "Missing Payments", count: missingPayments.length, color: "red", live: true },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "discrepancies" | "missing")}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "discrepancies" && (
        <div className="bg-white border border-slate-200 rounded-b-xl border-t-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-[13px] text-slate-500">
              Orders where marketplace deductions differ from expected rate card values.
            </p>
            <label className="flex items-center gap-2 text-[13px] text-slate-500 cursor-pointer">
              <span>Include matched orders</span>
              <button
                onClick={() => setShowAll(!showAll)}
                className={`w-10 h-6 rounded-full transition-colors relative ${showAll ? "bg-teal-500" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    showAll ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-1" />
                <th className="w-9 px-3" />
                {["Order ID", "Marketplace", "SKU", "Expected", "Charged", "Discrepancy", "Status", "Action"].map((label) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 ${
                      ["Expected", "Charged", "Discrepancy", "Action"].includes(label) ? "text-right" : "text-left"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && discrepancyRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                    Loading reconciliation orders...
                  </td>
                </tr>
              ) : discrepancyRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                    No order discrepancies found.
                  </td>
                </tr>
              ) : (
                discrepancyRows.map((row) => {
                  const isOvercharged = row.status === "OVERCHARGED";
                  const isSelected = selected.has(row.orderId);
                  return (
                    <tr
                      key={row.orderId}
                      onClick={() => setDrawer({ orderId: row.orderId, kind: "discrepancy" })}
                      className={`border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors ${
                        isSelected ? "bg-teal-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="w-1 p-0">{isOvercharged && <div className="w-0.5 h-[52px] bg-red-500 rounded-r" />}</td>
                      <td className="px-3" onClick={(event) => event.stopPropagation()}>
                        {isOvercharged && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.orderId)}
                            className="w-4 h-4 rounded border-slate-300 text-teal-600"
                          />
                        )}
                      </td>
                      <td className="px-4 py-0 h-[52px]">
                        <span className="font-mono text-[12.5px] text-slate-800">{row.orderId}</span>
                      </td>
                      <td className="px-4"><MarketplacePill value={row.marketplace} /></td>
                      <td className="px-4 font-mono text-[12.5px] text-slate-600">{row.sku || "—"}</td>
                      <td className="px-4 text-right font-mono text-[13px] text-slate-600">₹{formatNumber(asNumber(row.expectedCommission))}</td>
                      <td className="px-4 text-right font-mono text-[13px] text-slate-600">₹{formatNumber(asNumber(row.actualCommission))}</td>
                      <td className="px-4 text-right font-mono text-[13px]">
                        {isOvercharged ? (
                          <span className="text-red-600 font-semibold">-₹{formatNumber(Math.abs(asNumber(row.totalDiscrepancy)))}</span>
                        ) : (
                          <span className="text-slate-400">
                            {asNumber(row.totalDiscrepancy) === 0 ? "₹0" : `+₹${formatNumber(asNumber(row.totalDiscrepancy))}`}
                          </span>
                        )}
                      </td>
                      <td className="px-4">
                        {isOvercharged ? (
                          <span className="px-2 py-1 rounded-full text-[11.5px] font-semibold bg-red-100 text-red-700">Overcharged</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[11.5px] font-semibold bg-slate-100 text-slate-500">Matched</span>
                        )}
                      </td>
                      <td className="px-4 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {isOvercharged && row.claimState === "Not Raised" && (
                            <button
                              onClick={() => handleCreateClaim(row.orderId)}
                              className="px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 text-[12px] font-semibold hover:bg-teal-50"
                            >
                              Create Claim
                            </button>
                          )}
                          {row.claimState !== "Not Raised" && (
                            <span className="text-[12px] text-teal-600 font-medium">{row.claimState}</span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 text-[12.5px] text-slate-400">
            <span>
              Showing <strong className="text-slate-700">{discrepancyRows.filter((row) => row.status === "OVERCHARGED").length} discrepancies</strong>
              {showAll && ` · ${discrepancyRows.filter((row) => row.status !== "OVERCHARGED").length} matched orders`}
              · Sorted by oldest first
            </span>
          </div>
        </div>
      )}

      {activeTab === "missing" && (
        <div className="bg-white border border-slate-200 rounded-b-xl border-t-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-[13px] text-slate-500">
              Delivered orders with no settlement after their expected payout date.
            </p>
            <span className="text-[12.5px] text-slate-500">
              <strong className="text-slate-700">{confirmedMissingCount} confirmed</strong>
              {" · "}
              {pendingUploadCount} need upload
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-1" />
                <th className="w-9 px-3" />
                {["Order ID", "Marketplace", "SKU", "Expected Payout", "Order Value", "Overdue", "Status", "Action"].map((label) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 ${
                      ["Order Value", "Overdue", "Action"].includes(label) ? "text-right" : "text-left"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && sortedMissingPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                    Loading missing payment alerts...
                  </td>
                </tr>
              ) : sortedMissingPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                    No missing payments found.
                  </td>
                </tr>
              ) : (
                sortedMissingPayments.map((row) => {
                  const isConfirmed = row.payment_status === "MISSING_PAYMENT";
                  const isSelected = selected.has(row.order_id);
                  const daysOverdue = row.days_overdue || 0;
                  return (
                    <tr
                      key={row.order_id}
                      onClick={() =>
                        setDrawer({
                          orderId: row.order_id,
                          kind: "missing",
                          extraData: {
                            daysOverdue: row.days_overdue,
                            expectedPayoutDate: row.expected_payout_date,
                            paymentStatus: row.payment_status,
                          },
                        })
                      }
                      className={`border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors ${
                        isSelected ? "bg-teal-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="w-1 p-0">
                        <div className={`w-0.5 h-[52px] rounded-r ${isConfirmed ? "bg-red-500" : "bg-amber-400"}`} />
                      </td>
                      <td className="px-3" onClick={(event) => event.stopPropagation()}>
                        {isConfirmed && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.order_id)}
                            className="w-4 h-4 rounded border-slate-300 text-teal-600"
                          />
                        )}
                      </td>
                      <td className="px-4 py-0 h-[52px]">
                        <span className="font-mono text-[12.5px] text-slate-800">{row.order_id}</span>
                      </td>
                      <td className="px-4"><MarketplacePill value={row.marketplace} /></td>
                      <td className="px-4 font-mono text-[12.5px] text-slate-600">{row.sku || "—"}</td>
                      <td className="px-4 text-[13px] text-slate-500">{formatShortDate(row.expected_payout_date)}</td>
                      <td className="px-4 text-right font-mono text-[13px] text-slate-700">
                        {isConfirmed ? `₹${formatNumber(asNumber(row.selling_price))}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 text-right">
                        <span
                          className={`font-mono text-[13px] font-semibold ${
                            daysOverdue >= 45 ? "text-red-600" : daysOverdue >= 30 ? "text-amber-600" : "text-slate-600"
                          }`}
                        >
                          {daysOverdue}d
                        </span>
                      </td>
                      <td className="px-4">
                        {isConfirmed ? (
                          <span className="px-2 py-1 rounded-full text-[11.5px] font-semibold bg-red-100 text-red-700">Missing</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[11.5px] font-semibold bg-amber-100 text-amber-700">Upload needed</span>
                        )}
                      </td>
                      <td className="px-4 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {isConfirmed ? (
                            <button
                              onClick={() => handleCreateClaim(row.order_id)}
                              className="px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 text-[12px] font-semibold hover:bg-teal-50"
                            >
                              Create Claim
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate("/data-hub?subtab=settlements")}
                              className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-[12px] font-semibold hover:bg-amber-50"
                            >
                              Upload Settlement
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 text-[12.5px] text-slate-400">
            <span>Flipkart orders need a settlement file uploaded before a claim can be confirmed.</span>
            <span>{missingPayments.length} orders</span>
          </div>
        </div>
      )}

      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setDrawer(null)} />
          <aside className="fixed right-0 top-0 h-full w-[440px] bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[13px] font-semibold text-slate-800">{drawer.orderId}</div>
                  <div className="text-[12px] text-slate-400 mt-0.5">
                    {drawer.kind === "discrepancy" ? "Order Discrepancy" : "Missing Payment"}
                    {drawerData?.sku && ` · ${drawerData.sku}`}
                  </div>
                </div>
                <button
                  onClick={() => setDrawer(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading...</div>
              ) : drawerData ? (
                <>
                  <section>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">
                      Reconciliation Summary
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { k: "Marketplace", v: drawerData.marketplace },
                        { k: "Dispatch Date", v: formatShortDate(drawerData.dispatchDate) },
                        { k: "Category", v: drawerData.categoryId || "—" },
                        { k: "Rate Card", v: drawerData.rateCard ? `${drawerData.rateCard.commissionPercent}% commission` : "—" },
                        {
                          k: "Status",
                          v: drawerNeedsSettlementUpload ? "Settlement not uploaded" : drawerData.status,
                        },
                      ].map((row) => (
                        <div key={row.k} className="flex items-center justify-between">
                          <span className="text-[12.5px] text-slate-400">{row.k}</span>
                          <span className="text-[12.5px] font-medium text-slate-700">{row.v}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {drawer.kind === "missing" && (
                    <>
                      <section>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">
                          What We Checked
                        </div>
                        {drawerMarketplace === "amazon" ? (
                          <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] font-semibold text-slate-600">Settlement File</span>
                                <span className="text-[11.5px] text-teal-700 font-medium">SETTLE-REV-001</span>
                              </div>
                              <div className="text-[11.5px] text-slate-400 mt-0.5">
                                Apr 2026 – May 2026 · 66 lines
                              </div>
                            </div>
                            <div className="px-4 py-3 flex items-center justify-between">
                              <span className="text-[12px] text-slate-600">Payment found</span>
                              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
                                <X className="w-3.5 h-3.5" /> None
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-[12.5px] text-amber-700">
                              No Flipkart settlement file uploaded yet. Upload the settlement report to confirm whether this payout is genuinely missing.
                            </p>
                          </div>
                        )}
                      </section>

                      <section>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">
                          Why Flagged
                        </div>
                        <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[12.5px] text-slate-600">
                          No payment found after expected payout date
                          {drawerDaysOverdue > 0 && (
                            <span className="ml-1 font-semibold text-red-600">
                              ({drawerDaysOverdue} days overdue)
                            </span>
                          )}
                        </div>
                      </section>

                      {drawerCalculationBreakdown && (() => {
                        const cb = drawerCalculationBreakdown;
                        const calculationRows = [
                          {
                            label: "Gross order value",
                            sub: `₹${formatNumber(drawerSellingPrice)} × ${drawerQuantity}`,
                            value: `₹${formatNumber(asNumber(cb.gross_order_value))}`,
                            positive: true,
                          },
                          {
                            label: `Commission ${asNumber(cb.commission?.rate_percent)}%`,
                            sub: cb.commission?.slab_applied || "",
                            value: `-₹${formatNumber(asNumber(cb.commission?.expected))}`,
                            positive: false,
                          },
                          {
                            label: `GST ${asNumber(cb.gst?.rate_percent)}% on fees`,
                            sub: "On commission + fees",
                            value: `-₹${formatNumber(asNumber(cb.gst?.expected))}`,
                            positive: false,
                          },
                          {
                            label: `TCS ${asNumber(cb.tcs?.rate_percent)}%`,
                            sub: "On gross order value",
                            value: `-₹${formatNumber(asNumber(cb.tcs?.expected))}`,
                            positive: false,
                          },
                        ];

                        return (
                          <section>
                            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">
                              Expected Payout Calculation
                            </div>

                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                              {calculationRows.map((row, i) => (
                                <div
                                  key={row.label}
                                  className={`flex items-center justify-between px-4 py-2.5 ${
                                    i < calculationRows.length - 1 ? "border-b border-slate-100" : ""
                                  } ${i === 0 ? "bg-slate-50" : ""}`}
                                >
                                  <div>
                                    <div className="text-[12.5px] text-slate-600">{row.label}</div>
                                    {row.sub && <div className="text-[11px] text-slate-400">{row.sub}</div>}
                                  </div>
                                  <span
                                    className={`font-mono text-[13px] font-semibold ${
                                      row.positive ? "text-slate-800" : "text-slate-500"
                                    }`}
                                  >
                                    {row.value}
                                  </span>
                                </div>
                              ))}

                              <div className="flex items-center justify-between px-4 py-3 bg-teal-50 border-t border-teal-100">
                                <div>
                                  <div className="text-[12.5px] font-semibold text-teal-700">
                                    Estimated net payout
                                  </div>
                                  <div className="text-[11px] text-teal-600">
                                    After expected marketplace deductions
                                  </div>
                                </div>
                                <span className="font-mono text-[15px] font-bold text-teal-800">
                                  ~₹{formatNumber(asNumber(cb.summary?.expected_net_payout))}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 text-[11.5px] text-slate-400 italic">
                              ~ Estimated based on your active {marketplaceLabel(drawerData.marketplace)} rate card.
                              Closing fee{" "}
                              {cb.summary?.missing_rule_codes?.includes("closing_fee")
                                ? "not included — not configured in rate card."
                                : "included from rate card."}
                            </div>
                          </section>
                        );
                      })()}
                    </>
                  )}

                  {drawer.kind === "discrepancy" && drawerCalculationBreakdown && (() => {
                    const cb = drawerCalculationBreakdown;
                    const summary = cb.summary || {};
                    const missingRules = summary.missing_rule_codes || [];
                    const commissionDiscrepancy = asNumber(cb.commission?.discrepancy);
                    const effectiveRate = asNumber(cb.gross_order_value)
                      ? ((asNumber(cb.commission?.actual) / asNumber(cb.gross_order_value)) * 100).toFixed(1)
                      : "0.0";

                    return (
                      <section>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-teal-600">
                            ReconEasy Analysis
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                summary.confidence === "HIGH"
                                  ? "bg-teal-50 text-teal-700"
                                  : summary.confidence === "MEDIUM"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                              }`}
                            >
                              {summary.confidence || "LOW"} confidence
                            </span>
                          </div>
                        </div>

                        <div className="text-[14px] font-semibold text-slate-800 mb-3">Fee Breakdown</div>

                        <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                          <span className="text-[12.5px] text-slate-500">
                            Gross order value
                            <span className="ml-1.5 text-[11px] text-slate-400">
                              ₹{formatNumber(drawerSellingPrice)} × {drawerQuantity}
                            </span>
                          </span>
                          <span className="font-mono text-[13px] font-semibold text-slate-800">
                            ₹{formatNumber(asNumber(cb.gross_order_value))}
                          </span>
                        </div>

                        <div className="py-2.5 border-b border-slate-100">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[12.5px] text-slate-600">Commission</span>
                              <span className="ml-2 text-[11px] text-slate-400">
                                {cb.commission?.slab_applied || `${asNumber(cb.commission?.rate_percent)}%`}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-[13px] text-slate-600">
                                Expected: ₹{formatNumber(asNumber(cb.commission?.expected))}
                              </div>
                              <div
                                className={`font-mono text-[12px] font-semibold ${
                                  commissionDiscrepancy < -0.01 ? "text-red-600" : "text-slate-400"
                                }`}
                              >
                                Actual: ₹{formatNumber(asNumber(cb.commission?.actual))}
                                {Math.abs(commissionDiscrepancy) > 0.01 && (
                                  <span className="ml-1.5 text-red-600">
                                    ({commissionDiscrepancy < 0 ? "-" : "+"}₹{formatNumber(Math.abs(commissionDiscrepancy))})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="py-2.5 border-b border-slate-100">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[12.5px] text-slate-600">Closing fee</span>
                              <span className="ml-2 text-[11px] text-slate-400">
                                {cb.closing_fee?.fulfillment_type || drawerData.fulfillmentType || ""}
                              </span>
                              {missingRules.includes("closing_fee") && (
                                <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                  Not configured
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              {missingRules.includes("closing_fee") ? (
                                <span className="text-[12px] text-amber-600">
                                  Actual: ₹{formatNumber(asNumber(cb.closing_fee?.actual))}
                                </span>
                              ) : (
                                <>
                                  <div className="font-mono text-[13px] text-slate-600">
                                    Expected: ₹{formatNumber(asNumber(cb.closing_fee?.expected))}
                                  </div>
                                  <div className="font-mono text-[12px] text-slate-500">
                                    Actual: ₹{formatNumber(asNumber(cb.closing_fee?.actual))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="py-2.5 border-b border-slate-100">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[12.5px] text-slate-600">GST on fees</span>
                              <span className="ml-2 text-[11px] text-slate-400">
                                {asNumber(cb.gst?.rate_percent)}%
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-[13px] text-slate-600">
                                Expected: ₹{formatNumber(asNumber(cb.gst?.expected))}
                              </div>
                              <div className="font-mono text-[12px] text-slate-400 italic">
                                Settlement-level (not per-order)
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="py-2.5 border-b border-slate-100">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[12.5px] text-slate-600">TCS</span>
                              <span className="ml-2 text-[11px] text-slate-400">
                                {asNumber(cb.tcs?.rate_percent)}% of gross
                              </span>
                            </div>
                            <div className="font-mono text-[13px] text-slate-600">
                              ₹{formatNumber(asNumber(cb.tcs?.expected))}
                            </div>
                          </div>
                        </div>

                        <div className="py-2.5 border-b border-slate-100">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[12.5px] text-slate-600">Logistics</span>
                              {cb.logistics?.weight_grams && (
                                <span className="ml-2 text-[11px] text-slate-400">
                                  {cb.logistics.weight_grams}g
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-[13px] text-slate-500">
                                Actual: ₹{formatNumber(asNumber(cb.logistics?.actual))}
                              </div>
                              <div className="text-[11px] text-slate-400 italic">Zone not captured</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                            <span className="text-[12.5px] font-semibold text-slate-600">Expected net payout</span>
                            <span className="font-mono text-[14px] font-bold text-teal-700">
                              ₹{formatNumber(asNumber(summary.expected_net_payout))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-[12.5px] text-slate-500">Actual net payout</span>
                            <span className="font-mono text-[13px] text-slate-600">
                              ₹{formatNumber(asNumber(summary.actual_net_payout))}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="text-[11.5px] font-semibold text-slate-600 mb-1">Why flagged</div>
                          <p className="text-[12.5px] text-slate-500 leading-relaxed">
                            Commission charged was{" "}
                            <strong className="text-slate-700">
                              ₹{formatNumber(asNumber(cb.commission?.actual))}
                            </strong>{" "}
                            ({effectiveRate}% effective rate) against an expected{" "}
                            <strong className="text-slate-700">
                              ₹{formatNumber(asNumber(cb.commission?.expected))}
                            </strong>{" "}
                            ({asNumber(cb.commission?.rate_percent)}% per your rate card).
                          </p>
                        </div>

                        {missingRules.length > 0 && (
                          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-[12px] text-amber-700">
                              <strong>Confidence: {summary.confidence}</strong> —{" "}
                              {missingRules.includes("closing_fee") &&
                                "Closing fee rule not configured in your rate card. "}
                              Add fee rules to your rate card to improve calculation accuracy.
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })()}

                  {drawerData.rawSettlementLines?.length > 0 && (
                    <section>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Settlement Data</div>
                      <div className="text-[14px] font-semibold text-slate-800 mb-3">Raw Settlement Lines</div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                            <th className="text-left py-2">Fee Type</th>
                            <th className="text-right py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drawerData.rawSettlementLines.map((line: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="py-2.5 text-[12.5px] text-slate-600">{line.description || line.type}</td>
                              <td
                                className={`py-2.5 text-right font-mono text-[12.5px] font-semibold ${
                                  asNumber(line.amount) < 0 ? "text-red-600" : "text-teal-700"
                                }`}
                              >
                                {asNumber(line.amount) < 0
                                  ? `-₹${formatNumber(Math.abs(asNumber(line.amount)))}`
                                  : `+₹${formatNumber(asNumber(line.amount))}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {!drawerNeedsSettlementUpload && (
                    <section>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Claim Evidence</div>
                      {drawer.kind === "discrepancy" ? (
                        <div className="rounded-xl border border-teal-200 bg-teal-50 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-teal-100">
                            <span className="text-[13px] text-teal-700 font-medium">Commission overcharge</span>
                            <span className="font-mono text-[16px] font-bold text-teal-800">
                              ₹{formatNumber(Math.abs(asNumber(drawerData?.discrepancy)))}
                            </span>
                          </div>
                          <div className="px-4 py-2.5 text-[12px] text-teal-600">
                            Exact variance from settlement data · Run #{" "}
                            {drawerCalculationBreakdown?.run_id
                              ? String(drawerCalculationBreakdown.run_id).slice(0, 8)
                              : "—"}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 bg-teal-50 border-b border-teal-100">
                            <div>
                              <div className="text-[13px] font-semibold text-teal-700">
                                Estimated missing payout
                              </div>
                              <div className="text-[11px] text-teal-600">
                                After expected marketplace deductions
                              </div>
                            </div>
                            <span className="font-mono text-[16px] font-bold text-teal-800">
                              ~₹{formatNumber(drawerClaimable)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-[12px] text-slate-500">Order value at risk</span>
                            <span className="font-mono text-[12px] text-slate-600">
                              ₹{formatNumber(drawerSellingPrice)}
                            </span>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                  No detail available for this order.
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              {drawerNeedsSettlementUpload ? (
                <button
                  onClick={() => {
                    setDrawer(null);
                    navigate("/data-hub?subtab=settlements");
                  }}
                  className="flex-1 h-10 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  Upload Settlement File
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      handleCreateClaim(drawer.orderId);
                      setDrawer(null);
                    }}
                    className="flex-1 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    Create Claim
                  </button>
                  {drawer.kind === "discrepancy" && (
                    <button
                      onClick={handleExportCsv}
                      className="h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
                    >
                      Export Evidence
                    </button>
                  )}
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-5 min-w-[400px]">
          <span className="text-sm">
            <strong>{selected.size}</strong> selected ·{" "}
            <span className="text-teal-300 font-semibold">₹{formatNumber(bulkAmount)}</span> recoverable
          </span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setSelected(new Set())} className="text-sm text-slate-400 hover:text-white">
              Clear
            </button>
            <button
              onClick={handleBulkClaim}
              className="h-8 px-4 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold flex items-center gap-1.5"
            >
              <Ticket className="w-3.5 h-3.5" />
              Create {selected.size} claim{selected.size > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[460px]">
            <h3 className="text-[17px] font-semibold text-slate-900 mb-1">
              Create{" "}
              {rows.filter((row) => row.status === "OVERCHARGED" && row.claimState === "Not Raised").length +
                missingPayments.filter((row) => row.payment_status === "MISSING_PAYMENT").length}{" "}
              claims?
            </h3>
            <p className="text-[13px] text-slate-500 mb-4">
              Draft claims will be created for the following confirmed issues.
            </p>

            <div className="space-y-2 mb-4 max-h-[260px] overflow-y-auto">
              {rows
                .filter((row) => row.status === "OVERCHARGED" && row.claimState === "Not Raised")
                .map((row) => (
                  <div
                    key={row.orderId}
                    className="flex items-center justify-between text-[13px] bg-slate-50 rounded-lg px-3 py-2.5"
                  >
                    <div>
                      <span className="font-mono text-slate-800">{row.orderId}</span>
                      <span className="ml-2 text-[11px] text-slate-400">Commission overcharge</span>
                    </div>
                    <span className="text-red-600 font-semibold">
                      -₹{formatNumber(Math.abs(asNumber(row.totalDiscrepancy)))}
                    </span>
                  </div>
                ))}
              {missingPayments
                .filter((row) => row.payment_status === "MISSING_PAYMENT")
                .map((row) => (
                  <div
                    key={row.order_id}
                    className="flex items-center justify-between text-[13px] bg-slate-50 rounded-lg px-3 py-2.5"
                  >
                    <div>
                      <span className="font-mono text-slate-800">{row.order_id}</span>
                      <span className="ml-2 text-[11px] text-slate-400">Missing payment</span>
                    </div>
                    <span className="text-slate-600 font-semibold">
                      ₹{formatNumber(asNumber(row.selling_price))}
                    </span>
                  </div>
                ))}
            </div>

            {pendingUploadCount > 0 && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 mb-4 text-[12.5px] text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  {pendingUploadCount} Flipkart orders skipped — upload settlement file first to confirm payment status.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-teal-50 border border-teal-100 mb-5">
              <span className="text-[13px] text-teal-700 font-medium">Total claimable</span>
              <span className="font-mono text-[16px] font-bold text-teal-800">
                ₹{formatNumber(recoverableTotal)}
              </span>
            </div>

            {bulkResult && (
              <div
                className={`rounded-lg px-4 py-3 mb-4 text-[13px] font-medium ${
                  bulkResult.failed > 0
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-teal-50 text-teal-700 border border-teal-100"
                }`}
              >
                {bulkResult.created > 0 &&
                  `✓ ${bulkResult.created} claim${bulkResult.created === 1 ? "" : "s"} created`}
                {bulkResult.failed > 0 && ` · ${bulkResult.failed} failed — please try again`}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkConfirm(false);
                  setBulkResult(null);
                }}
                disabled={bulkCreating}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAllClaims}
                disabled={bulkCreating}
                className="flex-1 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create claims"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="fixed right-6 z-50 bg-slate-900 text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl animate-in slide-in-from-bottom-2"
          style={{ bottom: `${24 + index * 64}px` }}
        >
          <span className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3" />
          </span>
          <span className="text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
