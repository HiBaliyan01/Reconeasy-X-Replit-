import * as React from "react";

type Variant =
  | "payments"
  | "returns"
  | "settlements"
  | "orders"
  | "projected"
  | "claims";

const BG: Record<Variant, string> = {
  payments: "bg-subheader-payments",
  returns: "bg-subheader-returns",
  settlements: "bg-subheader-settlements",
  orders: "bg-subheader-orders",
  projected: "bg-subheader-projected",
  claims: "bg-subheader-claims",
};

const TEXT: Record<Variant, string> = {
  payments: "text-subheader-payments",
  returns: "text-subheader-returns",
  settlements: "text-subheader-settlements",
  orders: "text-subheader-orders",
  projected: "text-subheader-projected",
  claims: "text-subheader-claims",
};

export function HeaderGhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="h-9 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white transition">
      {children}
    </button>
  );
}

export function HeaderSolidBtn({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: Variant;
}) {
  return (
    <button
      className={`h-9 px-3 rounded-xl bg-white hover:bg-white/90 transition ${TEXT[variant]}`}
    >
      {children}
    </button>
  );
}

export default function SectionHeader({
  variant,
  title,
  description,
  actions,
}: {
  variant: Variant;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header
      className={`${BG[variant]} text-white rounded-2xl shadow-sm border border-white/10`}
    >
      <div className="min-h-16 w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3">
        <div>
          <h2 className="text-base font-semibold leading-6">{title}</h2>
          {description ? (
            <p className="text-xs/5 opacity-90">{description}</p>
          ) : null}
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </header>
  );
}