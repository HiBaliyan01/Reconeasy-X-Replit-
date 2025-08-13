import React from "react";

export default function PaymentsHead() {
  return (
    <header
      className="
        bg-subheader-payments text-white
        rounded-2xl shadow-sm
        border border-white/10
      "
    >
      <div
        className="
          min-h-16
          w-full
          flex flex-col sm:flex-row
          items-start sm:items-center
          justify-between gap-3
          px-5 py-3
        "
      >
        <div>
          <h2 className="text-base font-semibold leading-6">
            Payment Reconciliation
          </h2>
          <p className="text-xs/5 opacity-90">
            Track settlements, discrepancies, and overdue amounts
          </p>
        </div>

        <div className="flex gap-2">
          <button className="h-9 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white transition">
            Export Report
          </button>
          <button className="h-9 px-3 rounded-xl bg-white hover:bg-white/90 text-subheader-payments transition">
            Advanced Filters
          </button>
        </div>
      </div>
    </header>
  );
}