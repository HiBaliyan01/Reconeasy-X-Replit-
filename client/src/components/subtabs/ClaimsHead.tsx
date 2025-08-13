import React from "react";

export default function ClaimsHead() {
  return (
    <header
      className="
        bg-subheader-claims text-white
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
            Claims Management
          </h2>
          <p className="text-xs/5 opacity-90">
            Track claim status, aging, and resolution workflows
          </p>
        </div>

        <div className="flex gap-2">
          <button className="h-9 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white transition">
            Export PDF
          </button>
          <button className="h-9 px-3 rounded-xl bg-white hover:bg-white/90 text-subheader-claims transition">
            Bulk Actions
          </button>
        </div>
      </div>
    </header>
  );
}