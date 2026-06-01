import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_TENANT_ID } from "../config/tenant";

interface SettlementFile {
  id: string;
  settlement_id: string;
  marketplace: string;
  file_name: string | null;
  status: string;
  row_count: number | null;
  settlement_start_date: string | null;
  settlement_end_date: string | null;
  created_at: string;
  updated_at?: string | null;
  processed_at: string | null;
  error_message: string | null;
  total_records: number;
  gross_amount: number;
  fees_total: number;
  net_amount: number;
  reconciliation_status: string;
  claims_count: number;
}

interface SettlementSummary {
  total_files: number;
  total_net_amount: number;
  processed_count: number;
  pending_count: number;
}

export default function SettlementPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<SettlementFile[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [marketplaceFilter, setMarketplaceFilter] = useState("ALL");
  const [showAll, setShowAll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [reconRunning, setReconRunning] = useState<string | null>(null);
  const templateAvailable = marketplaceFilter === "amazon";
  const templateHref = templateAvailable
    ? `/templates/${marketplaceFilter}-settlement-template.csv`
    : null;

  useEffect(() => {
    void fetchFiles();
  }, [marketplaceFilter, showAll]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const mp = marketplaceFilter === "ALL" ? "" : marketplaceFilter;
      const res = await fetch(
        `/api/settlements/files?tenant_id=${DEFAULT_TENANT_ID}&marketplace=${encodeURIComponent(mp)}&show_all=${showAll}`,
      );
      const data = await res.json();
      setFiles(Array.isArray(data?.files) ? data.files : []);
      setSummary(data?.summary ?? null);
    } catch (error) {
      console.error("Failed to fetch settlement files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateAmazonCSV = async (
    file: File,
  ): Promise<{ valid: boolean; error?: string }> => {
    // MARKETPLACE PARSER SUPPORT
    // Amazon: fully supported
    // Flipkart: add validateFlipkartCSV() when real Flipkart data is available
    // Myntra: add validateMyntraCSV() when real Myntra data is available
    const text = await file.text();
    const lines = text.split("\n").map((line) => line.toLowerCase());

    const headerLine = lines.find(
      (line) =>
        (line.includes("transaction-type") || line.includes("transactiontype")) &&
        (line.includes("order-id") || line.includes("order_id")),
    );

    if (!headerLine) {
      return {
        valid: false,
        error:
          "Invalid format. File must contain a row with 'transaction-type' and 'order-id' columns. Download the template to see the correct format.",
      };
    }

    return { valid: true };
  };

  const handleFileUpload = async (file: File) => {
    if (marketplaceFilter === "ALL") {
      setUploadStatus("⚠ Please select a marketplace before uploading");
      window.setTimeout(() => setUploadStatus(null), 3000);
      return;
    }

    if (marketplaceFilter === "amazon") {
      const validation = await validateAmazonCSV(file);
      if (!validation.valid) {
        setUploadStatus(`✗ ${validation.error}`);
        window.setTimeout(() => setUploadStatus(null), 6000);
        return;
      }
    }

    setIsUploading(true);
    setUploadStatus("Uploading...");
    setUploadProgress(["⏳ Uploading file..."]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenant_id", DEFAULT_TENANT_ID);
      formData.append("marketplace", marketplaceFilter);

      const res = await fetch("/api/settlements/upload-file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const uploadData = await res.json();
      if (!uploadData.marketplace || !uploadData.settlement_id) {
        throw new Error("Invalid upload response — missing marketplace or settlement_id");
      }
      const confirmedMarketplace = uploadData.marketplace;
      const confirmedSettlementId = uploadData.settlement_id;
      setUploadProgress(["✔ File uploaded", "⏳ Running reconciliation..."]);
      setUploadStatus("✓ File uploaded · Running reconciliation...");

      if (uploadData?.result?.status === "DUPLICATE") {
        setUploadProgress(["✔ File uploaded", "✔ Duplicate detected", "✔ Ready to view results"]);
        setUploadStatus("✓ File uploaded · This settlement was already processed");
        window.setTimeout(() => {
          setUploadProgress([]);
          setUploadStatus(null);
          void fetchFiles();
        }, 4000);
        return;
      }

      try {
        const reconResponse = await fetch("/api/reconciliation/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
        tenant_id: DEFAULT_TENANT_ID,
            marketplace: confirmedMarketplace,
            settlement_id: confirmedSettlementId,
          }),
        });
        if (!reconResponse.ok) {
          throw new Error("Reconciliation failed");
        }
        setUploadProgress(["✔ File uploaded", "✔ Reconciliation complete", "✔ Ready to view results"]);
        setUploadStatus(
          "✓ Upload complete · Reconciliation done · View results in Payment Reconciliation",
        );
        navigate(`/reconciliation-v2?settlement_id=${confirmedSettlementId}`);
      } catch {
        setUploadStatus("⚠ Reconciliation failed · Please retry from the table");
        setUploadProgress((prev) => [
          ...prev.filter((step) => step.startsWith("✔")),
          "✗ Reconciliation failed",
        ]);
      }

      window.setTimeout(() => {
        setUploadProgress([]);
        setUploadStatus(null);
        void fetchFiles();
      }, 5000);
    } catch (error) {
      setUploadProgress([]);
      setUploadStatus("✗ Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunReconciliation = async (settlementId: string, marketplace: string) => {
    setReconRunning(settlementId);
    try {
      await fetch("/api/reconciliation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        tenant_id: DEFAULT_TENANT_ID,
          marketplace,
          settlement_id: settlementId,
        }),
      });
      await fetchFiles();
      navigate(`/reconciliation-v2?settlement_id=${settlementId}`);
    } catch (error) {
      console.error("Reconciliation failed:", error);
    } finally {
      setReconRunning(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      void handleFileUpload(file);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PROCESSED: "bg-emerald-100 text-emerald-700",
      PROCESSING: "bg-blue-100 text-blue-700",
      FAILED: "bg-red-100 text-red-700",
      PENDING: "bg-amber-100 text-amber-700",
      DUPLICATE: "bg-slate-100 text-slate-600",
    };
    return styles[status] ?? "bg-slate-100 text-slate-600";
  };

  const getReconBadge = (status: string) => {
    const config: Record<string, { style: string; label: string }> = {
      COMPLETED: { style: "bg-emerald-100 text-emerald-700", label: "Reconciled" },
      PROCESSING: { style: "bg-blue-100 text-blue-700", label: "Processing" },
      NOT_RUN: { style: "bg-slate-100 text-slate-500", label: "Not Run" },
    };
    return config[status] ?? { style: "bg-slate-100 text-slate-500", label: status };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start && !end) return "—";
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
    return formatDate(start || end);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Upload Settlement CSV</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Upload your marketplace settlement report to begin reconciliation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {templateHref && (
              <a
                href={templateHref}
                download={`${marketplaceFilter}-settlement-template.csv`}
                className="text-xs text-teal-600 transition-colors hover:text-teal-700 hover:underline"
              >
                ↓ Download Template
              </a>
            )}
            <select
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
            >
              <option value="ALL">All Marketplaces</option>
              <option value="amazon">Amazon</option>
              <option value="flipkart" disabled className="text-muted-foreground">
                Flipkart (coming soon)
              </option>
              <option value="myntra" disabled className="text-muted-foreground">
                Myntra (coming soon)
              </option>
            </select>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-teal-400 bg-teal-50/50"
              : "border-slate-200 hover:border-teal-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="mb-2 text-2xl">📄</div>
          <p className="text-sm font-medium text-slate-700">
            Drop your CSV file here or{" "}
            <label className="cursor-pointer text-teal-600 hover:underline">
              browse
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleFileUpload(file);
                  }
                }}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {marketplaceFilter === "ALL" ? (
              "Select a marketplace above, then drop your CSV file"
            ) : (
              <>
                Upload {marketplaceFilter} settlement CSV
                {templateHref && (
                  <>
                    {" · "}
                    <a
                      href={templateHref}
                      download
                      className="text-teal-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Download template
                    </a>
                  </>
                )}
              </>
            )}
          </p>
          {isUploading && <p className="mt-2 text-xs font-medium text-blue-600">Uploading...</p>}
          {uploadStatus && !isUploading && (
            <p
              className={`mt-2 text-xs font-medium ${
                uploadStatus.startsWith("✓")
                  ? "text-emerald-600"
                  : uploadStatus.startsWith("⚠")
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {uploadStatus}
            </p>
          )}
          {uploadProgress.length > 0 && (
            <div className="mt-3 space-y-1">
              {uploadProgress.map((step, index) => (
                <p
                  key={`${step}-${index}`}
                  className={`text-xs ${
                    step.startsWith("✔") ? "text-emerald-600" : "text-blue-600"
                  }`}
                >
                  {step}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Settlements</p>
            <p className="text-2xl font-bold">{Number(summary.total_files || 0)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Net Amount</p>
            <p className="text-2xl font-bold">
              ₹{Number(summary.total_net_amount || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Processed</p>
            <p className="text-2xl font-bold text-emerald-600">
              {Number(summary.processed_count || 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">
              {Number(summary.pending_count || 0)}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Settlement Files</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {files.length} {files.length === 1 ? "file" : "files"} uploaded
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <span>Show all</span>
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                showAll ? "bg-teal-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  showAll ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="table-fixed min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="w-[12%] px-5 py-3 text-left">Settlement ID</th>
                <th className="w-[9%] px-5 py-3 text-left">Marketplace</th>
                <th className="w-[10%] px-5 py-3 text-left">Period</th>
                <th className="w-[7%] px-5 py-3 text-right">Records</th>
                <th className="w-[10%] px-5 py-3 text-right">Net Amount</th>
                <th className="w-[9%] px-5 py-3 text-left">Upload Status</th>
                <th className="w-[10%] px-5 py-3 text-left">Reconciliation</th>
                <th className="w-[7%] px-5 py-3 text-right">Claims</th>
                <th className="w-[9%] px-5 py-3 text-left">Last Updated</th>
                <th className="w-[9%] px-5 py-3 text-left">Uploaded</th>
                <th className="w-[8%] px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-5 py-8 text-center text-muted-foreground">
                    Loading settlements...
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-3 text-3xl">📂</div>
                      <p className="text-sm font-medium text-slate-700">No settlements uploaded yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Upload a CSV file above to get started
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const recon = getReconBadge(file.reconciliation_status);
                  return (
                    <tr key={file.id} className="border-b border-border transition-colors hover:bg-muted/40">
                      <td className="px-5 py-4 font-mono text-xs font-medium">{file.settlement_id}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                          {file.marketplace}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                        {formatPeriod(file.settlement_start_date, file.settlement_end_date)}
                      </td>
                      <td className="px-5 py-4 text-right text-muted-foreground">
                        {Number(file.total_records || file.row_count || 0) || "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold">
                        ₹{Number(file.net_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(file.status)}`}
                        >
                          {file.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${recon.style}`}>
                          {recon.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-muted-foreground">
                        {Number(file.claims_count || 0)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                        {formatDate(file.updated_at ?? file.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                        {formatDate(file.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {file.reconciliation_status === "PROCESSING" ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600">
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                              Running...
                            </div>
                          ) : file.reconciliation_status === "COMPLETED" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => navigate("/reconciliation-v2")}
                                className="whitespace-nowrap text-xs text-teal-600 hover:underline"
                              >
                                View Results →
                              </button>
                              <button
                                onClick={() =>
                                  void handleRunReconciliation(file.settlement_id, file.marketplace)
                                }
                                disabled={reconRunning === file.settlement_id}
                                className="whitespace-nowrap text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                              >
                                {reconRunning === file.settlement_id ? "Running..." : "Re-run"}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                void handleRunReconciliation(file.settlement_id, file.marketplace)
                              }
                              disabled={reconRunning === file.settlement_id}
                              className="whitespace-nowrap rounded bg-teal-600 px-2 py-1 text-xs text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reconRunning === file.settlement_id
                                ? "Running..."
                                : "Run Reconciliation"}
                            </button>
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
  );
}
