import React, { useEffect, useMemo, useState } from "react";
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useCsvImport } from "@/pages/RateCards/hooks/useCsvImport";

type RowStatus = RateCardImport.RowStatus;

type StatusStyle = {
  label: string;
  className: string;
  icon?: React.ReactNode;
};

const STATUS_STYLES: Record<RowStatus, StatusStyle> = {
  valid: {
    label: "Valid",
    className:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
  },
  similar: {
    label: "Similar",
    className:
      "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-900",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
  duplicate: {
    label: "Exact duplicate",
    className:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
  error: {
    label: "Error",
    className:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
};

interface RateCardUploaderProps {
  onUploadSuccess?: (meta?: { filename?: string; uploadedAt?: string }) => void;
}

const RateCardUploader: React.FC<RateCardUploaderProps> = ({ onUploadSuccess }) => {
  const {
    parseResult,
    uploading,
    parseError,
    parseFile,
    reset,
    importing,
    importError,
    importResult,
    importRows,
  } = useCsvImport();

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const eligibleRows = useMemo(
    () => parseResult?.rows.filter((row) => row.status === "valid" || row.status === "similar") ?? [],
    [parseResult]
  );

  const selectedImportableRows = useMemo(
    () => eligibleRows.filter((row) => selectedRowIds.has(row.row_id)),
    [eligibleRows, selectedRowIds]
  );

  useEffect(() => {
    if (!parseResult) {
      setSelectedRowIds(new Set());
      return;
    }
    const defaults = parseResult.rows
      .filter((row) => row.status === "valid")
      .map((row) => row.row_id);
    setSelectedRowIds(new Set(defaults));
  }, [parseResult]);

  const downloadTemplate = async () => {
    try {
      let blob: Blob;
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !anonKey) {
          throw new Error("Missing Supabase configuration");
        }

        const response = await fetch(
          `${supabaseUrl}/functions/v1/rate-cards-import?action=template&type=flat`,
          {
            headers: {
              Authorization: `Bearer ${anonKey}`,
              apikey: anonKey,
            },
          }
        );
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        blob = await response.blob();
      } catch (primaryError) {
        console.warn("Primary template download failed, trying static fallback", primaryError);
        const response = await fetch("/templates/rate-cards-template.csv");
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        blob = await response.blob();
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

  const toggleRowSelection = (row: RateCardImport.ParsedRow) => {
    if (row.status !== "valid" && row.status !== "similar") return;
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.row_id)) next.delete(row.row_id);
      else next.add(row.row_id);
      return next;
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const result = await parseFile(file);
      const resolvedName = result?.file_name ?? file.name;
      setSelectedFileName(resolvedName);
    } catch (error) {
      console.error("Failed to analyze rate card CSV", error);
      setSelectedFileName(file.name);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult) return;
    const selectedRows = selectedImportableRows.map((row) => row.row_id);
    const includeSimilar = selectedImportableRows.some((row) => row.status === "similar");

    try {
      const response = await importRows({ includeSimilar, rowIds: selectedRows });
      if (response && onUploadSuccess) {
        onUploadSuccess({ filename: selectedFileName ?? undefined, uploadedAt: response.uploaded_at });
      }
    } catch (error) {
      console.error("Failed to import rate cards", error);
    }
  };

  const resetState = () => {
    reset();
    setSelectedFileName(null);
    setSelectedRowIds(new Set());
  };

  const summary = parseResult?.summary ?? {
    total: 0,
    valid: 0,
    similar: 0,
    duplicate: 0,
    error: 0,
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
          {parseResult && (
            <Button variant="outline" onClick={resetState} disabled={uploading || importing}>
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

      {parseError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
          {parseError}
        </div>
      )}

      {parseResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryTile label="Total" value={summary.total} tone="default" />
            <SummaryTile label="Valid" value={summary.valid} tone="success" />
            <SummaryTile label="Similar" value={summary.similar} tone="warning" />
            <SummaryTile label="Exact duplicate" value={summary.duplicate} tone="danger" />
            <SummaryTile label="Errors" value={summary.error} tone="danger" />
          </div>

          {summary.similar > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>
                {summary.similar} row{summary.similar === 1 ? "" : "s"} overlap existing rate cards. Select the overlapping rows you
                want to import using the checkboxes before confirming.
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
                  {parseResult.rows.map((row) => {
                    const styles = STATUS_STYLES[row.status];
                    const isEligible = row.status === "valid" || row.status === "similar";
                    const isSelected = selectedRowIds.has(row.row_id);
                    return (
                      <tr key={row.row_id} className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
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
                          {row.effective_from ? `${row.effective_from} → ${row.effective_to ?? "open"}` : "-"}
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {eligibleRows.length === 0
                ? "No rows eligible for import."
                : `${selectedImportableRows.length} of ${eligibleRows.length} eligible row${
                    eligibleRows.length === 1 ? "" : "s"
                  } selected.`}
            </p>
            <Button onClick={handleConfirmImport} disabled={selectedImportableRows.length === 0 || importing} className="gap-2">
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

          {importError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
              {importError}
            </div>
          )}

          {importResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 space-y-2">
              <p>
                Imported {importResult.summary.inserted} row{importResult.summary.inserted === 1 ? "" : "s"}.{" "}
                {importResult.summary.skipped > 0 ? `${importResult.summary.skipped} skipped.` : "All selected rows were imported."}
              </p>
              {importResult.results.some((r: any) => r.status === "skipped" && r.message) && (
                <ul className="list-disc list-inside text-xs space-y-1">
                  {importResult.results
                    .filter((r: any) => r.status === "skipped" && r.message)
                    .map((r: any, idx: number) => {
                      const rowLabel = (r as any)?.row ?? (r as any)?.index;
                      return (
                        <li key={`skipped-${idx}`}>
                          {rowLabel != null ? <>Row {rowLabel}: </> : null}
                          {r.message}
                        </li>
                      );
                    })}
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
  success:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
  warning:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900",
  danger: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900",
};

const SummaryTile: React.FC<SummaryTileProps> = ({ label, value, tone }) => (
  <div className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[tone]}`}>
    <p className="text-xs uppercase tracking-wide">{label}</p>
    <p className="text-lg font-semibold">{value}</p>
  </div>
);

export default RateCardUploader;
