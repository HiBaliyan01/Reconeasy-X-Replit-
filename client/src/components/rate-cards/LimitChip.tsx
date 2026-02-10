import React from "react";

type LimitChipProps = {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export default function LimitChip({ active, disabled = false, onToggle }: LimitChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
          : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      title="Toggle open-ended slab"
    >
      <span>∞</span>
      <span>No Limit</span>
    </button>
  );
}
