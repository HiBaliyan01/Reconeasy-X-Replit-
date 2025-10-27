import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";

export type PublishSummaryDetail = {
  marketplace?: string | null;
  category?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  commission_percent?: number | null;
  status?: "new" | "replaced" | string | null;
};

export type PublishSummaryData = {
  publishedCount: number;
  replacedCount: number;
  skippedCount: number;
  templateType?: string | null;
  templateVersion?: string | null;
  marketplaces?: string[];
  categories?: string[];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  uploadedBy?: string | null;
  details?: PublishSummaryDetail[];
};

type PublishSummaryModalProps = {
  data: PublishSummaryData | null;
  open: boolean;
  onClose: () => void;
  onViewRateCards: () => void;
};

const formatList = (items?: string[]) => {
  if (!items || !items.length) return "—";
  if (items.length <= 3) return items.join(", ");
  const firstThree = items.slice(0, 3).join(", ");
  return `${firstThree} + ${items.length - 3} more`;
};

const formatTemplate = (type?: string | null, version?: string | null) => {
  if (!type && !version) return "—";
  if (!type) return version ?? "—";
  if (!version) return type;
  return `${type} • ${version}`;
};

const formatCoverageWindow = (from?: string | null, to?: string | null) => {
  if (!from && !to) return "—";
  const start = from ?? "—";
  const end = to ?? "open";
  return `${start} → ${end}`;
};

const statusBadge = (status?: string | null) => {
  if ((status ?? "").toLowerCase() === "replaced") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
        <Circle className="h-3 w-3" />
        Replaced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <CheckCircle className="h-3 w-3" />
      New
    </span>
  );
};

const PublishSummaryModal: React.FC<PublishSummaryModalProps> = ({ data, open, onClose, onViewRateCards }) => {
  const bannerText = useMemo(() => {
    if (!data) return null;
    const lines = [`${data.publishedCount} new records added`];
    if (data.replacedCount > 0) {
      lines.push(`${data.replacedCount} outdated records archived automatically`);
    }
    return lines;
  }, [data]);

  if (!data) return null;

  return (
    <Modal open={open} onClose={onClose} title="Rate Card Published Successfully" maxWidthClass="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col gap-5 rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur-sm"
      >
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-emerald-400" aria-hidden="true" />

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-800">Rate Card Published Successfully</h2>
          <p className="text-sm text-slate-600">
            ReconEasy has updated your active rate cards based on the uploaded file. Review the summary below before
            continuing.
          </p>
        </div>

        {bannerText && (
          <div className="mt-2 flex flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle className="h-4 w-4" />
              <span>{bannerText[0]}</span>
            </div>
            {bannerText[1] ? <span className="text-sm">{bannerText[1]}</span> : null}
          </div>
        )}

        <div className="grid gap-4 rounded-xl border border-slate-100 bg-white/80 p-4 sm:grid-cols-2">
          <InsightItem label="Template" value={formatTemplate(data.templateType, data.templateVersion)} />
          <InsightItem label="Marketplaces affected" value={formatList(data.marketplaces)} />
          <InsightItem label="Categories updated" value={formatList(data.categories)} />
          <InsightItem
            label="Coverage window"
            value={formatCoverageWindow(data.effectiveFrom, data.effectiveTo)}
          />
          <InsightItem label="Uploaded by" value={data.uploadedBy ?? "—"} />
          <InsightItem
            label="Records summary"
            value={`${data.publishedCount} published • ${data.replacedCount} replaced • ${data.skippedCount} skipped`}
          />
        </div>

      {Array.isArray(data.details) && data.details.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Marketplace</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">To</th>
                  <th className="px-4 py-2 text-left">Commission %</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.details.map((row, index) => (
                  <tr
                    key={`${row.marketplace ?? "market"}-${row.category ?? "category"}-${index}`}
                    className="border-t border-slate-100 bg-white even:bg-slate-50"
                  >
                    <td className="px-4 py-2">{row.marketplace ?? "—"}</td>
                    <td className="px-4 py-2">{row.category ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{row.effective_from ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{row.effective_to ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {typeof row.commission_percent === "number" ? `${row.commission_percent}%` : "—"}
                    </td>
                    <td className="px-4 py-2">{statusBadge((row.status ?? "new").toLowerCase())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onViewRateCards}>View in Rate Cards</Button>
        </div>
      </motion.div>
    </Modal>
  );
};

const InsightItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <span className="text-sm font-medium text-slate-700">{value}</span>
  </div>
);

export default PublishSummaryModal;
