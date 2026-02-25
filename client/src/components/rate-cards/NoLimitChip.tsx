import React from "react";

type NoLimitChipProps = {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export default function NoLimitChip({ active, disabled = false, onToggle }: NoLimitChipProps) {
  return (
    <div
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition select-none ${
        active
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
          : "bg-gray-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      title={disabled ? "Only the last slab can be open-ended" : "Toggle open-ended slab"}
    >
      <span>∞</span>
      <span>No Limit</span>
    </div>
  );
}
