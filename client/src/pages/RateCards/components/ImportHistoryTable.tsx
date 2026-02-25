import React, { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RateCardImportSummary = {
  id: string;
  file_name: string | null;
  template_type: string | null;
  version: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  validation_status: string | null;
  rows: number;
  status?: string | null;
  record_count?: number | null;
  restore_available?: boolean;
  restore_expires_at?: string | null;
  restore_created_at?: string | null;
  restore_used_at?: string | null;
};

type ImportHistoryTableProps = {
  records: RateCardImportSummary[];
  loading?: boolean;
  onRefresh?: () => void;
  onPublish?: (record: RateCardImportSummary) => void;
  publishingId?: string | null;
  onRestore?: (record: RateCardImportSummary) => void;
  restoringId?: string | null;
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  success: { label: "Imported", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  warning: { label: "Imported with warnings", className: "bg-amber-100 text-amber-800 border-amber-200" },
  failed: { label: "Failed", className: "bg-rose-100 text-rose-700 border-rose-200" },
  published: { label: "Published", className: "bg-sky-100 text-sky-700 border-sky-200" },
};

export const ImportHistoryTable: React.FC<ImportHistoryTableProps> = ({
  records,
  loading = false,
  onRefresh,
  onPublish,
  publishingId,
  onRestore,
  restoringId,
}) => {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<string>("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "7d"
        ? now - 7 * 86400000
        : range === "30d"
        ? now - 30 * 86400000
        : null;
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      if (cutoff && record.uploaded_at) {
        const uploaded = Date.parse(record.uploaded_at);
        if (!Number.isNaN(uploaded) && uploaded < cutoff) {
          return false;
        }
      }
      if (!normalizedQuery) return true;
      const haystack = [
        record.file_name ?? "",
        record.template_type ?? "",
        record.version ?? "",
        record.uploaded_by ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, range, records]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search file, type, or user"
            className="h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Search recent imports"
          />
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Filter by date range"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
          className="gap-2"
          aria-label="Refresh recent imports"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full text-sm text-slate-700">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">File name</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Version</th>
              <th className="px-4 py-3 text-left font-medium text-right">Rows</th>
              <th className="px-4 py-3 text-left font-medium">Uploaded by</th>
              <th className="px-4 py-3 text-left font-medium">Uploaded at</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-500" aria-hidden="true" />
                  <p className="mt-3 text-sm">Loading recent imports…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No imports yet. Upload a rate card to see it here.
                </td>
              </tr>
            ) : (
              filtered.map((record) => {
                const statusKey = record.status ?? record.validation_status ?? "success";
                const badge = STATUS_STYLES[statusKey] ?? STATUS_STYLES.success;
                const isPublished = statusKey === "published";
                const restoreExpiresAt = record.restore_expires_at ? new Date(record.restore_expires_at) : null;
                const restoreExpired = restoreExpiresAt ? restoreExpiresAt.getTime() <= Date.now() : false;
                const restoreUsed = Boolean(record.restore_used_at);
                const restoreAvailable =
                  Boolean(
                    onRestore &&
                      isPublished &&
                      record.restore_available &&
                      !restoreExpired &&
                      !restoreUsed
                  );
                return (
                  <tr key={record.id} className="border-t border-slate-100 bg-white">
                    <td className="px-4 py-3 font-medium text-slate-800">{record.file_name ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{record.template_type ?? "—"}</td>
                    <td className="px-4 py-3">{record.version ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{record.record_count ?? record.rows}</td>
                    <td className="px-4 py-3">{record.uploaded_by ?? "—"}</td>
                    <td className="px-4 py-3">
                      {record.uploaded_at
                        ? formatter.format(new Date(record.uploaded_at))
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("rounded-full border", badge.className)}
                      >
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {!isPublished && onPublish ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onPublish(record)}
                          disabled={publishingId === record.id}
                          className="border-emerald-200 text-emerald-600 hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {publishingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Publish"}
                        </Button>
                      ) : restoreAvailable ? (
                        <div className="flex flex-col items-start gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onRestore?.(record)}
                            disabled={restoringId === record.id}
                            className="border-sky-200 text-sky-600 hover:border-sky-400 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {restoringId === record.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              "Restore"
                            )}
                          </Button>
                          {restoreExpiresAt && (
                            <span className="text-xs text-slate-400">
                              Expires {formatter.format(restoreExpiresAt)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {isPublished ? (restoreUsed ? "Restored" : restoreExpired ? "Restore window elapsed" : "—") : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ImportHistoryTable;
