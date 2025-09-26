import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import ImportConfirmModal from "./ImportConfirmModal";
import { useCsvImport } from "./hooks/useCsvImport";

type RowOut = RateCardImport.ParsedRow & {
  message: string;
  tooltip?: string;
  existing?: {
    id: string;
    label: string;
    date_range: string;
  };
  suggestions?: Array<
    | { type: "shift_from"; new_from: string; reason: string }
    | { type: "clip_to"; new_to: string; reason: string }
    | { type: "skip"; reason: string }
  >;
  payload?: any;
};

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
    importRows,
    importing,
    importError,
    importResult,
  } = useCsvImport();
  const [lastUploadMeta, setLastUploadMeta] = useState<{ filename: string; uploadedAt: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<"valid" | "valid+similar" | null>(null);
  const [confirmedRows, setConfirmedRows] = useState<Record<string, boolean>>({});
  const [skippedRows, setSkippedRows] = useState<Record<string, boolean>>({});
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<RowOut>>>({});
  const [editorState, setEditorState] = useState<
    | null
    | {
        row: RowOut;
        mode: "adjust" | "fix";
        values: {
          effective_from: string;
          effective_to: string;
        };
      }
  >(null);

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

const mergedRows = useMemo<RowOut[]>(() => {
    const base = (parseResult?.rows ?? []) as RowOut[];
    return base.map((row) => {
      const override = rowOverrides[row.row_id];
      if (!override) return row;
      return {
        ...row,
        ...override,
        payload: override.payload ?? row.payload,
        effective_from: override.effective_from ?? (row as RowOut).effective_from,
        effective_to:
          override.effective_to !== undefined ? override.effective_to : (row as RowOut).effective_to,
      } as RowOut;
    });
}, [parseResult, rowOverrides]);

const unresolvedSimilarCount = useMemo(
  () =>
    mergedRows.filter(
      (row) =>
        row.status === "similar" &&
        !skippedRows[row.row_id] &&
        !confirmedRows[row.row_id]
    ).length,
  [mergedRows, skippedRows, confirmedRows]
);

const unresolvedErrorCount = useMemo(
  () => mergedRows.filter((row) => row.status === "error" && !skippedRows[row.row_id]).length,
  [mergedRows, skippedRows]
);

  const eligibleValidRows = useMemo(
    () => mergedRows.filter((row) => row.status === "valid" && !skippedRows[row.row_id]),
    [mergedRows, skippedRows]
  );

  const eligibleSimilarRows = useMemo(
    () =>
      mergedRows.filter(
        (row) =>
          row.status === "similar" &&
          !skippedRows[row.row_id] &&
          confirmedRows[row.row_id]
      ),
    [mergedRows, skippedRows, confirmedRows]
  );

const hasEligibleRows = eligibleValidRows.length > 0 || eligibleSimilarRows.length > 0;

const guardrailsBlocking = unresolvedSimilarCount > 0 || unresolvedErrorCount > 0;

  const collectOverrides = useCallback(
    (ids: string[]) => {
      const overrides: Record<string, unknown> = {};
      for (const id of ids) {
        if (!id) continue;
        const payload = rowOverrides[id]?.payload;
        if (payload && typeof payload === "object") {
          overrides[id] = payload;
        }
      }
      return Object.keys(overrides).length ? overrides : undefined;
    },
    [rowOverrides]
  );

  useEffect(() => {
    setConfirmedRows({});
    setSkippedRows({});
    setRowOverrides({});
    setEditorState(null);
  }, [parseResult?.analysis_id]);

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
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("text/csv")) {
        throw new Error(`Unexpected content type: ${contentType || "unknown"}`);
      }
      return res.blob();
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
      console.error("Template download failed", error);
    }
  };

  const handleOpenConfirm = () => {
    if (!hasEligibleRows || importing) return;
    setConfirmOpen(true);
  };

  const handleCancelConfirm = () => {
    if (importing) return;
    setConfirmOpen(false);
  };

  const handleImportValid = async () => {
    setPendingChoice("valid");
    try {
      const rowIds = Array.from(new Set(eligibleValidRows.map((row) => row.row_id)));
      const response = await importRows({
        includeSimilar: false,
        rowIds,
        overrides: collectOverrides(rowIds),
      });
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
      const rowIds = Array.from(
        new Set([
          ...eligibleValidRows.map((row) => row.row_id),
          ...eligibleSimilarRows.map((row) => row.row_id),
        ])
      );
      const response = await importRows({
        includeSimilar: true,
        rowIds,
        overrides: collectOverrides(rowIds),
      });
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

  const downloadIssues = () => {
    const issueRows = mergedRows.filter((row) =>
      row.status === "error" || row.status === "duplicate" || row.status === "similar"
    );
    if (!issueRows.length) return;

    const header = [
      "row",
      "status",
      "message",
      "tooltip",
      "platform",
      "category",
      "type",
      "date_range",
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
    for (const row of issueRows) {
      lines.push(
        [
          row.row,
          row.status,
          row.message,
          row.tooltip ?? "",
          row.platform_id ?? "",
          row.category_id ?? "",
          row.commission_type ?? "",
          row.effective_from ? `${row.effective_from} → ${row.effective_to ?? "open"}` : "-",
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
    link.download = `${baseName}-issues.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmRow = (row: RowOut) => {
    setConfirmedRows((prev) => ({ ...prev, [row.row_id]: true }));
    setSkippedRows((prev) => {
      if (!prev[row.row_id]) return prev;
      const next = { ...prev };
      delete next[row.row_id];
      return next;
    });
  };

  const toggleSkipRow = (row: RowOut) => {
    setSkippedRows((prev) => {
      const next = { ...prev };
      if (next[row.row_id]) {
        delete next[row.row_id];
      } else {
        next[row.row_id] = true;
      }
      return next;
    });
    setConfirmedRows((prev) => {
      if (!prev[row.row_id]) return prev;
      const next = { ...prev };
      delete next[row.row_id];
      return next;
    });
  };

  const openEditor = (row: RowOut, mode: "adjust" | "fix") => {
    const suggestion = row.suggestions?.find((item) =>
      mode === "adjust"
        ? item.type === "shift_from" || item.type === "clip_to"
        : false
    );

    const initialFrom =
      suggestion && suggestion.type === "shift_from"
        ? suggestion.new_from
        : rowOverrides[row.row_id]?.effective_from ?? row.effective_from ?? row.payload?.effective_from ?? "";
    const initialTo =
      suggestion && suggestion.type === "clip_to"
        ? suggestion.new_to
        : rowOverrides[row.row_id]?.effective_to ??
          (row.payload?.effective_to ?? row.effective_to ?? "");

    setEditorState({
      row,
      mode,
      values: {
        effective_from: initialFrom,
        effective_to: initialTo ?? "",
      },
    });
  };

  const closeEditor = () => setEditorState(null);

  const saveEditor = () => {
    if (!editorState) return;
    const { row, values } = editorState;
    const nextPayload = {
      ...(rowOverrides[row.row_id]?.payload ?? row.payload ?? {}),
      effective_from: values.effective_from,
      effective_to: values.effective_to ? values.effective_to : null,
    };

    setRowOverrides((prev) => ({
      ...prev,
      [row.row_id]: {
        ...(prev[row.row_id] ?? {}),
        payload: nextPayload,
        effective_from: values.effective_from,
        effective_to: values.effective_to ? values.effective_to : null,
      },
    }));

    confirmRow(row);
    closeEditor();
  };

  const isRowConfirmed = (rowId: string) => Boolean(confirmedRows[rowId]);
  const isRowSkipped = (rowId: string) => Boolean(skippedRows[rowId]);

  const showSimilarWarning = unresolvedSimilarCount > 0;

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
          disabled={!hasEligibleRows || guardrailsBlocking || importing || uploading}
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
                  {unresolvedSimilarCount} similar row{unresolvedSimilarCount === 1 ? "" : "s"} require confirmation before importing.
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
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedRows.map((row) => {
                      const style = STATUS_STYLES[row.status];
                      const confirmed = isRowConfirmed(row.row_id);
                      const skipped = isRowSkipped(row.row_id);
                      return (
                        <tr
                          key={row.row_id}
                          className={cn(
                            "border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200",
                            skipped && "opacity-60"
                          )}
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
                            <span className="inline-flex items-center gap-2">
                              <span>{row.message}</span>
                              {row.tooltip ? (
                                <span className="inline-flex" title={row.tooltip}>
                                  <Info className="h-3.5 w-3.5 text-slate-400" />
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {row.status === "similar" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant={confirmed ? "secondary" : "default"}
                                    onClick={() => confirmRow(row)}
                                    disabled={skipped}
                                  >
                                    {confirmed ? "Confirmed" : "Confirm"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditor(row, "adjust")}
                                    disabled={skipped}
                                  >
                                    Adjust dates…
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={skipped ? "secondary" : "ghost"}
                                    onClick={() => toggleSkipRow(row)}
                                  >
                                    {skipped ? "Unskip" : "Skip"}
                                  </Button>
                                </>
                              )}
                              {row.status === "duplicate" && (
                                <Button
                                  size="sm"
                                  variant={skipped ? "secondary" : "ghost"}
                                  onClick={() => toggleSkipRow(row)}
                                >
                                  {skipped ? "Unskip" : "Skip"}
                                </Button>
                              )}
                              {row.status === "error" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditor(row, "fix")}
                                  >
                                    Fix…
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={skipped ? "secondary" : "ghost"}
                                    onClick={() => toggleSkipRow(row)}
                                  >
                                    {skipped ? "Unskip" : "Skip"}
                                  </Button>
                                </>
                              )}
                              {row.status === "valid" && <span className="text-slate-400">—</span>}
                            </div>
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
                  {importResult.summary.inserted === 1 ? "" : "s"}.{" "}
                  {importResult.summary.skipped > 0
                    ? `${importResult.summary.skipped} skipped.`
                    : "All selected rows were imported."}
                </p>
                {importResult.summary.skipped > 0 && (
                  <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
                    {importResult.results
                      .filter((row) => row.status === "skipped" && row.message)
                      .map((row, idx) => (
                        <li key={`${row.row_id ?? row.row ?? idx}`}>
                          Row {row.row ?? row.row_id}: {row.message}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {hasEligibleRows
                  ? `${eligibleValidRows.length} valid row${eligibleValidRows.length === 1 ? "" : "s"} ready to import.`
                  : "No valid rows detected yet."}
                {unresolvedSimilarCount > 0 && (
                  <> {" "}Similar rows pending confirmation: {unresolvedSimilarCount}.</>
                )}
                {unresolvedErrorCount > 0 && (
                  <> {" "}Error rows remaining: {unresolvedErrorCount}.</>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadIssues}
                  disabled={
                    mergedRows.filter(
                      (row) =>
                        row.status === "error" ||
                        row.status === "duplicate" ||
                        row.status === "similar"
                    ).length === 0
                  }
                  className="gap-2"
                >
                  <Download className="h-4 w-4" /> Download issues (.csv)
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
        validCount={eligibleValidRows.length}
        similarCount={eligibleSimilarRows.length}
        importing={importing}
        pendingChoice={pendingChoice}
      />

      {editorState && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow p-4 space-y-3">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {editorState.mode === "adjust" ? "Adjust dates" : "Fix row"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Effective from
              <input
                type="date"
                value={editorState.values.effective_from}
                onChange={(event) =>
                  setEditorState((prev) =>
                    prev
                      ? {
                          ...prev,
                          values: { ...prev.values, effective_from: event.target.value },
                        }
                      : prev
                  )
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Effective to
              <input
                type="date"
                value={editorState.values.effective_to}
                onChange={(event) =>
                  setEditorState((prev) =>
                    prev
                      ? {
                          ...prev,
                          values: { ...prev.values, effective_to: event.target.value },
                        }
                      : prev
                  )
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={saveEditor}>Save changes</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;
