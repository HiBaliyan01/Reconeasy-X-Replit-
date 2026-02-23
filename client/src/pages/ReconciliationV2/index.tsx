import React from "react";

const riskCards = [
  {
    label: "Total At Risk",
    value: "₹ 2,48,320",
    subtext: "Across 124 unsettled orders",
    className: "text-slate-900",
  },
  {
    label: "Orders Delayed",
    value: "12",
    subtext: "Beyond SLA threshold",
    className: "text-amber-600",
  },
  {
    label: "High Value Discrepancies",
    value: "5",
    subtext: "Above ₹10,000 variance",
    className: "text-rose-600",
  },
  {
    label: "SLA Breach %",
    value: "8.4%",
    subtext: "Last 30 days",
    className: "text-rose-600",
  },
];

export default function ReconciliationV2() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-900">Financial Intelligence</h1>
            <p className="text-sm text-gray-500">
              Real-time payout risk, discrepancy exposure & settlement health
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
              Import Data
            </button>
            <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600">
              Run Reconciliation
            </button>
          </div>
        </div>

        {/* Risk Summary */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {riskCards.map((card) => (
            <div
              key={card.label}
              className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className={`mt-2 text-2xl font-bold ${card.className}`}>{card.value}</p>
              <p className="mt-1 text-sm text-gray-500">{card.subtext}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
