import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardList, Upload, X } from "lucide-react";
import Papa from "papaparse";
import { DEFAULT_TENANT_ID } from "../config/tenant";
import { mapReturnsCsvRow, validateMappedRow } from "../utils/returnsCsvMapper";

type ReturnsTab = "settlement" | "operational";

type ReturnRow = {
  id: string;
  marketplace: string;
  order_id: string;
  return_id: string;
  sku: string;
  return_date: string | null;
  qty_returned: number;
  return_reason_desc: string | null;
  return_status: string | null;
  refund_amount: string | number | null;
  commission_reversal: string | number | null;
  logistics_reversal: string | number | null;
  expected_refund_amount: string | number | null;
  expected_commission_reversal: string | number | null;
  expected_logistics_reversal: string | number | null;
  reconciliation_status: "matched" | "mismatch" | "no_data" | string | null;
  leakage_amount: string | number | null;
};

type ReturnsSummary = {
  total_returns: string | number;
};

const tabs: Array<{ key: ReturnsTab; label: string }> = [
  { key: "settlement", label: "Settlement Movement" },
  { key: "operational", label: "Operational Disputes" },
];

const formatCurrency = (value: string | number | null | undefined) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

const getDisputeType = (reason: string | null | undefined) => {
  const normalized = (reason || "").toLowerCase();
  if (normalized.includes("commission reversal missing")) return "Commission Not Reversed";
  if (normalized.includes("partial refund")) return "Partial Refund Posted";
  return "Normal Customer Return";
};

const getStatusMeta = (status: ReturnRow["reconciliation_status"]) => {
  if (status === "mismatch") {
    return {
      label: "Needs Review",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (status === "matched") {
    return {
      label: "Settled",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return {
    label: "Pending",
    className: "bg-slate-100 text-slate-600",
  };
};

const getRowTone = (status: ReturnRow["reconciliation_status"]) => {
  if (status === "matched") return "bg-emerald-50/30";
  if (status === "mismatch") return "bg-amber-50/40";
  return "";
};

const asNumber = (value: string | number | null | undefined) => Number(value ?? 0) || 0;

const getNetSettlementImpact = (row: ReturnRow) =>
  asNumber(row.refund_amount) + asNumber(row.commission_reversal) + asNumber(row.logistics_reversal);

type ReturnsProps = {
  tenantId?: string;
};

export default function Returns({ tenantId = DEFAULT_TENANT_ID }: ReturnsProps) {
  const [activeTab, setActiveTab] = useState<ReturnsTab>("settlement");
  const [marketplace, setMarketplace] = useState("");
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [summary, setSummary] = useState<ReturnsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/returns?tenant_id=${tenantId}&marketplace=${encodeURIComponent(marketplace)}`,
      );
      const data = await response.json();
      setReturns(data.returns || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error("Failed to fetch returns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReturns();
  }, [marketplace, tenantId]);

  const handleUploadFile = (file: File) => {
    setUploadError(null);
    setUploadMessage(null);
    setConflictWarning(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const mappedRows = results.data.map(mapReturnsCsvRow);
        const validationErrors = mappedRows.flatMap((row, index) =>
          validateMappedRow(row).map((field) => `Row ${index + 2}: missing ${field}`),
        );

        if (validationErrors.length > 0) {
          setUploadError(validationErrors.slice(0, 5).join("; "));
          return;
        }

        setUploading(true);
        try {
          const response = await fetch("/api/returns/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenant_id: tenantId,
              marketplace,
              returns: mappedRows,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Upload failed");

          setUploadMessage(`${data.processed} returns processed`);
          setConflictWarning(data.conflict_warning || null);
          await fetchReturns();
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : "Upload failed");
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => setUploadError(error.message),
    });
  };

  const totalReturns = Number(summary?.total_returns ?? returns.length);
  const needsReviewCount = returns.filter((row) => row.reconciliation_status === "mismatch").length;
  const settledCount = returns.filter((row) => row.reconciliation_status === "matched").length;
  const settlementGap = returns
    .filter((row) => row.reconciliation_status === "mismatch")
    .reduce((sum, row) => sum + asNumber(row.leakage_amount), 0);
  const conflictWarningText =
    conflictWarning?.replace(/\s*Review your rate cards\.?$/i, "") ?? null;

  const metricTiles = [
    {
      label: "Total Returns",
      value: totalReturns.toLocaleString("en-IN"),
      valueClass: "text-slate-900",
      tooltip: "Total return orders uploaded this cycle.",
    },
    {
      label: "Needs Review",
      value: needsReviewCount.toLocaleString("en-IN"),
      valueClass: "text-amber-600",
      tooltip: "Returns where settlement movement does not match expected reversal pattern.",
    },
    {
      label: "Settlement Gap",
      value: formatCurrency(settlementGap),
      valueClass: "text-red-600 font-mono",
      tooltip:
        "Settlement Gap is based on captured refund/reversal fields and indicates returns that need review. It is not automatically treated as a claimable amount.",
    },
    {
      label: "Settled",
      value: settledCount.toLocaleString("en-IN"),
      valueClass: "text-emerald-600",
      tooltip: "Returns where settlement movement appears complete.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-page-title font-medium text-slate-900">Returns</h1>
          <p className="mt-1 text-meta text-slate-500">
            Review return settlement movement and track operational disputes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={marketplace}
            onChange={(event) => setMarketplace(event.target.value)}
            className="h-[var(--re-height-input)] rounded-lg border border-slate-200 bg-white px-3 text-body text-slate-700"
          >
            <option value="">All marketplaces</option>
            <option value="amazon">Amazon</option>
            <option value="flipkart">Flipkart</option>
            <option value="myntra">Myntra</option>
          </select>
          <a
            href="/templates/returns-template.csv"
            download="returns-template.csv"
            className="inline-flex h-[var(--re-height-btn)] items-center rounded-lg border border-slate-200 px-4 text-body font-medium text-slate-700 hover:bg-slate-50"
          >
            Template
          </a>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleUploadFile(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-[var(--re-height-btn)] items-center gap-2 rounded-lg bg-teal-600 px-4 text-body font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "settlement" && (
        <div className="space-y-5">
          {conflictWarningText && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <div>
                {conflictWarningText}{" "}
                <a href="/rate-cards" className="font-medium underline">
                  Review your rate cards
                </a>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {uploadMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {uploadMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {metricTiles.map((tile) => (
              <div
                key={tile.label}
                className="min-h-[110px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-400">
                  <span>{tile.label}</span>
                  <InstantTooltip text={tile.tooltip} />
                </div>
                <p className={`mt-3 text-2xl font-bold ${tile.valueClass}`}>{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-heading font-medium text-slate-900">Settlement Movement</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table-fixed w-full min-w-[1320px] text-body">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="w-[10%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Return ID</th>
                    <th className="w-[11%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Order ID</th>
                    <th className="w-[9%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">SKU</th>
                    <th className="w-[10%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Return Date</th>
                    <th className="w-[14%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Dispute Type</th>
                    <th className="w-[18%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Settlement Movement</th>
                    <th className="w-[10%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Settlement Gap</th>
                    <th className="w-[8%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Status</th>
                    <th className="w-[14%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Loading returns...
                      </td>
                    </tr>
                  ) : returns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No returns uploaded yet.
                      </td>
                    </tr>
                  ) : (
                    returns.map((row) => {
                      const statusMeta = getStatusMeta(row.reconciliation_status);
                      const gap = asNumber(row.leakage_amount);
                      const commissionReversal = asNumber(row.commission_reversal);
                      const needsReview = row.reconciliation_status === "mismatch";

                      return (
                        <tr key={row.id} className={`${getRowTone(row.reconciliation_status)} hover:bg-slate-50`}>
                          <td className="px-4 py-[14px] font-mono text-body text-slate-900">{row.return_id}</td>
                          <td className="px-4 py-[14px] font-mono text-body text-slate-900">{row.order_id}</td>
                          <td className="px-4 py-[14px] text-body text-slate-700">{row.sku}</td>
                          <td className="px-4 py-[14px] text-body text-slate-600">{formatDate(row.return_date)}</td>
                          <td className="px-4 py-[14px]">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {getDisputeType(row.return_reason_desc)}
                            </span>
                          </td>
                          <td className="px-4 py-[14px] text-sm text-slate-600">
                            Refund {formatCurrency(row.refund_amount)}
                            {commissionReversal !== 0 && <> · Commission {formatCurrency(row.commission_reversal)}</>}
                          </td>
                          <td className="px-4 py-[14px] text-right">
                            {gap > 0 ? (
                              <span className="font-mono font-medium text-red-600">
                                -{formatCurrency(gap)}
                              </span>
                            ) : (
                              <span className="font-mono text-emerald-600">₹0</span>
                            )}
                          </td>
                          <td className="px-4 py-[14px]">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-[14px] text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => setSelectedReturn(row)}
                                className="text-xs font-medium text-teal-700 hover:text-teal-800"
                              >
                                View
                              </button>
                              {needsReview && (
                                <>
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-slate-600 hover:text-slate-800"
                                  >
                                    Mark Reviewed
                                  </button>
                                  <span className="relative group cursor-help">
                                    <button
                                      type="button"
                                      disabled
                                      className="cursor-not-allowed text-xs font-medium text-slate-300"
                                    >
                                      Link to Dispute
                                    </button>
                                    <span className="absolute bottom-full right-0 mb-1 w-56 rounded bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-none pointer-events-none z-50 whitespace-normal leading-relaxed text-left">
                                      Coming soon — Operational Disputes tab
                                    </span>
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "operational" && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-slate-100 p-4">
            <ClipboardList className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700">
            Operational Dispute Tracking
          </h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
            Track in-transit delays, delivered-not-received cases, wrong or damaged items,
            and lost returns. Requires warehouse status data or WMS integration.
          </p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-400">
            <span>In-transit overdue</span>
            <span>Delivered not received</span>
            <span>Wrong / damaged / fake item</span>
            <span>Lost in transit</span>
          </div>
          <button
            disabled
            className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400 cursor-not-allowed"
          >
            Connect WMS to unlock
          </button>
        </div>
      )}

      {selectedReturn && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedReturn(null)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[15px] font-semibold text-slate-900">
                      {selectedReturn.return_id}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusMeta(selectedReturn.reconciliation_status).className}`}>
                      {getStatusMeta(selectedReturn.reconciliation_status).label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Return settlement detail</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Order Details
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Order ID", value: selectedReturn.order_id, mono: true },
                    { label: "SKU", value: selectedReturn.sku, mono: true },
                    { label: "Return Date", value: formatDate(selectedReturn.return_date) },
                    { label: "Marketplace", value: selectedReturn.marketplace },
                    { label: "Reason", value: selectedReturn.return_reason_desc || "—" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <span className="text-sm text-slate-400">{item.label}</span>
                      <span className={`text-right text-sm font-medium text-slate-700 ${item.mono ? "font-mono" : ""}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Settlement Movement
                </h3>
                <div className="rounded-xl border border-slate-200">
                  {[
                    { label: "Refund amount", value: formatCurrency(selectedReturn.refund_amount) },
                    { label: "Commission reversal", value: formatCurrency(selectedReturn.commission_reversal) },
                    selectedReturn.logistics_reversal !== null &&
                    selectedReturn.logistics_reversal !== undefined
                      ? { label: "Logistics reversal", value: formatCurrency(selectedReturn.logistics_reversal) }
                      : null,
                    { label: "Net settlement impact", value: formatCurrency(getNetSettlementImpact(selectedReturn)) },
                  ]
                    .filter(Boolean)
                    .map((item, index) => (
                      <div
                        key={item!.label}
                        className={`flex items-center justify-between px-4 py-3 ${
                          index > 0 ? "border-t border-slate-100" : ""
                        }`}
                      >
                        <span className="text-sm text-slate-500">{item!.label}</span>
                        <span className="font-mono text-sm font-medium text-slate-800">{item!.value}</span>
                      </div>
                    ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Settlement Gap
                </h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {asNumber(selectedReturn.leakage_amount) > 0 ? (
                    <div className="font-mono text-2xl font-semibold text-red-600">
                      -{formatCurrency(selectedReturn.leakage_amount)}
                    </div>
                  ) : (
                    <div className="font-mono text-2xl font-semibold text-emerald-600">₹0</div>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    This gap indicates a possible missing reversal. Use Operational Disputes to raise a claim.
                  </p>
                </div>
              </section>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
