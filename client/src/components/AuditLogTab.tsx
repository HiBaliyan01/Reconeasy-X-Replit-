import React, { useEffect, useMemo, useState } from "react";

type AuditEvent = {
  id: string;
  action: string;
  module: "rate_cards" | "reconciliation_settings" | "claims" | "uploads" | "users";
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  metadata: Record<string, any> | null;
  status: "success" | "failed";
  created_at: string;
  user_name: string | null;
  full_name: string | null;
  email: string | null;
  avatar_color: string | null;
};

type AuditLogTabProps = {
  tenantId: string;
};

const moduleStyles: Record<AuditEvent["module"], string> = {
  rate_cards: "border border-teal-200 bg-teal-50 text-teal-700",
  reconciliation_settings: "border border-blue-200 bg-blue-50 text-blue-700",
  claims: "border border-purple-200 bg-purple-50 text-purple-700",
  uploads: "border border-amber-200 bg-amber-50 text-amber-700",
  users: "border border-slate-200 bg-slate-50 text-slate-700",
};

const moduleLabels: Record<AuditEvent["module"], string> = {
  rate_cards: "Rate Cards",
  reconciliation_settings: "Reconciliation",
  claims: "Claims",
  uploads: "Uploads",
  users: "Users",
};

function getRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(event: AuditEvent) {
  const source = event.full_name?.trim() || event.user_name?.trim() || event.email?.trim() || "System";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getDisplayName(event: AuditEvent) {
  return event.full_name?.trim() || event.user_name?.trim() || "System";
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="border-b border-slate-100 last:border-b-0">
          {Array.from({ length: 5 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-4 py-4">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function AuditLogTab({ tenantId }: AuditLogTabProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch(`/api/audit-log?tenant_id=${tenantId}&limit=100`);
        if (!response.ok) {
          throw new Error("Failed to fetch audit log");
        }
        const data = await response.json();
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (error) {
        console.error("Failed to fetch audit log:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchEvents();
  }, [tenantId]);

  const rows = useMemo(() => events, [events]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-slate-900">Activity log</h2>
        <p className="mt-2 text-[13px] text-slate-500">
          Every significant action across reconciliation, claims, rate cards, and uploads.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Module
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <p className="text-sm font-medium text-slate-700">No activity recorded yet.</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Actions will appear here as your team uses ReconEasy.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((event) => (
                  <tr key={event.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                    <td
                      className="whitespace-nowrap px-4 py-4 text-sm text-slate-700"
                      title={new Date(event.created_at).toLocaleString("en-IN")}
                    >
                      {getRelativeTime(event.created_at)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: event.avatar_color || "#64748b" }}
                        >
                          {getInitials(event)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{getDisplayName(event)}</p>
                          {event.email ? <p className="text-xs text-slate-500">{event.email}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{event.description}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${moduleStyles[event.module]}`}>
                        {moduleLabels[event.module]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          event.status === "success"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {event.status === "success" ? "✓ Success" : "✗ Failed"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
