import { type ComponentType, useEffect, useRef, useState } from "react";
import { AlertTriangle, FileLock2, Upload, Warehouse } from "lucide-react";
import Papa from "papaparse";
import { DEFAULT_TENANT_ID } from "../config/tenant";
import { mapReturnsCsvRow, validateMappedRow } from "../utils/returnsCsvMapper";

type ReturnsTab = "financial" | "warehouse" | "qc";

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
  total_leakage: string | number | null;
  refund_leakage: string | number | null;
  commission_leakage: string | number | null;
  logistics_leakage: string | number | null;
};

const tabs: Array<{ key: ReturnsTab; label: string }> = [
  { key: "financial", label: "Financial" },
  { key: "warehouse", label: "Warehouse" },
  { key: "qc", label: "QC & Damage" },
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

const getRowTone = (status: ReturnRow["reconciliation_status"]) => {
  if (status === "matched") {
    return "border-l-4 border-emerald-500 bg-emerald-50/40";
  }
  if (status === "mismatch") {
    return "border-l-4 border-red-500 bg-red-50/40";
  }
  return "border-l-4 border-amber-400";
};

const getStatusPill = (status: ReturnRow["reconciliation_status"]) => {
  if (status === "matched") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "mismatch") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
};

function LockedTabCard({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-slate-100 p-3 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-heading font-medium text-slate-900">{title}</h3>
          <p className="mt-1 max-w-xl text-body text-slate-600">{body}</p>
          <button className="mt-4 h-[var(--re-height-btn)] rounded-lg border border-slate-200 px-4 text-body font-medium text-slate-700 hover:bg-slate-50">
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

type ReturnsProps = {
  tenantId?: string;
};

export default function Returns({ tenantId = DEFAULT_TENANT_ID }: ReturnsProps) {
  const [activeTab, setActiveTab] = useState<ReturnsTab>("financial");
  const [marketplace, setMarketplace] = useState("");
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [summary, setSummary] = useState<ReturnsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
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
  const conflictWarningText =
    conflictWarning?.replace(/\s*Review your rate cards\.?$/i, "") ?? null;

  const metricTiles = [
    { label: "Total Returns", value: totalReturns.toLocaleString("en-IN") },
    { label: "Refund Leakage", value: formatCurrency(summary?.refund_leakage) },
    { label: "Commission Leakage", value: formatCurrency(summary?.commission_leakage) },
    { label: "Logistics Leakage", value: formatCurrency(summary?.logistics_leakage) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-page-title font-medium text-slate-900">Returns</h1>
          <p className="mt-1 text-meta text-slate-500">Financial recovery and return leakage tracking</p>
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

      {activeTab === "financial" && (
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
              <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-label font-medium uppercase tracking-wide text-slate-500">{tile.label}</p>
                <p className="mt-2 text-[28px] font-medium text-slate-900">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-heading font-medium text-slate-900">Financial Reconciliation</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table-fixed w-full min-w-[1180px] text-body">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="w-[11%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Order ID</th>
                    <th className="w-[9%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">SKU</th>
                    <th className="w-[10%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Return Date</th>
                    <th className="w-[14%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Reason</th>
                    <th className="w-[11%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Expected Refund</th>
                    <th className="w-[11%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Actual Refund</th>
                    <th className="w-[11%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Commission Reversal</th>
                    <th className="w-[10%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Logistics Reversal</th>
                    <th className="w-[9%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Leakage</th>
                    <th className="w-[9%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        Loading returns...
                      </td>
                    </tr>
                  ) : returns.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        No returns uploaded yet.
                      </td>
                    </tr>
                  ) : (
                    returns.map((row) => (
                      <tr key={row.id} className={`${getRowTone(row.reconciliation_status)} hover:bg-slate-50`}>
                        <td className="px-4 py-[14px] font-mono text-body text-slate-900">{row.order_id}</td>
                        <td className="px-4 py-[14px] text-body text-slate-700">{row.sku}</td>
                        <td className="px-4 py-[14px] text-body text-slate-600">{formatDate(row.return_date)}</td>
                        <td className="px-4 py-[14px] text-body text-slate-600">{row.return_reason_desc || "—"}</td>
                        <td className="px-4 py-[14px] text-right text-body text-slate-900">
                          {formatCurrency(row.expected_refund_amount)}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body text-slate-900">
                          {formatCurrency(row.refund_amount)}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body text-slate-900">
                          {formatCurrency(row.commission_reversal)}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body text-slate-900">
                          {row.expected_logistics_reversal === null ||
                          row.expected_logistics_reversal === undefined ? (
                            <span className="text-slate-400">N/A</span>
                          ) : (
                            formatCurrency(row.logistics_reversal)
                          )}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body font-semibold text-red-600">
                          {formatCurrency(row.leakage_amount)}
                        </td>
                        <td className="px-4 py-[14px]">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusPill(row.reconciliation_status)}`}>
                            {row.reconciliation_status || "pending"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "warehouse" && (
        <LockedTabCard
          icon={Warehouse}
          title="Warehouse Return Tracking"
          body="Track return receipt, in-transit status, and warehouse confirmation. Requires WMS integration."
          action="Connect EasyEcom / Unicommerce / Increff"
        />
      )}

      {activeTab === "qc" && (
        <LockedTabCard
          icon={FileLock2}
          title="QC & Damage Tracking"
          body="Track QC results, damaged inventory, and resale eligibility. Requires WMS integration."
          action="Connect your WMS to unlock"
        />
      )}
    </div>
  );
}
