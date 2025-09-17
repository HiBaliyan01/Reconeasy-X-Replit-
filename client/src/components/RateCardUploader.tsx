import React, { useEffect, useMemo, useState } from "react";
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RowStatus = "valid" | "similar" | "duplicate" | "error";

type DryRunRow = {
  row: number;
  status: RowStatus;
  message?: string;
  platform_id?: string;
  category_id?: string;
  commission_type?: string;
  effective_from?: string;
  effective_to?: string | null;
  payload?: any;
  overlapId?: string | null;
};

type DryRunSummary = {
  total: number;
  valid: number;
  similar: number;
  duplicate: number;
  error: number;
};

type DryRunResponse = {
  summary: DryRunSummary;
  rows: DryRunRow[];
};

type ConfirmResult = {
  index: number;
  status: "imported" | "skipped";
  id?: string;
  message?: string;
};

type ConfirmResponse = {
  summary: {
    inserted: number;
    skipped: number;
  };
  results: ConfirmResult[];
};

interface RateCardUploaderProps {
  onUploadSuccess?: (meta?: { filename?: string; uploadedAt?: string }) => void;
}

const STATUS_STYLES: Record<RowStatus, { label: string; className: string; icon?: React.ReactNode }> = {
  valid: {
    label: "Valid",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
  },
  similar: {
    label: "Similar",
    className: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-900",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
  duplicate: {
    label: "Exact duplicate",
    className: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
};

const RateCardUploader: React.FC<RateCardUploaderProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analysis, setAnalysis] = useState<DryRunResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ConfirmResponse | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const eligibleRows = useMemo(
    () => analysis?.rows.filter((row) => row.status === "valid" || row.status === "similar") ?? [],
    [analysis]
  );

  const selectedImportableRows = useMemo(
    () => eligibleRows.filter((row) => selectedRows.has(row.row)),
    [eligibleRows, selectedRows]
  );

  useEffect(() => {
    if (!analysis) {
      setSelectedRows(new Set());
      return;
    }

    const defaults = analysis.rows
      .filter((row) => row.status === "valid")
      .map((row) => row.row);
    setSelectedRows(new Set(defaults));
  }, [analysis]);

  const toggleRowSelection = (row: DryRunRow) => {
    if (row.status !== "valid" && row.status !== "similar") {
      return;
    }

    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(row.row)) {
        next.delete(row.row);
      } else {
        next.add(row.row);
      }
      return next;
    });
  };

  const downloadTemplate = async () => {
    const fetchCsvBlob = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("text/csv")) {
        throw new Error(`Unexpected content type: ${contentType || "unknown"}`);
      }

      return response.blob();
    };

    try {
      let blob: Blob;
      try {
        blob = await fetchCsvBlob("/api/rate-cards/template.csv");
      } catch (primaryError) {
        console.warn("Primary template download failed, trying static fallback", primaryError);
        blob = await fetchCsvBlob("/templates/rate-cards-template.csv");
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "rate-card-template.csv";
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading template:", error);
    }
  };

  const resetState = () => {
    setAnalysis(null);
    setImportSummary(null);
    setAnalysisError(null);
    setSelectedFileName(null);
    setSelectedRows(new Set());
  };

  const handleAnalyzeFile = async (file: File) => {
    setUploading(true);
    setAnalysis(null);
    setImportSummary(null);
    setAnalysisError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/rate-cards/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to analyze file");
      }

      setAnalysis(data);
    } catch (error: any) {
      setAnalysisError(error?.message || "Failed to analyze file");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSelectedFileName(file.name);
    await handleAnalyzeFile(file);
  };

  const handleConfirmImport = async () => {
    if (!analysis) return;
    const payloadRows = selectedImportableRows
      .filter((row) => row.payload)
      .map((row) => ({
        row: row.row,
        status: row.status,
        allowSimilar: row.status === "similar",
        payload: row.payload,
      }));

    if (!payloadRows.length) {
      setAnalysisError("Select at least one valid or similar row to import.");
      return;
    }

    setImporting(true);
    setAnalysisError(null);

    try {
      const res = await fetch("/api/rate-cards/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloadRows }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to import rate cards");
      }

      setImportSummary(data);
      if (onUploadSuccess) {
        onUploadSuccess({ filename: selectedFileName ?? undefined, uploadedAt: new Date().toISOString() });
      }
    } catch (error: any) {
      setAnalysisError(error?.message || "Failed to import rate cards");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload Rate Cards (CSV/XLSX)</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <FileText className="h-4 w-4" />
            Download template
          </Button>
          {analysis && (
            <Button variant="outline" onClick={resetState}>
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <label className="inline-flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/60">
            <Upload className="h-4 w-4" />
            Choose file
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              disabled={uploading || importing}
            />
          </span>
          {selectedFileName && <span className="text-xs text-slate-500">{selectedFileName}</span>}
        </label>
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing file...
        </div>
      )}

      {analysisError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
          {analysisError}
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryTile label="Total" value={analysis.summary.total} tone="default" />
            <SummaryTile label="Valid" value={analysis.summary.valid} tone="success" />
            <SummaryTile label="Similar" value={analysis.summary.similar} tone="warning" />
            <SummaryTile label="Exact duplicate" value={analysis.summary.duplicate} tone="danger" />
            <SummaryTile label="Errors" value={analysis.summary.error} tone="danger" />
          </div>

          {analysis.summary.similar > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>
                {analysis.summary.similar} row{analysis.summary.similar === 1 ? "" : "s"} overlap existing rate cards. Select the
                overlapping rows you want to import using the checkboxes before confirming.
              </span>
            </div>
          )}

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Row validation</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Row</th>
                    <th className="px-4 py-2 text-left">Import</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Marketplace</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Date range</th>
                    <th className="px-4 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.rows.map((row) => {
                    const styles = STATUS_STYLES[row.status];
                    const isEligible = row.status === "valid" || row.status === "similar";
                    const isSelected = selectedRows.has(row.row);
                    return (
                      <tr
                        key={row.row}
                        className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        <td className="px-4 py-2">{row.row}</td>
                        <td className="px-4 py-2">
                          {isEligible ? (
                            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                checked={isSelected}
                                disabled={importing}
                                onChange={() => toggleRowSelection(row)}
                              />
                              <span>{row.status === "similar" ? "Confirm" : "Import"}</span>
                            </label>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Badge className={`flex items-center ${styles.className}`}>
                            {styles.icon}
                            {styles.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 capitalize">{row.platform_id || "-"}</td>
                        <td className="px-4 py-2 capitalize">{row.category_id || "-"}</td>
                        <td className="px-4 py-2 capitalize">{row.commission_type || "-"}</td>
                        <td className="px-4 py-2">
                          {row.effective_from
                            ? `${row.effective_from} → ${row.effective_to ?? "open"}`
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {row.message || "Ready to import"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {eligibleRows.length === 0
                ? "No rows eligible for import."
                : `${selectedImportableRows.length} of ${eligibleRows.length} eligible row${eligibleRows.length === 1 ? "" : "s"} selected.`}
            </p>
            <Button
              onClick={handleConfirmImport}
              disabled={selectedImportableRows.length === 0 || importing}
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {selectedImportableRows.length === 0
                    ? "Import selected rows"
                    : `Import ${selectedImportableRows.length} row${selectedImportableRows.length === 1 ? "" : "s"}`}
                </>
              )}
            </Button>
          </div>

          {importSummary && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 space-y-2">
              <p>
                Imported {importSummary.summary.inserted} row{importSummary.summary.inserted === 1 ? "" : "s"}.
                {" "}
                {importSummary.summary.skipped > 0
                  ? `${importSummary.summary.skipped} skipped.`
                  : "All selected rows were imported."}
              </p>
              {importSummary.results.some((r) => r.status === "skipped" && r.message) && (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {importSummary.results
                    .filter((r) => r.status === "skipped" && r.message)
                    .map((r) => (
                      <li key={`skipped-${r.index}`}>
                        Row {r.index}: {r.message}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface SummaryTileProps {
  label: string;
  value: number;
  tone: "default" | "success" | "warning" | "danger";
}

const toneClasses: Record<SummaryTileProps["tone"], string> = {
  default: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-800",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
  warning: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900",
  danger: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900",
};

const SummaryTile: React.FC<SummaryTileProps> = ({ label, value, tone }) => (
  <div className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[tone]}`}>
    <p className="text-xs uppercase tracking-wide">{label}</p>
    <p className="text-lg font-semibold">{value}</p>
  </div>
);

export default RateCardUploader;
