// ARCHIVED — card format user management
// Replaced by table format in UserManagement.tsx wired to real data
// Kept for reference: card layout pattern with avatar initials
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MoreHorizontal, Shield, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type UserRole = "admin" | "manager" | "analyst" | "viewer";
type UserStatus = "active" | "inactive" | "suspended";

interface TeamMember {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string;
  role: UserRole;
  department: string | null;
  status: UserStatus;
  avatar_color: string | null;
  created_at: string;
  last_login: string | null;
}

interface TeamAccessProps {
  tenantId: string;
}

const ROLE_OPTIONS: UserRole[] = ["admin", "manager", "analyst", "viewer"];

const roleBadgeClasses: Record<UserRole, string> = {
  admin: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  analyst: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

const statusDotClasses: Record<UserStatus, string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  suspended: "bg-red-500",
};

function getInitials(fullName: string | null, email: string): string {
  const source = (fullName?.trim() || email.split("@")[0] || "").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return source.slice(0, 1).toUpperCase() || "U";
}

function formatLastActive(lastLogin: string | null): string {
  if (!lastLogin) return "Never active";
  return `${formatDistanceToNow(new Date(lastLogin), { addSuffix: true })}`;
}

function TeamCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export default function TeamAccess({ tenantId }: TeamAccessProps) {
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [updatingUserIds, setUpdatingUserIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/users?tenant_id=${tenantId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch users");
        }
        const data = await res.json();
        if (mounted) {
          setUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
        if (mounted) {
          setUsers([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchUsers();
    return () => {
      mounted = false;
    };
  }, [tenantId]);

  const summary = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    return {
      total: users.length,
      active: users.filter((user) => user.status === "active").length,
      admins: users.filter((user) => user.role === "admin").length,
      last7DaysActive: users.filter((user) => user.last_login && new Date(user.last_login).getTime() >= sevenDaysAgo).length,
    };
  }, [users]);

  const updateUser = async (userId: string, updates: Partial<Pick<TeamMember, "role" | "department" | "status" | "full_name">>) => {
    const existingUser = users.find((user) => user.id === userId);
    if (!existingUser) return;

    setUpdatingUserIds((prev) => ({ ...prev, [userId]: true }));
    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, ...updates } : user)),
    );

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          role: updates.role,
          department: updates.department,
          status: updates.status,
          full_name: updates.full_name,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update user");
      }

      const data = await res.json();
      if (data.user) {
        setUsers((prev) =>
          prev.map((user) => (user.id === userId ? data.user : user)),
        );
      }
    } catch (error) {
      console.error("Failed to update user:", error);
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? existingUser : user)),
      );
    } finally {
      setUpdatingUserIds((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-page-title font-medium text-slate-900 dark:text-slate-100">Team Access</h2>
        <p className="mt-1 text-meta text-slate-600 dark:text-slate-400">
          Who can access ReconEasy reconciliation and claims workflows
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Members", value: summary.total, icon: Users },
          { label: "Active", value: summary.active, icon: CheckCircle2 },
          { label: "Admins", value: summary.admins, icon: Shield },
          { label: "Last 7 days active", value: summary.last7DaysActive, icon: CheckCircle2 },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-[28px] font-medium text-slate-900 dark:text-slate-100">
                  {item.value}
                </p>
              </div>
              <item.icon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <TeamCardSkeleton key={index} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-body font-medium text-slate-900 dark:text-slate-100">No team members yet.</p>
          <p className="mt-2 text-meta text-slate-600 dark:text-slate-400">
            Users are added through your Supabase authentication settings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => {
            const updating = updatingUserIds[user.id] === true;
            return (
              <div
                key={user.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: user.avatar_color || "#0f6e56" }}
                    >
                      {getInitials(user.full_name, user.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium text-slate-900 dark:text-slate-100">
                        {user.full_name || user.email.split("@")[0]}
                      </p>
                      <p className="truncate text-meta text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuUserId((current) => (current === user.id ? null : user.id))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenuUserId === user.id && (
                      <div className="absolute right-0 z-10 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuUserId(null);
                            void updateUser(user.id, { status: "inactive" });
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Set as inactive
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuUserId(null);
                            void updateUser(user.id, { status: "suspended" });
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Suspend
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClasses[user.role]}`}>
                    {user.role}
                  </span>
                  <span className="text-meta text-slate-500 dark:text-slate-400">
                    {user.department || "No department"}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-meta text-slate-500 dark:text-slate-400">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusDotClasses[user.status]}`} />
                  <span className="capitalize">{user.status}</span>
                  <span>•</span>
                  <span>Last active {formatLastActive(user.last_login)}</span>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <select
                    value={user.role}
                    disabled={updating}
                    onChange={(event) => void updateUser(user.id, { role: event.target.value as UserRole })}
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        Change Role: {role}
                      </option>
                    ))}
                  </select>
                  {updating && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Saving...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-meta text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        To add a new team member, create their account in your authentication settings first.
      </div>
    </div>
  );
}
