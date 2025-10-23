import React, { Fragment } from "react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";

export type PublishConflictItem = {
  existing_id: string;
  existing_platform: string | null;
  existing_category: string | null;
  existing_range: string;
  existing_rate: { commission_type: string | null; commission_percent: number | null };
  existing_status: string;
  existing_version: string | null;
  new_platform: string;
  new_category: string;
  new_range: string;
  new_rate: { commission_type: string | null; commission_percent: number | null };
  version_mismatch: boolean;
};

import type { RateCardImportSummary } from "./ImportHistoryTable";

export type PublishPromptState =
  | {
      mode: "conflict";
      record: RateCardImportSummary;
      message?: string;
      conflicts: PublishConflictItem[];
      template_type: string;
      template_version: string;
      cross_marketplace_enabled?: boolean;
    }
  | {
      mode: "confirm";
      record: RateCardImportSummary;
      message?: string;
      row_count: number;
      template_type: string;
      template_version: string;
    };

type ConflictModalProps = {
  prompt: PublishPromptState | null;
  onClose: () => void;
  onReplace: () => void;
  onPublish: () => void;
  publishing: boolean;
};

const InfoRow = ({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
}) => (
  <div
    className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
      highlight ? "bg-amber-50" : "bg-white/60"
    } ${muted ? "text-slate-400" : "text-slate-600"}`}
  >
    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-700">{value}</span>
  </div>
);

const renderConflictCards = (conflicts: PublishConflictItem[], templateVersion: string) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-inner">
        <div className="sticky top-0 border-b border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-600">
          Existing
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-3 max-h-[50vh]">
          {conflicts.map((conflict) => (
            <div key={`${conflict.existing_id}-existing`} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                {conflict.existing_platform ?? "—"} • {conflict.existing_category ?? "—"}
              </div>
              <div className="space-y-1.5 bg-white/80 px-3 py-3">
                <InfoRow label="Date range" value={conflict.existing_range} />
                <InfoRow
                  label="Commission"
                  value={`${conflict.existing_rate.commission_type ?? "—"} ${
                    conflict.existing_rate.commission_percent ?? "—"
                  }`}
                  highlight={
                    conflict.existing_rate.commission_type !== conflict.new_rate.commission_type ||
                    conflict.existing_rate.commission_percent !== conflict.new_rate.commission_percent
                  }
                />
                <InfoRow label="Status" value={conflict.existing_status} />
                <InfoRow
                  label="Template"
                  value={conflict.existing_version ?? "Not tagged"}
                  highlight={conflict.version_mismatch}
                  muted={!conflict.existing_version}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border-2 border-teal-200 bg-white/90 shadow-inner">
        <div className="sticky top-0 border-b border-teal-200 bg-teal-50/80 px-4 py-3 text-sm font-semibold text-teal-700">
          New upload
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-3 max-h-[50vh]">
          {conflicts.map((conflict) => (
            <div key={`${conflict.existing_id}-new`} className="rounded-xl border border-teal-200 bg-white shadow-sm">
              <div className="border-b border-teal-100 px-3 py-2 text-sm font-semibold text-teal-700">
                {conflict.new_platform} • {conflict.new_category}
              </div>
              <div className="space-y-1.5 bg-white/80 px-3 py-3">
                <InfoRow label="Date range" value={conflict.new_range} highlight={conflict.existing_range !== conflict.new_range} />
                <InfoRow
                  label="Commission"
                  value={`${conflict.new_rate.commission_type ?? "—"} ${conflict.new_rate.commission_percent ?? "—"}`}
                  highlight={
                    conflict.existing_rate.commission_type !== conflict.new_rate.commission_type ||
                    conflict.existing_rate.commission_percent !== conflict.new_rate.commission_percent
                  }
                />
                <InfoRow label="Status" value="Pending" muted />
                <InfoRow label="Template" value={templateVersion} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const renderConfirmSummary = (prompt: Extract<PublishPromptState, { mode: "confirm" }>) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-inner">
      <p>
        <span className="font-semibold text-slate-700">Template:</span> {prompt.template_type} • {prompt.template_version}
      </p>
      <p>
        <span className="font-semibold text-slate-700">Rows ready:</span> {prompt.row_count ?? "-"}
      </p>
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-300">
      {prompt.message ?? "No conflicts detected. Publish the new rate cards?"}
    </p>
  </div>
);

const ConflictModal: React.FC<ConflictModalProps> = ({ prompt, onClose, onReplace, onPublish, publishing }) => {
  if (!prompt) return null;

  return (
    <Modal
      open={Boolean(prompt)}
      onClose={onClose}
      title="Conflict Detected in Rate Card Upload"
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">Conflict Detected in Rate Card Upload</h2>
          <p className="text-sm text-slate-500">Review and confirm before publishing.</p>
        </div>

        {prompt.mode === "conflict"
          ? renderConflictCards(prompt.conflicts, prompt.template_version)
          : renderConfirmSummary(prompt)}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-700">
            Cancel
          </Button>
          {prompt.mode === "conflict" ? (
            <Button
              variant="outline"
              onClick={onReplace}
              disabled={publishing}
              className="border-emerald-200 text-emerald-600 hover:border-emerald-400 hover:text-emerald-700"
            >
              Confirm & Publish
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={onPublish}
              disabled={publishing}
              className="border-emerald-200 text-emerald-600 hover:border-emerald-400 hover:text-emerald-700"
            >
              Confirm & Publish
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ConflictModal;
