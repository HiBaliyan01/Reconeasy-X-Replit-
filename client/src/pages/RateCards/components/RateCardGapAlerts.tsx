import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, CircleCheck, Clock, Loader2, RefreshCw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { invokeSupabaseFunction } from "@/utils/supabaseFunctions";

export type GapStatus = "missing_period" | "missing_current";

export type GapRecord = {
  marketplace: string;
  category: string;
  status: GapStatus;
  gap_from?: string | null;
  gap_to?: string | null;
  template_type?: string | null;
  template_version?: string | null;
};

type GapResponse =
  | {
      status: "success" | "ok";
      checked?: number;
      gaps?: GapRecord[];
      message?: string;
    }
  | {
      status: "error";
      message?: string;
    };

type RateCardGapAlertsProps = {
  refreshKey?: number;
  onGapDetected?: (count: number) => void;
  onGoToUpload?: () => void;
  openSignal?: number;
  onGapsChange?: (gaps: GapRecord[]) => void;
  onLoadingChange?: (loading: boolean) => void;
};

const STATUS_META: Record<GapStatus, { label: string; dot: string; badge: string }> = {
  missing_period: {
    label: "Missing period",
    dot: "bg-rose-500",
    badge: "border border-rose-200 bg-rose-50 text-rose-700",
  },
  missing_current: {
    label: "Missing current coverage",
    dot: "bg-amber-400",
    badge: "border border-amber-200 bg-amber-50 text-amber-700",
  },
};

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const RateCardGapAlerts: React.FC<RateCardGapAlertsProps> = ({
  refreshKey,
  onGapDetected,
  onGoToUpload,
  openSignal,
  onGapsChange,
  onLoadingChange,
}) => {
  const [gaps, setGaps] = useState<GapRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const hasGaps = gaps.length > 0;
  const marketplaceCount = useMemo(() => new Set(gaps.map((gap) => gap.marketplace)).size, [gaps]);
  const summaryEmoji = hasGaps && gaps.some((gap) => gap.status === "missing_period") ? "🔴" : "🟡";
  const lastCheckedLabel = lastChecked ? timeFormatter.format(lastChecked) : null;
  const isInitialLoading = loading && !lastChecked && !error;
  const gapCount = gaps.length;

  const loadGaps = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    try {
      const response = await invokeSupabaseFunction<GapResponse>("detect_rate_card_gaps", {
        method: "POST",
      });
      if (!response || response.status === "error") {
        throw new Error(response?.message || "Failed to load gap data");
      }
      const detected = Array.isArray(response.gaps) ? response.gaps : [];
      setGaps(detected);
      setLastChecked(new Date());
      onGapDetected?.(detected.length);
      onGapsChange?.(detected);
    } catch (err) {
      const message = (err as Error)?.message || "Failed to load gap data";
      setError(message);
      onGapDetected?.(0);
      onGapsChange?.([]);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [onGapDetected, onGapsChange, onLoadingChange]);

  useEffect(() => {
    loadGaps();
  }, [loadGaps, refreshKey]);

  useEffect(() => {
    if (typeof openSignal === "number") {
      setDrawerOpen(true);
    }
  }, [openSignal]);

  const summaryText = hasGaps
    ? `${summaryEmoji} ${gaps.length} gap${gaps.length === 1 ? "" : "s"} detected across ${marketplaceCount} marketplace${
        marketplaceCount === 1 ? "" : "s"
      } — review below.`
    : "All rate cards up-to-date.";

  const refreshButton = (
    <button
      type="button"
      onClick={loadGaps}
      className="inline-flex items-center rounded-full border border-transparent px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      aria-label="Refresh coverage gaps"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
    </button>
  );

  const renderBanner = () => {
    if (isInitialLoading) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Checking rate card coverage…</span>
        </div>
      );
    }

    if (hasGaps) {
      return (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{summaryText}</p>
              {lastCheckedLabel && (
                <p className="text-xs text-amber-700/80">Last checked {lastCheckedLabel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {refreshButton}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDrawerOpen(true)}
              className="border-emerald-200 text-emerald-600 hover:border-emerald-300 hover:text-emerald-700"
            >
              View details
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 shadow-sm">
        <div className="flex items-center gap-3">
          <CircleCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{summaryText}</p>
            {lastCheckedLabel && (
              <p className="text-xs text-emerald-700/80">Last checked {lastCheckedLabel}</p>
            )}
          </div>
        </div>
        {refreshButton}
      </div>
    );
  };

  const handleUploadCta = () => {
    onGoToUpload?.();
    setDrawerOpen(false);
  };

  return (
    <>
      <section className="space-y-3">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={loadGaps}
              className="border-rose-200 text-rose-600 hover:border-rose-300 hover:text-rose-700"
            >
              Retry
            </Button>
          </div>
        )}
        {renderBanner()}
      </section>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Coverage Gaps Detected"
        maxWidthClass="max-w-4xl"
      >
        <motion.div
          initial={{ opacity: 0.85, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col gap-4 rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur-sm sm:p-6"
        >
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#26A69A]" aria-hidden="true" />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Coverage Gaps Detected</h2>
            <button
              type="button"
              onClick={loadGaps}
              className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1 text-sm font-medium text-slate-500 transition hover:text-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400"
              disabled={loading}
              title="Recheck coverage gaps"
            >
              <RefreshCw className={`h-4 w-4 transition ${loading ? "animate-spin" : "hover:rotate-180"}`} size={18} />
              <span>Refresh</span>
            </button>
          </div>

          <p className="text-sm text-slate-600">
            {`${gapCount} gap${gapCount === 1 ? "" : "s"} detected across ${marketplaceCount || 0} marketplace${
              marketplaceCount === 1 ? "" : "s"
            }. `}
            <span className="text-slate-500">Upload or extend rate cards to resolve.</span>
          </p>

          {hasGaps ? (
            <div className="border-t border-slate-100">
              <table className="min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Marketplace</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Template</th>
                    <th className="px-4 py-2 text-left">Issue</th>
                    <th className="px-4 py-2 text-right tabular-nums w-32">Missing from</th>
                    <th className="px-4 py-2 text-right tabular-nums w-32">Missing to</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((gap, index) => {
                    const meta = STATUS_META[gap.status];
                    const key = `${gap.marketplace}-${gap.category}-${index}`;
                    return (
                      <tr
                        key={key}
                        className="border-b border-slate-100 bg-white even:bg-slate-50/80 transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-2 font-medium text-slate-800">{gap.marketplace}</td>
                        <td className="px-4 py-2">{gap.category}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {gap.template_type ? (
                            <>
                              {gap.template_type}
                              {gap.template_version ? ` • ${gap.template_version}` : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${meta.badge}`}
                          >
                            {gap.status === "missing_period" ? (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )}
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{gap.gap_from ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{gap.gap_to ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="mb-2 text-emerald-500" size={32} />
              <h3 className="text-base font-semibold text-emerald-600">All rate cards are covered</h3>
              <p className="text-sm text-slate-500">Your marketplaces have continuous coverage.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button onClick={handleUploadCta}>Upload New Rate Card</Button>
          </div>
        </motion.div>
      </Modal>
    </>
  );
};

export default RateCardGapAlerts;
