import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, FileText, RefreshCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GapRecord } from "./RateCardGapAlerts";

export type PublishDigestDetail = {
  marketplace?: string | null;
  category?: string | null;
  commission_percent?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
};

export type PublishDigestData = {
  id: string;
  uploadedAt?: string | null;
  templateType?: string | null;
  templateVersion?: string | null;
  publishedCount: number;
  replacedCount: number;
  skippedCount: number;
  marketplaces?: string[];
  categories?: string[];
  details?: PublishDigestDetail[];
};

type PublishSummaryCardProps = {
  digest: PublishDigestData | null;
  loadingDigest?: boolean;
  gaps: GapRecord[];
  loadingGaps?: boolean;
  onRefreshCoverage: () => void;
  onOpenCoverageModal: () => void;
  aiSummary?: string | null;
};

const summarizeList = (items?: string[]) => {
  if (!items || !items.length) return { label: "0", detail: "—" };
  const detail = items.length <= 3 ? items.join(", ") : `${items.slice(0, 3).join(", ")} + ${items.length - 3} more`;
  return { label: String(items.length), detail };
};

const PublishSummaryCard: React.FC<PublishSummaryCardProps> = ({
  digest,
  loadingDigest,
  gaps,
  loadingGaps,
  onRefreshCoverage,
  onOpenCoverageModal,
  aiSummary,
}) => {
  const timestamp = useMemo(() => {
    if (!digest?.uploadedAt) return "—";
    return new Date(digest.uploadedAt).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [digest?.uploadedAt]);

  const templateLabel = useMemo(() => {
    if (!digest) return "—";
    if (!digest.templateType && !digest.templateVersion) return "—";
    return `${digest.templateType ?? "—"}${digest.templateVersion ? ` • ${digest.templateVersion}` : ""}`;
  }, [digest]);

  const marketplaceInfo = useMemo(() => summarizeList(digest?.marketplaces), [digest?.marketplaces]);
  const categoryInfo = useMemo(() => summarizeList(digest?.categories), [digest?.categories]);

  const gapPreview = useMemo(() => gaps.slice(0, 3), [gaps]);

  const isLoading = loadingDigest;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <FileText className="h-4 w-4 text-teal-600" />
            Last Publish Summary
          </div>
          <span className="text-xs text-slate-500">{timestamp}</span>
        </div>

        {isLoading ? (
          <div className="mt-4 flex h-16 items-center justify-center text-sm text-slate-500">
            Loading latest publish details…
          </div>
        ) : digest ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className="border border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                ✅ {digest.publishedCount} new
              </Badge>
              <Badge
                variant="outline"
                className="border border-amber-200 bg-amber-50 text-amber-700"
              >
                ♻️ {digest.replacedCount} replaced
              </Badge>
              <Badge variant="outline" className="border border-slate-200 bg-slate-50 text-slate-600">
                ⚙️ {templateLabel}
              </Badge>
              <span className="text-slate-400">
                · {marketplaceInfo.label} marketplace{marketplaceInfo.label === "1" ? "" : "s"} ·{" "}
                {categoryInfo.label} categor{categoryInfo.label === "1" ? "y" : "ies"}
              </span>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              <span className="font-medium">Marketplaces:</span> {marketplaceInfo.detail}
              {" · "}
              <span className="font-medium">Categories:</span> {categoryInfo.detail}
            </div>
          </>
        ) : (
          <div className="mt-4 flex h-16 items-center justify-center text-sm text-slate-500">
            No published rate cards yet.
          </div>
        )}

        {gaps.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {gaps.length} coverage gap{gaps.length === 1 ? "" : "s"} detected
              </div>
              <Button variant="outline" size="sm" onClick={onOpenCoverageModal}>
                View details
              </Button>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              {gapPreview.map((gap, index) => (
                <li key={`${gap.marketplace}-${gap.category}-${index}`} className="flex justify-between gap-4">
                  <span>
                    {gap.marketplace} · {gap.category}
                  </span>
                  <span
                    className={
                      gap.status === "missing_period"
                        ? "font-medium text-rose-600"
                        : "font-medium text-amber-600"
                    }
                  >
                    {gap.status === "missing_period" ? "Missing period" : "Missing current"}
                  </span>
                </li>
              ))}
              {gaps.length > gapPreview.length ? (
                <li className="text-right text-xs text-amber-600">+ {gaps.length - gapPreview.length} more</li>
              ) : null}
            </ul>
          </div>
        ) : loadingGaps ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            Checking coverage gaps…
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onRefreshCoverage}>
            <RefreshCcw className="mr-1 h-4 w-4" />
            Re-check Coverage
          </Button>
        </div>
      </motion.div>

      {aiSummary ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
        >
          <Sparkles className="mr-1 inline h-4 w-4 text-teal-500" />
          {aiSummary}
        </motion.div>
      ) : null}
    </>
  );
};

export default PublishSummaryCard;
