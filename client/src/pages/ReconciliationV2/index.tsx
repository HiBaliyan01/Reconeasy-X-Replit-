const previewFeatures = [
  {
    title: "Leakage Trends",
    description:
      "Track leakage patterns across marketplaces, categories, and time periods.",
  },
  {
    title: "High-Risk SKUs",
    description:
      "Identify products repeatedly affected by missing payments, overcharges, or returns leakage.",
  },
  {
    title: "Recovery Forecasting",
    description:
      "Estimate recovery opportunities based on historical claims and marketplace behavior.",
  },
  {
    title: "Anomaly Detection",
    description:
      "Detect unusual fee changes, payout delays, and return refund patterns automatically.",
  },
];

export default function ReconciliationV2() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-page-title font-medium text-slate-900 dark:text-slate-100">
          Financial Intelligence
        </h1>
        <p className="text-meta text-muted-foreground">
          AI-powered insights and recovery optimization for marketplace reconciliation.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-card">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-heading font-medium text-slate-900 dark:text-slate-100">
            Coming soon
          </h2>
          <p className="text-body text-slate-600 dark:text-slate-300">
            We&apos;re building intelligence layers that turn reconciliation data into actionable
            recovery insights.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {previewFeatures.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <h3 className="text-heading font-medium text-slate-900 dark:text-slate-100">
                {feature.title}
              </h3>
              <p className="mt-2 text-body text-slate-600 dark:text-slate-300">
                {feature.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/20">
          <p className="text-label font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Current signal
          </p>
          <p className="mt-2 text-body text-teal-900 dark:text-teal-100">
            Payment reconciliation is already detecting missing payments and overcharges.
          </p>
        </div>
      </section>
    </div>
  );
}
