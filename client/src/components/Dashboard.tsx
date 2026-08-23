import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Grid3X3,
  IndianRupee,
  Lock,
  RefreshCw,
  Sparkles,
  Tag,
} from "lucide-react";

type DashboardProps = {
  tenantId: string;
  onTabChange: (tab: string) => void;
};

type MarketplaceKey = "amazon" | "flipkart" | "myntra";

const MARKETPLACES: MarketplaceKey[] = ["amazon", "flipkart", "myntra"];

const marketplaceConfig: Record<MarketplaceKey, { bg: string; label: string; badge: string }> = {
  amazon: { bg: "#f59e0b", label: "Amazon", badge: "AMZ" },
  flipkart: { bg: "#3b82f6", label: "Flipkart", badge: "FK" },
  myntra: { bg: "#ec4899", label: "Myntra", badge: "MY" },
};

const formatNumber = (n: number | string | null | undefined) => {
  const num = Number.parseFloat(String(n ?? 0));
  if (!Number.isFinite(num)) return "0";
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toFixed(0);
};

const formatCurrency = (n: number | string | null | undefined) => {
  const num = Number.parseFloat(String(n ?? 0));
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateTime = (dt: string | null | undefined) => {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${d
    .toTimeString()
    .slice(0, 5)}`;
};

const formatShortDate = (dt: string | null | undefined) => {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
};

const parseCount = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseAmount = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getClaimsChartData = (statuses: any[] = []) => {
  const colorMap: Record<string, string> = {
    DRAFT: "#94a3b8",
    SUBMITTED: "#3b82f6",
    IN_REVIEW: "#8b5cf6",
    APPROVED: "#10b981",
    RECOVERED: "#059669",
    CLOSED: "#cbd5e1",
    FOLLOW_UP: "#f59e0b",
  };

  return statuses
    .filter((s) => s.claim_status)
    .map((s) => ({
      name: String(s.claim_status),
      value: parseCount(s.count),
      color: colorMap[String(s.claim_status)] || "#94a3b8",
    }));
};

const getHealthPercent = (health: any) => {
  const total = parseCount(health?.total);
  if (!total) return 0;
  return Math.round((parseCount(health?.matched) / total) * 100);
};

const getMismatchPercent = (health: any) => {
  const total = parseCount(health?.total);
  if (!total) return 0;
  return Math.round((parseCount(health?.mismatch) / total) * 100);
};

const getMissingPercent = (health: any) => {
  const total = parseCount(health?.total);
  if (!total) return 0;
  const missing = parseCount(health?.missing_payment);
  return Math.round((missing / total) * 100);
};

function InstantTooltip({ text }: { text: string }) {
  return (
    <span className="relative group cursor-help ml-1">
      <span className="text-slate-400 group-hover:text-slate-500 text-xs">ⓘ</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-72 rounded bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-none pointer-events-none z-50 whitespace-normal leading-relaxed normal-case tracking-normal text-left">
        {text}
      </span>
    </span>
  );
}

function MarketplaceBadge({ marketplace }: { marketplace: string }) {
  const key = String(marketplace || "").toLowerCase() as MarketplaceKey;
  const config = marketplaceConfig[key] || { bg: "#94a3b8", label: marketplace || "Unknown", badge: "MP" };

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ background: config.bg }} />
      <span className="text-[13px] text-slate-600 dark:text-slate-300">{config.label}</span>
    </div>
  );
}

function KPITile({
  label,
  value,
  subtitle,
  delta,
  deltaDir,
  deltaLabel,
  tooltip,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  subtitle: string;
  delta?: string;
  deltaDir?: "up" | "down";
  deltaLabel?: string;
  tooltip: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="min-h-[110px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
          <InstantTooltip text={tooltip} />
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>{icon}</div>
      </div>
      <div className="mb-1 text-2xl font-bold leading-none text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-1 mb-2 text-xs text-slate-400">{subtitle}</div>
      {delta ? (
        <div
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
            deltaDir === "up" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {deltaDir === "up" ? "↑" : "↓"} {delta}
          {deltaLabel && <span className="ml-1 font-normal text-slate-400">{deltaLabel}</span>}
        </div>
      ) : (
        deltaLabel && <div className="text-[11px] text-slate-400">{deltaLabel}</div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 bg-slate-50 px-8 py-6 dark:bg-slate-900">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="col-span-3 h-80 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
        <div className="col-span-2 h-80 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function Dashboard({ tenantId, onTabChange }: DashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [marketplace, setMarketplace] = useState("all");

  useEffect(() => {
    let cancelled = false;

    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/dashboard?tenant_id=${tenantId}&days=${period}&marketplace=${marketplace}`,
        );
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("Dashboard fetch failed:", err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, [tenantId, period, marketplace]);

  const claimsChartData = useMemo(() => getClaimsChartData(data?.claims_status), [data?.claims_status]);
  const ageingChartData = useMemo(
    () => [
      { name: "0-7 days", value: parseCount(data?.missing_payments_ageing?.days_0_7), color: "#10b981" },
      { name: "8-15 days", value: parseCount(data?.missing_payments_ageing?.days_8_15), color: "#f59e0b" },
      { name: "16-30 days", value: parseCount(data?.missing_payments_ageing?.days_16_30), color: "#f97316" },
      { name: "30+ days", value: parseCount(data?.missing_payments_ageing?.days_30_plus), color: "#ef4444" },
    ],
    [data?.missing_payments_ageing],
  );

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["metric", "value"],
      ["total_revenue", data.kpis?.total_revenue ?? 0],
      ["total_leakage", data.kpis?.total_leakage ?? 0],
      ["missing_payments_count", data.kpis?.missing_payments_count ?? 0],
      ["claims_count", data.kpis?.claims_count ?? 0],
      ["active_rate_cards", data.kpis?.active_rate_cards ?? 0],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-summary-${period}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxLeakage = Math.max(
    1,
    ...(data?.leakage_by_marketplace?.map((row: any) => parseAmount(row.leakage)) ?? [0]),
  );

  const healthTotal = parseCount(data?.reconciliation_health?.total);
  const healthMatched = parseCount(data?.reconciliation_health?.matched);
  const healthMismatch = parseCount(data?.reconciliation_health?.mismatch);
  const healthMissing = parseCount(data?.reconciliation_health?.missing_payment);
  const healthMatchRate = healthTotal ? Math.round((healthMatched / healthTotal) * 100) : 0;

  return (
    <div className="min-h-full overflow-x-hidden bg-slate-50 dark:bg-slate-900">
      <div className="bg-gradient-to-br from-[#0c5d49] to-[#0f6e56] px-8 py-6">
        <div className="mb-3 text-xs text-teal-200/70">Workspace › Dashboard</div>
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
            <p className="mt-0.5 text-sm text-teal-100/70">Financial reconciliation overview</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {data?.last_reconciliation && (
              <div className="flex items-center gap-2 text-xs text-teal-100/80">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Last reconciliation: {formatDateTime(data.last_reconciliation)}
              </div>
            )}
            <button
              onClick={handleExport}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-xs font-medium text-white hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={() => onTabChange("payment_reconciliation_v2")}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Run reconciliation
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-8 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white"
          >
            <option className="text-slate-900" value="7">Last 7 Days</option>
            <option className="text-slate-900" value="30">Last 30 Days</option>
            <option className="text-slate-900" value="90">Last 90 Days</option>
          </select>
          <select
            value={marketplace}
            onChange={(event) => setMarketplace(event.target.value)}
            className="h-8 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white"
          >
            <option className="text-slate-900" value="all">All Marketplaces</option>
            <option className="text-slate-900" value="amazon">Amazon</option>
            <option className="text-slate-900" value="flipkart">Flipkart</option>
            <option className="text-slate-900" value="myntra">Myntra</option>
          </select>
          <div className="flex h-8 cursor-not-allowed items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/40">
            Category
            <span className="rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">SOON</span>
          </div>
          <select className="h-8 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white">
            <option className="text-slate-900">All Statuses</option>
            <option className="text-slate-900">Matched</option>
            <option className="text-slate-900">Mismatch</option>
            <option className="text-slate-900">Missing Payment</option>
            <option className="text-slate-900">Claimable</option>
          </select>
          <select className="h-8 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white">
            <option className="text-slate-900">All Claim Stages</option>
            <option className="text-slate-900">Draft</option>
            <option className="text-slate-900">Submitted</option>
            <option className="text-slate-900">In Review</option>
            <option className="text-slate-900">Approved</option>
            <option className="text-slate-900">Recovered</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-6 bg-slate-50 px-8 py-6 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KPITile
              label="Total Revenue"
              value={`₹${formatNumber(data?.kpis?.total_revenue)}`}
              subtitle="Based on uploaded order data"
              delta="+12.4%"
              deltaDir="up"
              deltaLabel="vs prev. 30d"
              tooltip="Gross order value before marketplace deductions"
              icon={<IndianRupee className="h-5 w-5" />}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            />
            {[
              {
                label: "Fee Overcharge",
                value: data?.kpis?.fee_overcharge_leakage,
                color: "bg-amber-500",
                text: "text-amber-500",
                subtitle: "Marketplace fee mismatches",
                tooltip: "Marketplace fee mismatches detected by ReconEasy analysis on delivered orders.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="min-h-[110px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {item.label}
                    </span>
                    <InstantTooltip text={item.tooltip} />
                  </div>
                  <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                </div>
                <div className={`mb-1 font-mono text-2xl font-bold leading-none ${item.text}`}>
                  ₹{formatCurrency(item.value)}
                </div>
                <div className="mt-1 text-xs text-slate-400">{item.subtitle}</div>
              </div>
            ))}
            <KPITile
              label="Missing Payments"
              value={`${parseCount(data?.missing_payments?.total ?? data?.kpis?.missing_payments_count)}`}
              subtitle={
                parseCount(data?.missing_payments?.confirmed_missing) > 0 ||
                parseCount(data?.missing_payments?.settlement_not_uploaded) > 0
                  ? `${parseCount(data?.missing_payments?.confirmed_missing)} confirmed · ${parseCount(
                      data?.missing_payments?.settlement_not_uploaded,
                    )} need upload`
                  : `Orders · ₹${formatNumber(data?.kpis?.missing_payments_amount)} pending`
              }
              deltaLabel="No change vs prev. 30d"
              tooltip="Orders delivered but not yet settled by marketplace"
              icon={<Clock className="h-5 w-5" />}
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
            <KPITile
              label="Claims in Progress"
              value={`${parseCount(data?.kpis?.claims_count)}`}
              subtitle={`Claims · ₹${formatNumber(data?.kpis?.claims_amount)} claimed`}
              delta="+2 this week"
              deltaDir="up"
              deltaLabel="vs prev. 30d"
              tooltip="Active claims being processed with marketplaces"
              icon={<FileText className="h-5 w-5" />}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KPITile
              label="Active Rate Cards"
              value={`${parseCount(data?.kpis?.active_rate_cards)}`}
              subtitle={
                parseCount(data?.kpis?.expiring_rate_cards) > 0
                  ? `${parseCount(data.kpis.expiring_rate_cards)} expiring soon`
                  : "Stable vs prev. 30d"
              }
              tooltip="Fee schedules used for reconciliation calculations"
              icon={<Tag className="h-5 w-5" />}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:col-span-3">
              <div className="mb-1 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Revenue Trend</h3>
                  <p className="text-[12px] text-slate-500">Based on dispatch date from uploaded orders</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-500 dark:bg-slate-700">
                    <div className="h-2 w-2 rounded-full bg-teal-500" />
                    Daily revenue
                  </div>
                  <button className="flex items-center gap-1 text-[12px] text-teal-600 hover:text-teal-700">
                    Open report <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {data?.revenue_trend?.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.revenue_trend}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatShortDate} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₹${formatNumber(value)}`} />
                    <Tooltip formatter={(value) => [`₹${formatNumber(String(value))}`, "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#0f6e56" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
                  More order history needed to show a reliable trend.
                </div>
              )}

              <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                <p className="text-[11px] text-slate-400">ⓘ Actual settled amount may differ after marketplace deductions.</p>
                <span className="text-[12px] text-slate-500">
                  Total: ₹{formatNumber(data?.kpis?.total_revenue)} · {period} days
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:col-span-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Leakage by Marketplace</h3>
                  <p className="text-[12px] text-slate-500">Detected losses across connected channels</p>
                </div>
                {parseAmount(data?.kpis?.total_leakage) > 0 && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-red-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />₹{formatNumber(data.kpis.total_leakage)} total
                  </span>
                )}
              </div>
              <div className="space-y-4">
                {MARKETPLACES.map((mp) => {
                  const mpData = data?.leakage_by_marketplace?.find((row: any) => row.marketplace === mp);
                  const leakage = parseAmount(mpData?.leakage);
                  const pct = leakage > 0 ? (leakage / maxLeakage) * 100 : 0;
                  const config = marketplaceConfig[mp];

                  return (
                    <div key={mp} className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full" style={{ background: config.bg }} />
                      <span className="w-16 text-[13px] capitalize text-slate-600 dark:text-slate-300">{mp}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        {leakage > 0 && <div className="h-full rounded-full bg-red-500" style={{ width: `${pct}%` }} />}
                      </div>
                      <span className={`w-16 text-right text-[13px] font-medium ${leakage > 0 ? "text-red-600" : "text-slate-400"}`}>
                        {leakage > 0 ? `₹${formatNumber(leakage)}` : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {parseAmount(data?.kpis?.total_leakage) > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <span className="text-amber-500">⚠</span>
                  <span className="text-[12px] text-amber-800">
                    1 overcharge detected on Amazon.{" "}
                    <button onClick={() => onTabChange("payment_reconciliation_v2")} className="text-teal-600 underline">
                      Review →
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Claims Status</h3>
                  <p className="text-[12px] text-slate-500">Lifecycle distribution across all claims</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-[12px] font-medium text-purple-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  {parseCount(data?.kpis?.claims_count)} total
                </span>
              </div>
              {claimsChartData.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={claimsChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                      {claimsChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[180px] items-center justify-center text-sm text-slate-400">No claims yet.</div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {claimsChartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
                      <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Missing Payments Ageing</h3>
                  <p className="text-[12px] text-slate-500">How long settlements have been overdue</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[12px] font-medium text-red-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {parseCount(data?.kpis?.missing_payments_count)} orders
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={ageingChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                    {ageingChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {ageingChartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
                      <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Reconciliation Health</h3>
                  <p className="text-[12px] text-slate-500">Breakdown across {healthTotal} records this period</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[12px] font-medium text-emerald-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {getHealthPercent(data?.reconciliation_health)}% healthy
                </span>
              </div>
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-500" style={{ width: `${getHealthPercent(data?.reconciliation_health)}%` }} />
                <div className="bg-amber-400" style={{ width: `${getMismatchPercent(data?.reconciliation_health)}%` }} />
                <div className="bg-red-400" style={{ width: `${getMissingPercent(data?.reconciliation_health)}%` }} />
              </div>
              <div className="space-y-2">
                {[
                  { label: "Matched", count: healthMatched, color: "#10b981" },
                  { label: "Mismatch", count: healthMismatch, color: "#f59e0b" },
                  { label: "Missing Payment", count: healthMissing, color: "#ef4444" },
                  { label: "Total", count: healthTotal, color: "#94a3b8" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
                      <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {healthMatched}/{healthTotal} = {healthMatchRate}% matched
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Marketplace Health</h3>
                <p className="text-[12px] text-slate-500">Snapshot of each connected channel</p>
              </div>
              <button onClick={() => onTabChange("reconciliation")} className="text-[12px] text-teal-600 hover:text-teal-700">
                Manage marketplaces →
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {MARKETPLACES.map((mp) => {
                const mpHealth = data?.marketplace_health?.find((row: any) => row.marketplace === mp);
                const returnLeakage = parseAmount(mpHealth?.return_leakage);
                const feeLeakage = parseAmount(mpHealth?.fee_leakage);
                const leakage = parseAmount(mpHealth?.leakage ?? returnLeakage + feeLeakage);
                const overcharges = parseCount(mpHealth?.overcharges);
                const orders = parseCount(mpHealth?.order_count);
                const isHealthy = leakage === 0 && overcharges === 0;
                const config = marketplaceConfig[mp];

                return (
                  <div key={mp} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: config.bg }}>
                          {config.badge}
                        </div>
                        <span className="text-[14px] font-medium capitalize text-slate-800 dark:text-slate-100">{mp}</span>
                      </div>
                      <span className={`flex items-center gap-1 text-[12px] font-medium ${isHealthy ? "text-emerald-600" : "text-amber-600"}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {isHealthy ? "Healthy" : "Review needed"}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Return Leakage</div>
                        <div className={`font-mono text-[13px] font-semibold ${returnLeakage > 0 ? "text-orange-600" : "text-slate-700 dark:text-slate-200"}`}>
                          ₹{formatCurrency(returnLeakage)}
                        </div>
                        <div className="text-[10px] text-slate-400">{returnLeakage > 0 ? "returns" : "none"}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Fee Leakage</div>
                        <div className={`font-mono text-[13px] font-semibold ${feeLeakage > 0 ? "text-amber-600" : "text-slate-700 dark:text-slate-200"}`}>
                          ₹{formatCurrency(feeLeakage)}
                        </div>
                        <div className="text-[10px] text-slate-400">{feeLeakage > 0 ? "fees" : "none"}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Overcharges</div>
                        <div className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{overcharges}</div>
                        <div className="text-[10px] text-slate-400">{overcharges > 0 ? "fee mismatches" : "fees match"}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Orders</div>
                        <div className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{orders}</div>
                        <div className="text-[10px] text-slate-400">uploaded</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Top Leakage Orders</h3>
                  <p className="text-[12px] text-slate-500">Highest detected losses - claim recommended</p>
                </div>
                <button onClick={() => onTabChange("returns")} className="text-[12px] text-teal-600">View all →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:border-slate-700">
                      <th className="px-5 py-3 text-left">Order ID</th>
                      <th className="px-3 py-3 text-left">Marketplace</th>
                      <th className="px-3 py-3 text-right">Expected</th>
                      <th className="px-3 py-3 text-right">Actual</th>
                      <th className="px-3 py-3 text-right">Leakage</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.top_leakage_orders?.filter((order: any) => order.leakage_type === "FEE_OVERCHARGE").length ? (
                      data.top_leakage_orders.filter((order: any) => order.leakage_type === "FEE_OVERCHARGE").map((order: any) => {
                        const leakageBadge =
                          order.leakage_type === "FEE_OVERCHARGE"
                            ? {
                                label: "Fee Overcharge",
                                className: "bg-amber-100 text-amber-700",
                              }
                            : {
                                label: "Return Leakage",
                                className: "bg-orange-100 text-orange-700",
                              };

                        return (
                          <tr key={order.order_id} className="border-b border-slate-50 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{order.order_id}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${leakageBadge.className}`}>
                                  {leakageBadge.label}
                                </span>
                              </div>
                            </td>
	                            <td className="px-3 py-3"><MarketplaceBadge marketplace={order.marketplace} /></td>
	                            <td className="px-3 py-3 text-right text-[13px] text-slate-600">
	                              {order.expected_net_payout != null ? `₹${formatCurrency(order.expected_net_payout)}` : "-"}
	                            </td>
	                            <td className="px-3 py-3 text-right text-[13px] text-slate-600">
	                              {order.actual_net_payout != null ? `₹${formatCurrency(order.actual_net_payout)}` : "-"}
	                            </td>
                            <td className="px-3 py-3 text-right font-mono text-[13px] font-medium text-red-600">
                              -₹{formatCurrency(order.leakage_amount)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => onTabChange("claims")} className="rounded-lg border border-teal-200 px-3 py-1.5 text-[12px] text-teal-700 hover:bg-teal-50">
                                Create Claim
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-[13px] text-slate-400">No leakage orders found for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Missing Payment Orders</h3>
                  <p className="text-[12px] text-slate-500">Dispatched orders without settlement</p>
                </div>
                <button onClick={() => onTabChange("payment_reconciliation_v2")} className="text-[12px] text-teal-600">View all →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:border-slate-700">
                      <th className="px-5 py-3 text-left">Order ID</th>
                      <th className="px-3 py-3 text-left">Marketplace</th>
                      <th className="px-3 py-3 text-left">Order Date</th>
                      <th className="px-3 py-3 text-right">Expected</th>
                      <th className="px-3 py-3 text-right">Days</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.missing_payment_orders?.length ? (
                      data.missing_payment_orders.map((order: any) => (
                        <tr key={order.order_id} className="border-b border-slate-50 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
                          <td className="px-5 py-3 text-[13px] font-medium text-slate-800 dark:text-slate-100">{order.order_id}</td>
                          <td className="px-3 py-3"><MarketplaceBadge marketplace={order.marketplace} /></td>
                          <td className="px-3 py-3 text-[13px] text-slate-500">{formatShortDate(order.dispatch_date)}</td>
                          <td className="px-3 py-3 text-right text-[13px] text-slate-600">₹{formatNumber(order.selling_price)}</td>
                          <td className="px-3 py-3 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                                parseCount(order.days_pending) > 30
                                  ? "bg-red-100 text-red-700"
                                  : parseCount(order.days_pending) > 15
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {parseCount(order.days_pending)}d
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => onTabChange("claims")} className="rounded-lg border border-teal-200 px-3 py-1.5 text-[12px] text-teal-700 hover:bg-teal-50">
                              Raise Claim
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-[13px] text-slate-400">No missing payment orders.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Recent Reconciliation Runs</h3>
                  <p className="text-[12px] text-slate-500">Last 24 hours · automated and manual runs</p>
                </div>
                <button onClick={() => onTabChange("payment_reconciliation_v2")} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] text-slate-600 hover:bg-slate-50">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Run now
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:border-slate-700">
                      <th className="px-5 py-3 text-left">Run</th>
                      <th className="px-3 py-3 text-right">Matched</th>
                      <th className="px-3 py-3 text-right">Overcharged</th>
                      <th className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Missing</span>
                          <span className="relative group cursor-help">
                            <span className="text-slate-400 group-hover:text-slate-600 text-xs">ⓘ</span>
                            <span className="absolute top-full right-0 mt-1 w-64 rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-none pointer-events-none z-50 whitespace-normal normal-case tracking-normal text-left">
                              Orders absent from the reconciled settlement file. Does not include orders from marketplaces without an uploaded settlement.
                            </span>
                          </span>
                        </div>
                      </th>
                      <th className="px-5 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_runs?.length ? (
                      data.recent_runs.map((run: any) => (
                        <tr key={run.id} className="border-b border-slate-50 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
                          <td className="px-5 py-3">
                            <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                              Run #{run.run_number ?? "-"}
                            </div>
                            <div className="text-[11px] text-slate-400">{formatDateTime(run.completed_at)}</div>
                          </td>
                          <td className="px-3 py-3 text-right text-[13px] font-semibold text-emerald-600">
                            {parseCount(run.orders_matched)}
                          </td>
                          <td className="px-3 py-3 text-right text-[13px] font-semibold text-amber-600">
                            {parseCount(run.orders_overcharged)}
                          </td>
                          <td className="px-3 py-3 text-right text-[13px] font-semibold text-red-600">
                            {parseCount(run.orders_missing)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                run.status === "COMPLETED"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : run.status === "FAILED"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              ● {run.status === "COMPLETED" ? "Completed" : run.status === "FAILED" ? "Failed" : "Running"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-[13px] text-slate-400">No reconciliation runs yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Rate Card Coverage</h3>
                  <p className="text-[12px] text-slate-500">Active fee schedules per marketplace</p>
                </div>
                <button onClick={() => onTabChange("rate_cards")} className="text-[12px] text-teal-600">Manage rate cards →</button>
              </div>
              <div className="space-y-4">
                {MARKETPLACES.map((mp) => {
                  const config = marketplaceConfig[mp];
                  const row = data?.rate_cards?.by_marketplace?.find((item: any) => item.marketplace === mp);
                  const active = parseCount(row?.active);
                  const expiring = parseCount(row?.expiring_soon);
                  const expired = parseCount(row?.expired);
                  const width = Math.min(100, (active / 10) * 100);

                  return (
                    <div key={mp} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: config.bg }}>
                        {config.badge}
                      </div>
                      <span className="w-16 text-[13px] capitalize text-slate-700 dark:text-slate-300">{mp}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className="h-full rounded-full" style={{ width: `${width}%`, background: expired ? "#ef4444" : config.bg }} />
                      </div>
                      <span className="w-16 text-right text-[12px] text-slate-600">{active} active</span>
                      {expiring > 0 && <span className="whitespace-nowrap text-[11px] font-medium text-amber-600">{expiring} expiring soon ⚠</span>}
                      {expired > 0 && <span className="whitespace-nowrap text-[11px] font-medium text-red-600">{expired} expired ⚠</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700">
                <span className="text-[12px] text-slate-500">{parseCount(data?.kpis?.active_rate_cards)} rate cards · 3 marketplaces</span>
                <button onClick={() => onTabChange("rate_cards")} className="flex items-center gap-1 text-[12px] text-teal-600">
                  Add new +
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                    <Sparkles className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">RIA - Key Insights</h3>
                    <p className="text-[11px] text-slate-500">AI-powered reconciliation copilot</p>
                  </div>
                </div>
                <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700">COMING SOON</span>
              </div>
              <div className="mb-4 space-y-2">
                {["Why leakage increased this week", "Which claims to raise first for fastest recovery", "Payment delay pattern detected on Flipkart"].map((insight) => (
                  <div key={insight} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-700/40">
                    <Lock className="h-4 w-4 text-slate-300" />
                    <span className="text-[12px] text-slate-400">{insight}</span>
                  </div>
                ))}
              </div>
              <button className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 text-[13px] font-medium text-white hover:bg-teal-700">
                <Bell className="h-3.5 w-3.5" />
                Notify me when RIA launches
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">GST Summary</h3>
                    <p className="text-[11px] text-slate-500">Tax-level reconciliation reporting</p>
                  </div>
                </div>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">SETUP REQUIRED</span>
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
                Add your GSTIN and tax configuration to enable GST-level reconciliation summaries across marketplaces.
              </p>
              <div className="mb-4 flex gap-2">
                {["GSTIN", "TAX SLABS", "HSN MAP"].map((chip) => (
                  <span key={chip} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-400">· {chip}</span>
                ))}
              </div>
              <button onClick={() => onTabChange("settings")} className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50">
                Configure GST Details <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                    <Grid3X3 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Revenue by Category</h3>
                    <p className="text-[11px] text-slate-500">Category-level profitability</p>
                  </div>
                </div>
                <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700">SETUP REQUIRED</span>
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
                Upload your <strong>product catalog</strong> to unlock category-level revenue and profitability insights.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {["Apparel", "Beauty", "Home", "Accessories"].map((cat) => (
                  <span key={cat} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-400">{cat}</span>
                ))}
              </div>
              <button className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50">
                Upload Product Catalog <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
