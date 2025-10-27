import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  onReplace: (selectedIds: string[], changeReason: string) => void;
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
    className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ${
      highlight ? "bg-amber-50" : "bg-white/60"
    } ${muted ? "text-slate-400" : "text-slate-600"}`}
  >
    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-700">{value}</span>
  </div>
);

const renderConflictCards = (
  conflicts: PublishConflictItem[],
  templateVersion: string,
  selectedIds: string[],
  onToggleRow: (id: string) => void
) => {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow">
        <div className="sticky top-0 border-b border-slate-100 bg-white px-6 py-4 text-sm font-semibold text-slate-600">
          Existing
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-5 max-h-[50vh]">
          {conflicts.map((conflict) => {
            const isSelected = selectedIds.includes(conflict.existing_id);
            return (
              <div
                key={`${conflict.existing_id}-existing`}
                className={`rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-150 ${
                  isSelected ? "opacity-100 ring-1 ring-emerald-200" : "opacity-70"
                }`}
              >
                <div className="border-b border-slate-100 px-6 py-4 text-sm font-semibold text-slate-700">
                  {conflict.existing_platform ?? "—"} • {conflict.existing_category ?? "—"}
                </div>
                <div className="space-y-3 bg-white px-6 py-4">
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
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border-2 border-teal-100 bg-white shadow-sm transition-shadow">
        <div className="sticky top-0 border-b border-teal-100 bg-teal-50 px-6 py-4 text-sm font-semibold text-teal-700">
          New upload
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-5 max-h-[50vh]">
          {conflicts.map((conflict) => {
            const isSelected = selectedIds.includes(conflict.existing_id);
            return (
              <div
                key={`${conflict.existing_id}-new`}
                className={`rounded-xl border border-teal-100 bg-white shadow-sm transition-all duration-150 ${
                  isSelected ? "opacity-100 ring-1 ring-emerald-200" : "opacity-70"
                }`}
              >
                <div className="border-b border-teal-100 px-6 py-4 text-sm font-semibold text-teal-700 flex items-center justify-between gap-3">
                  <span>
                    {conflict.new_platform} • {conflict.new_category}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleRow(conflict.existing_id)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                      aria-label={`Toggle replacement for ${conflict.new_platform} • ${conflict.new_category}`}
                    />
                    <span>Replace</span>
                  </label>
                </div>
                <div className="space-y-3 bg-white px-6 py-4">
                  <InfoRow
                    label="Date range"
                    value={conflict.new_range}
                    highlight={conflict.existing_range !== conflict.new_range}
                  />
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

const renderConfirmSummary = (prompt: Extract<PublishPromptState, { mode: "confirm" }>) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-slate-100 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [changeReason, setChangeReason] = useState("");

  useEffect(() => {
    if (prompt?.mode === "conflict") {
      setSelectedIds(prompt.conflicts.map((conflict) => conflict.existing_id));
      setChangeReason("");
    } else {
      setSelectedIds([]);
      setChangeReason("");
    }
  }, [prompt]);

  const allSelected = useMemo(() => {
    if (prompt?.mode !== "conflict") return false;
    if (selectedIds.length === 0) return false;
    return prompt.conflicts.every((conflict) => selectedIds.includes(conflict.existing_id));
  }, [prompt, selectedIds]);

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSelectAllToggle = () => {
    if (prompt?.mode !== "conflict") return;
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prompt.conflicts.map((conflict) => conflict.existing_id));
    }
  };

  const isConflictMode = prompt?.mode === "conflict";
  const isConfirmDisabled = isConflictMode ? publishing || selectedIds.length === 0 : Boolean(publishing);

  const handleConfirm = useCallback(() => {
    if (!prompt || isConfirmDisabled) return;
    if (prompt.mode === "conflict") {
      onReplace(selectedIds, changeReason);
    } else {
      onPublish();
    }
  }, [changeReason, isConfirmDisabled, onPublish, onReplace, prompt, selectedIds]);

  useEffect(() => {
    if (!prompt) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable = target?.getAttribute?.("contenteditable") === "true";
      if (tagName === "textarea" || isEditable) {
        return;
      }
      if (isConfirmDisabled) {
        return;
      }
      event.preventDefault();
      handleConfirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm, isConfirmDisabled, prompt]);

  if (!prompt) return null;

  return (
    <Modal open={Boolean(prompt)} onClose={onClose} title="Conflict Detected in Rate Card Upload" maxWidthClass="max-w-5xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60"
      >
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">Conflict Detected in Rate Card Upload</h2>
          <p className="text-sm text-slate-500">Review and confirm before publishing.</p>
        </div>

        {prompt.mode === "conflict" ? (
          <>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {selectedIds.length} of {prompt.conflicts.length} conflicts selected
              </span>
              <button
                type="button"
                onClick={handleSelectAllToggle}
                className="self-start rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 transition hover:border-teal-400 hover:text-teal-600 sm:self-auto"
              >
                {allSelected ? "Select none" : "Select all"}
              </button>
            </div>
            {renderConflictCards(prompt.conflicts, prompt.template_version, selectedIds, toggleRow)}
            <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
              <label htmlFor="change-reason" className="text-sm font-medium text-slate-700">
                Reason for Change (optional)
              </label>
              <textarea
                id="change-reason"
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                placeholder="Add context for why existing rate cards are being replaced."
                rows={4}
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </>
        ) : (
          renderConfirmSummary(prompt)
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-700">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="border-emerald-200 text-emerald-600 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-60"
          >
            Confirm & Publish
          </Button>
        </div>
      </motion.div>
    </Modal>
  );
};

export default ConflictModal;
