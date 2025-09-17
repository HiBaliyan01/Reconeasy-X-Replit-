import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/apiBase";

import ImportConfirmModal from "./ImportConfirmModal";
import { useCsvImport } from "./hooks/useCsvImport";

const STATUS_STYLES: Record<RateCardImport.RowStatus, { label: string; className: string; icon: React.ReactNode }> = {
  valid: {
    label: "Valid",
    className:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  similar: {
    label: "Similar",
    className:
      "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-900",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  duplicate: {
    label: "Exact duplicate",
    className:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  error: {
    label: "Error",
    className:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const SUMMARY_TILES: Array<{
  key: keyof RateCardImport.ParseSummary | "total";
  label: string;
  tone: "default" | "success" | "warning" | "danger";
}> = [
  { key: "total", label: "Total", tone: "default" },
  { key: "valid", label: "Valid", tone: "success" },
  { key: "similar", label: "Similar", tone: "warning" },
  { key: "duplicate", label: "Exact duplicate", tone: "danger" },
  { key: "error", label: "Errors", tone: "danger" },
];

const toneClasses: Record<"default" | "success" | "warning" | "danger", string> = {
  default:
    "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-800",
  success:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
  warning:
    "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900",
  danger:
    "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900",
};

interface UploadWidgetProps {
  onImportComplete?: () => void;
  onUploadMetaChange?: (meta: { filename: string; uploadedAt: string }) => void;
}

const UploadWidget: React.FC<UploadWidgetProps> = ({ onImportComplete, onUploadMetaChange }) => {
  const {
    parseResult,
    uploading,
    parseError,
    parseFile,
    reset,
    validRows,
    similarRows,
    errorRows,
    importRows,
    importing,
    importError,
    importResult,
    hasImportableRows,
    importableRowIds,
  } = useCsvImport();
  const [lastUploadMeta, setLastUploadMeta] = useState<{ filename: string; uploadedAt: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<"valid" | "valid+similar" | null>(null);

  const selectedFileName = lastUploadMeta?.filename ?? parseResult?.file_name ?? null;

  const summaryValues = useMemo(() => {
    const base = parseResult?.summary;
    return {
      total: base?.total ?? 0,
      valid: base?.valid ?? 0,
      similar: base?.similar ?? 0,
      duplicate: base?.duplicate ?? 0,
      error: base?.error ?? 0,
    };
  }, [parseResult?.summary]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const result = await parseFile(file);
      const meta = { filename: result.file_name ?? file.name, uploadedAt: result.uploaded_at };
      setLastUploadMeta(meta);
      onUploadMetaChange?.(meta);
    } catch (error) {
      console.error("Failed to parse rate card CSV", error);
    }
  };

  const handleDownloadTemplate = async () => {
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
        blob = await fetchCsvBlob(apiUrl("/rate-cards/template.csv"));
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
      console.error("Template download failed", error);
    }
  };

  const handleOpenConfirm = () => {
    if (!hasImportableRows || importing) return;
    setConfirmOpen(true);
  };

  const handleCancelConfirm = () => {
    if (importing) return;
    setConfirmOpen(false);
  };

  const handleImportValid = async () => {
    setPendingChoice("valid");
    try {
      const response = await importRows(false);
      if (response) {
        setConfirmOpen(false);
        onImportComplete?.();
      }
    } catch (error) {
      console.error("Import valid rows failed", error);
    } finally {
      setPendingChoice(null);
    }
  };

  const handleImportValidAndSimilar = async () => {
    setPendingChoice("valid+similar");
    try {
      const response = await importRows(true);
      if (response) {
        setConfirmOpen(false);
        onImportComplete?.();
      }
    } catch (error) {
      console.error("Import valid + similar rows failed", error);
    } finally {
      setPendingChoice(null);
    }
  };

  const handleDownloadErrors = () => {
    if (!errorRows.length) return;
    const header = [
      "row",
      "status",
      "message",
      "platform_id",
      "category_id",
      "commission_type",
      "effective_from",
      "effective_to",
    ];
    const toCsvValue = (value: unknown) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (/["]/.test(str) || str.includes(",") || /\r|\n/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [header.join(",")];
    for (const row of errorRows) {
      lines.push(
        [
          row.row,
          row.status,
          row.message ?? "",
          row.platform_id ?? "",
          row.category_id ?? "",
          row.commission_type ?? "",
          row.effective_from ?? "",
          row.effective_to ?? "",
        ]
          .map(toCsvValue)
          .join(",")
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const baseName = (lastUploadMeta?.filename ?? "rate-cards").replace(/\.[^.]+$/, "");
    link.download = `${baseName}-errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const showSimilarWarning = similarRows.length > 0;

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Rate card CSV import</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload a CSV/XLSX to validate your rate cards before importing them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <FileText className="h-4 w-4" /> Template
            </Button>
            {parseResult && (
              <Button variant="outline" onClick={reset} disabled={uploading || importing}>
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
            {selectedFileName && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{selectedFileName}</span>
            )}
          </label>

          <Button
            onClick={handleOpenConfirm}
            disabled={!hasImportableRows || importing || uploading}
            className="self-start md:self-auto gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Review &amp; import
              </>
            )}
          </Button>
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing file…
          </div>
        )}

        {parseError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
            {parseError}
          </div>
        )}

        {parseResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {SUMMARY_TILES.map((tile) => (
                <div key={tile.key} className={cn("rounded-lg px-3 py-2 text-sm", toneClasses[tile.tone])}>
                  <p className="text-xs uppercase tracking-wide">{tile.label}</p>
                  <p className="text-lg font-semibold">
                    {tile.key === "total" ? summaryValues.total : summaryValues[tile.key]}
                  </p>
                </div>
              ))}
            </div>

            {showSimilarWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>
                  {similarRows.length} similar row{similarRows.length === 1 ? "" : "s"} overlap existing marketplace/category
                  combinations. Confirm them explicitly before importing.
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
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Marketplace</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Date range</th>
                      <th className="px-4 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.map((row) => {
                      const style = STATUS_STYLES[row.status];
                      return (
                        <tr
                          key={row.row_id}
                          className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          <td className="px-4 py-2">{row.row}</td>
                          <td className="px-4 py-2">
                            <Badge className={cn("inline-flex items-center gap-1.5 px-3 py-1", style.className)}>
                              {style.icon}
                              {style.label}
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
                            {row.message || (row.status === "valid" ? "Ready to import" : "")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {importError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
                {importError}
              </div>
            )}

            {importResult && (
              <div
                className={cn(
                  "rounded-lg px-4 py-3 text-sm",
                  importResult.summary.inserted > 0
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                )}
              >
                <p>
                  Imported {importResult.summary.inserted} row
                  {importResult.summary.inserted === 1 ? "" : "s"}. {" "}
                  {importResult.summary.skipped > 0
                    ? `${importResult.summary.skipped} skipped.`
                    : "All selected rows were imported."}
                </p>
                {importResult.summary.skipped > 0 && (
                  <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
                    {importResult.results
                      .filter((row) => row.status === "skipped" && row.message)
                      .map((row) => (
                        <li key={row.row_id}>
                          Row {row.row}: {row.message}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {hasImportableRows
                  ? `${importableRowIds.valid.length} valid row${importableRowIds.valid.length === 1 ? "" : "s"} ready to import.`
                  : "No valid rows detected yet."}
                {similarRows.length > 0 && (
                  <>
                    {" "}Similar rows pending confirmation: {similarRows.length}.
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadErrors}
                  disabled={errorRows.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" /> Download error rows (.csv)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {lastUploadMeta && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last uploaded: <span className="font-medium">{lastUploadMeta.filename}</span> at{" "}
          {new Date(lastUploadMeta.uploadedAt).toLocaleString()}
        </p>
      )}

      <ImportConfirmModal
        open={confirmOpen}
        onCancel={handleCancelConfirm}
        onImportValid={handleImportValid}
        onImportValidAndSimilar={handleImportValidAndSimilar}
        validCount={validRows.length}
        similarCount={similarRows.length}
        importing={importing}
        pendingChoice={pendingChoice}
      />
    </div>
  );
};

export default UploadWidget;
