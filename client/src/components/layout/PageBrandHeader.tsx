import * as React from "react";

export default function PageBrandHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="bg-primary text-primary-foreground rounded-2xl shadow-sm border border-white/10">
      <div className="min-h-16 w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold leading-6">{title}</h1>
          {description ? (
            <p className="text-xs/5 opacity-90">{description}</p>
          ) : null}
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </header>
  );
}