import React, { useEffect, useState } from "react";
import { fetchReconciliationSummary } from "../../services/reconciliations";

type SummaryState = {
  total_expected_payout: number;
  total_at_risk: number;
  delayed_count: number;
  pending_count: number;
};

export default function ReconciliationV2() {
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchReconciliationSummary();
        setSummary({
          total_expected_payout: Number(data?.total_expected_payout ?? 0),
          total_at_risk: Number(data?.total_at_risk ?? 0),
          delayed_count: Number(data?.delayed_count ?? 0),
          pending_count: Number(data?.pending_count ?? 0),
        });
      } catch (err: any) {
        setError("Unable to load reconciliation summary.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const riskCards = [
    {
      label: "Total Expected Payout",
      value: summary ? `₹ ${Math.round(summary.total_expected_payout).toLocaleString()}` : "—",
      subtext: "Latest completed run",
      className: "text-slate-900",
    },
    {
      label: "Total At Risk",
      value: summary ? `₹ ${Math.round(summary.total_at_risk).toLocaleString()}` : "—",
      subtext: "Pending or delayed orders",
      className: "text-rose-600",
    },
    {
      label: "Orders Delayed",
      value: summary ? `${summary.delayed_count}` : "—",
      subtext: "Beyond SLA threshold",
      className: "text-amber-600",
    },
    {
      label: "Orders Pending",
      value: summary ? `${summary.pending_count}` : "—",
      subtext: "Awaiting expected payout date",
      className: "text-slate-900",
    },
  ];

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
          {loading && (
            <div className="col-span-4 text-center text-sm text-muted-foreground py-6">
              Loading reconciliation summary…
            </div>
          )}
          {error && (
            <div className="col-span-4 text-center text-sm text-rose-600 py-6">
              {error}
            </div>
          )}
          {!loading &&
            !error &&
            riskCards.map((card) => (
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
