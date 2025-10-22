import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type PreviewModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
  confirmDisabled: boolean;
  templateType: "flat" | "tiered";
  version: string;
  fileName: string;
  mappedCount: number;
  missingMandatory: string[];
  unmapped: string[];
  headers: Array<{ label: string; mandatory: boolean }>;
  rowPreview: Array<Record<string, string>>;
};

const PreviewModal: React.FC<PreviewModalProps> = ({
  open,
  onClose,
  onConfirm,
  confirming,
  confirmDisabled,
  templateType,
  version,
  fileName,
  mappedCount,
  missingMandatory,
  unmapped,
  headers,
  rowPreview,
}) => {
  const missingSet = new Set(missingMandatory);
  const columnLabels = headers.length
    ? headers.map((field) => field.label)
    : rowPreview.length
    ? Object.keys(rowPreview[0])
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rate Card Preview – ${templateType === "tiered" ? "Tiered" : "Flat"} ${version}`}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <Badge variant="outline" className="uppercase tracking-wide text-xs font-semibold text-slate-500">
            {templateType === "tiered" ? "Tiered Template" : "Flat Template"}
          </Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            {version}
          </Badge>
          <span className="text-slate-500">{fileName}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryTile tone="success" label="Mapped" value={mappedCount} description="Columns matched" />
          <SummaryTile
            tone="warning"
            label="Missing mandatory"
            value={missingMandatory.length}
            description="Required columns"
          />
          <SummaryTile tone="neutral" label="Unmapped" value={unmapped.length} description="Unknown columns" />
        </div>

        {unmapped.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Unrecognized columns: {unmapped.join(", ")}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="max-h-[400px] overflow-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr>
                  {columnLabels.map((label) => {
                    const mandatory = headers.find((field) => field.label === label)?.mandatory ?? false;
                    return (
                      <th
                        key={label}
                        className={cn(
                          "px-5 py-3 text-left font-semibold",
                          mandatory ? "text-emerald-700" : "text-slate-900"
                        )}
                      >
                        {label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rowPreview.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {columnLabels.map((label) => (
                      <td
                        key={label}
                        className={cn(
                          "px-5 py-3 text-slate-600",
                          missingSet.has(label) ? "bg-rose-100 text-rose-700" : undefined
                        )}
                      >
                        {row[label] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-slate-500">Only the first 20 rows are shown. Data will be saved after confirmation.</p>
        </div>

        <div className="flex justify-between items-center gap-3">
          <div className="text-sm text-slate-500">
            {missingMandatory.length ? "Resolve missing mandatory columns to continue." : ""}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={confirmDisabled || confirming} className="gap-2">
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                </>
              ) : (
                "Confirm & Import"
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

type SummaryTileTone = "success" | "warning" | "neutral";

type SummaryTileProps = {
  tone: SummaryTileTone;
  label: string;
  value: number;
  description: string;
};

const SUMMARY_COLORS: Record<SummaryTileTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

const SummaryTile: React.FC<SummaryTileProps> = ({ tone, label, value, description }) => (
  <div className={cn("rounded-xl px-4 py-3", SUMMARY_COLORS[tone])}>
    <p className="text-xs uppercase tracking-wide">{label}</p>
    <p className="mt-1 text-lg font-semibold">{value}</p>
    <p className="text-xs text-slate-500">{description}</p>
  </div>
);

export default PreviewModal;
