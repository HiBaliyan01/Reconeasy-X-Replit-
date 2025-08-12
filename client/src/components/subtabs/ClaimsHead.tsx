import React from 'react';

export default function ClaimsHead() {
  return (
    <header className="
      flex items-center justify-between
      rounded-t-2xl px-4 py-3
      bg-[hsl(var(--subheader-claims))] text-white
    ">
      <h2 className="text-base font-semibold">Claims Management</h2>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
          Export PDF
        </button>
        <button className="px-3 py-2 rounded-xl bg-white text-[hsl(var(--subheader-claims))] hover:bg-white/90 transition-colors font-medium">
          Bulk Actions
        </button>
      </div>
    </header>
  );
}