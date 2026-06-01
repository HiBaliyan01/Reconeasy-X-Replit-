import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock3,
  Download,
  Eye,
  Grid2X2,
  MoreHorizontal,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DEFAULT_TENANT_ID } from "../config/tenant";

interface User {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: "admin" | "manager" | "analyst" | "viewer";
  department: string | null;
  status: "active" | "inactive" | "suspended";
  avatar_color: string;
  created_at: string;
  last_login: string | null;
}

type ViewMode = "table" | "grid";
type SortField = "full_name" | "role" | "status" | "last_login";
type SortDirection = "asc" | "desc";

const ROLE_OPTIONS: User["role"][] = ["admin", "manager", "analyst", "viewer"];
const STATUS_OPTIONS: User["status"][] = ["active", "inactive", "suspended"];

const roleBadgeStyles: Record<User["role"], string> = {
  admin: "border border-[rgba(15,130,104,0.18)] bg-[rgba(15,130,104,0.08)] text-[#0f8268]",
  manager: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  analyst: "border border-pink-200 bg-pink-50 text-pink-700",
  viewer: "border border-slate-200 bg-slate-50 text-slate-700",
};

const statusPillStyles: Record<User["status"], string> = {
  active: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border border-slate-200 bg-slate-50 text-slate-600",
  suspended: "border border-rose-200 bg-rose-50 text-rose-700",
};

const statusDotStyles: Record<User["status"], string> = {
  active: "#10b981",
  inactive: "#cbd5e1",
  suspended: "#e11d48",
};

function getDisplayName(user: User) {
  return user.full_name?.trim() || user.email;
}

function getAvatarInitials(user: User) {
  const name = user.full_name?.trim();

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }

  return user.email.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "RE";
}

function formatLastActive(lastLogin: string | null) {
  if (!lastLogin) return "—";
  return formatDistanceToNow(new Date(lastLogin), { addSuffix: true });
}

function escapeCsvValue(value: string | null) {
  if (!value) return "";
  return `"${value.replace(/"/g, '""')}"`;
}

function Avatar({ user, compact = false }: { user: User; compact?: boolean }) {
  const size = compact ? 32 : 36;

  return (
    <div className="relative flex-shrink-0">
      <div
        className="flex items-center justify-center rounded-full text-white font-semibold"
        style={{
          width: size,
          height: size,
          backgroundColor: user.avatar_color || "#0f6e56",
          fontSize: compact ? 12 : 13,
        }}
      >
        {getAvatarInitials(user)}
      </div>
      <span
        className="absolute -bottom-0.5 -right-0.5 block rounded-full border-2 border-white"
        style={{
          width: 10,
          height: 10,
          backgroundColor: statusDotStyles[user.status],
        }}
      />
    </div>
  );
}

function RoleBadge({ role }: { role: User["role"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium capitalize ${roleBadgeStyles[role]}`}
    >
      {role}
    </span>
  );
}

function StatusPill({ status }: { status: User["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium capitalize ${statusPillStyles[status]}`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: statusDotStyles[status] }}
      />
      {status}
    </span>
  );
}

function SortButton({
  label,
  field,
  sortField,
  sortDirection,
  onClick,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onClick: (field: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className="inline-flex items-center gap-1 text-[12px] font-medium uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-700"
    >
      {label}
      {active ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
      )}
    </button>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<SortField>("full_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`/api/users?tenant_id=${DEFAULT_TENANT_ID}`);
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const closeMenus = () => setActiveMenuId(null);
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status?.toLowerCase() === "active").length;
  const adminUsers = users.filter((u) => u.role?.toLowerCase() === "admin").length;
  const pendingInvites = 0;

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const roleValue = roleFilter.toLowerCase();
    const statusValue = statusFilter.toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !search ||
        getDisplayName(user).toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.role.toLowerCase().includes(search);

      const matchesRole = roleValue === "all" || user.role?.toLowerCase() === roleValue;
      const matchesStatus = statusValue === "all" || user.status?.toLowerCase() === statusValue;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const visibleUsers = useMemo(() => {
    const sorted = [...filteredUsers];

    sorted.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortField === "last_login") {
        const timeA = a.last_login ? new Date(a.last_login).getTime() : -1;
        const timeB = b.last_login ? new Date(b.last_login).getTime() : -1;
        return (timeA - timeB) * direction;
      }

      const valueA =
        sortField === "full_name"
          ? getDisplayName(a).toLowerCase()
          : a[sortField].toLowerCase();
      const valueB =
        sortField === "full_name"
          ? getDisplayName(b).toLowerCase()
          : b[sortField].toLowerCase();

      return valueA.localeCompare(valueB) * direction;
    });

    return sorted;
  }, [filteredUsers, sortDirection, sortField]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, users],
  );

  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    visibleUsers.length > 0 && visibleUsers.every((user) => selectedIds.includes(user.id));

  const sortedRoleOptions = ROLE_OPTIONS.map((role) => ({
    value: role,
    label: role.charAt(0).toUpperCase() + role.slice(1),
  }));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const setMessage = (message: string) => {
    setBannerMessage(message);
  };

  const updateUser = (userId: string, updater: (user: User) => User) => {
    setUsers((prev) => prev.map((user) => (user.id === userId ? updater(user) : user)));
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const role = newRole as User["role"];
    const previousUsers = users;
    setPendingRoleId(userId);
    updateUser(userId, (user) => ({ ...user, role }));

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          role,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update role: ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to update role:", err);
      setUsers(previousUsers);
      setMessage("Failed to update role. Try again.");
    } finally {
      setPendingRoleId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: User["status"]) => {
    const previousUsers = users;
    setPendingStatusId(userId);
    updateUser(userId, (user) => ({ ...user, status: newStatus }));

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update status: ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      setUsers(previousUsers);
      setMessage("Failed to update status. Try again.");
    } finally {
      setPendingStatusId(null);
      setActiveMenuId(null);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(`Delete ${getDisplayName(user)} from this tenant?`);
    if (!confirmed) return;

    const previousUsers = users;
    setPendingDeleteId(user.id);
    setUsers((prev) => prev.filter((entry) => entry.id !== user.id));
    setSelectedIds((prev) => prev.filter((id) => id !== user.id));
    setSelectedUserId((prev) => (prev === user.id ? null : prev));

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to delete user: ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
      setUsers(previousUsers);
      setMessage("Failed to delete user. Try again.");
    } finally {
      setPendingDeleteId(null);
      setActiveMenuId(null);
    }
  };

  const toggleSelectedUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleUsers.some((user) => user.id === id)));
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleUsers.forEach((user) => next.add(user.id));
      return Array.from(next);
    });
  };

  const handleExport = () => {
    const rows = visibleUsers.map((user) =>
      [
        escapeCsvValue(user.full_name),
        escapeCsvValue(user.email),
        escapeCsvValue(user.role),
        escapeCsvValue(user.department),
        escapeCsvValue(user.status),
        escapeCsvValue(user.created_at),
        escapeCsvValue(user.last_login),
      ].join(","),
    );

    const csv = [
      "full_name,email,role,department,status,created_at,last_login",
      ...rows,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reconeasy-users.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const tablePanelContent = (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="w-10 px-6 py-4 text-left">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </th>
            <th className="px-6 py-4 text-left">
              <SortButton
                label="User"
                field="full_name"
                sortField={sortField}
                sortDirection={sortDirection}
                onClick={handleSort}
              />
            </th>
            <th className="px-6 py-4 text-left">
              <SortButton
                label="Role"
                field="role"
                sortField={sortField}
                sortDirection={sortDirection}
                onClick={handleSort}
              />
            </th>
            <th className="px-6 py-4 text-left text-[12px] font-medium uppercase tracking-wide text-slate-500">
              Department
            </th>
            <th className="px-6 py-4 text-left">
              <SortButton
                label="Status"
                field="status"
                sortField={sortField}
                sortDirection={sortDirection}
                onClick={handleSort}
              />
            </th>
            <th className="px-6 py-4 text-left">
              <SortButton
                label="Last Active"
                field="last_login"
                sortField={sortField}
                sortDirection={sortDirection}
                onClick={handleSort}
              />
            </th>
            <th className="px-6 py-4 text-right text-[12px] font-medium uppercase tracking-wide text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {visibleUsers.map((user) => {
            const selected = selectedIds.includes(user.id);
            const menuOpen = activeMenuId === user.id;

            return (
              <tr
                key={user.id}
                className={`transition-colors hover:bg-slate-50/70 ${selected ? "bg-emerald-50/40" : "bg-white"}`}
              >
                <td className="px-6 py-4 align-top">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelectedUser(user.id)}
                    className="mt-2 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar user={user} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-slate-900">
                        {getDisplayName(user)}
                      </p>
                      <p className="truncate text-[12.5px] text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-6 py-4 text-[14px] text-slate-700">
                  {user.department || "—"}
                </td>
                <td className="px-6 py-4">
                  <StatusPill status={user.status} />
                </td>
                <td className="px-6 py-4 text-[13px] text-slate-600">
                  {formatLastActive(user.last_login)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveMenuId((prev) => (prev === user.id ? null : user.id));
                        }}
                        className="inline-flex items-center justify-center rounded-lg px-2.5 py-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpen && (
                        <div
                          className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setActiveMenuId(null);
                            }}
                            className="mb-2 w-full rounded-xl px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            View profile
                          </button>
                          <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[12px] font-medium text-slate-500">Change role</p>
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={pendingRoleId === user.id}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700"
                            >
                              {sortedRoleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(user.id, "inactive")}
                            disabled={pendingStatusId === user.id}
                            className="mb-2 w-full rounded-xl px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                          >
                            Deactivate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={pendingDeleteId === user.id}
                            className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                          >
                            {pendingDeleteId === user.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const gridPanelContent = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visibleUsers.map((user) => {
        const selected = selectedIds.includes(user.id);
        const menuOpen = activeMenuId === user.id;

        return (
          <div
            key={user.id}
            className={`rounded-2xl border p-5 transition-colors ${
              selected ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelectedUser(user.id)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <Avatar user={user} compact />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-slate-900">{getDisplayName(user)}</p>
                  <p className="truncate text-[12.5px] text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveMenuId((prev) => (prev === user.id ? null : user.id));
                  }}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setActiveMenuId(null);
                      }}
                      className="mb-2 w-full rounded-xl px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      View profile
                    </button>
                    <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[12px] font-medium text-slate-500">Change role</p>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={pendingRoleId === user.id}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700"
                      >
                        {sortedRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(user.id, "inactive")}
                      disabled={pendingStatusId === user.id}
                      className="mb-2 w-full rounded-xl px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                      Deactivate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      disabled={pendingDeleteId === user.id}
                      className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                    >
                      {pendingDeleteId === user.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <RoleBadge role={user.role} />
              <StatusPill status={user.status} />
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-600">
                {user.department || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[12.5px] text-slate-500">
              <span>Last active</span>
              <span>{formatLastActive(user.last_login)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 p-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Users &amp; Permissions</h1>
          <p className="mt-1 max-w-3xl text-sm text-teal-100">
            Manage who can access ReconEasy, what they can do, and how their activity is audited.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <button
            type="button"
            onClick={handleExport}
            className="h-9 px-4 rounded-lg bg-white/10 text-white font-medium text-sm border border-white/30 hover:bg-white/20 inline-flex items-center gap-1.5 transition"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() =>
              setMessage(
                "To invite a new team member, create their account in Supabase Auth first. They will appear here automatically after their first login.",
              )
            }
            className="h-9 px-4 rounded-lg bg-white text-teal-700 font-medium text-sm border border-white/30 hover:bg-teal-50 inline-flex items-center gap-1.5 transition"
          >
            <UserPlus className="h-4 w-4" />
            Invite user
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <span>{bannerMessage}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-slate-400 transition-colors hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Total Users</p>
              <p className="mt-4 text-[28px] font-semibold text-slate-900">{totalUsers}</p>
              <p className="mt-2 text-[12.5px] text-slate-500">
                {totalUsers} of {totalUsers}
              </p>
            </div>
            <div className="rounded-2xl bg-teal-50 p-3 text-teal-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Active</p>
              <p className="mt-4 text-[28px] font-semibold text-slate-900">{activeUsers}</p>
              <p className="mt-2 text-[12.5px] text-slate-500">
                {totalUsers === 0 ? 0 : Math.round((activeUsers / totalUsers) * 100)}% of total
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Administrators</p>
              <p className="mt-4 text-[28px] font-semibold text-slate-900">{adminUsers}</p>
              <p className="mt-2 text-[12.5px] text-slate-500">Highest privilege</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
              <Shield className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Pending Invites</p>
              <p className="mt-4 text-[28px] font-semibold text-slate-900">{pendingInvites}</p>
              <p className="mt-2 text-[12.5px] text-slate-500">Awaiting accept</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-500">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-8 py-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">All users</h2>
              <p className="mt-2 text-[13px] text-slate-500">
                Showing {visibleUsers.length} of {users.length}
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-4 xl:max-w-4xl xl:flex-row xl:items-end xl:justify-end">
              <div className="min-w-0 flex-1 xl:max-w-md">
                <label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-slate-500">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or role"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[14px] text-slate-700 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
                  />
                </div>
              </div>

              <div className="w-full xl:max-w-[180px]">
                <label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-slate-500">
                  Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-700 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
                >
                  <option value="all">All Roles</option>
                  {sortedRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full xl:max-w-[180px]">
                <label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-700 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
                >
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full xl:max-w-[220px]">
                <label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-slate-500">
                  View
                </label>
                <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100/80 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium transition ${
                      viewMode === "table"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium transition ${
                      viewMode === "grid"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Grid2X2 className="h-4 w-4" />
                    Grid
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-emerald-50/60 px-8 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-[13px] font-medium text-emerald-900">
              {selectedCount} user(s) selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMessage("Bulk role changes are coming soon.")}
                className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-[13px] font-medium text-emerald-800 transition hover:bg-emerald-50"
              >
                Change role
              </button>
              <button
                type="button"
                onClick={() => setMessage("Bulk deactivation is coming soon.")}
                className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-[13px] font-medium text-emerald-800 transition hover:bg-emerald-50"
              >
                Deactivate
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="p-0">
          {loading ? (
            <div className="space-y-4 px-8 py-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-[16px] font-medium text-slate-900">No users found</h3>
              <p className="mt-2 max-w-sm text-[13px] text-slate-500">
                Adjust your filters or refresh after new users log in through Supabase Auth.
              </p>
            </div>
          ) : viewMode === "table" ? (
            tablePanelContent
          ) : (
            <div className="px-8 py-8">{gridPanelContent}</div>
          )}
        </div>

        <div className="border-t border-slate-200 px-8 py-4 text-[13px] text-slate-500">
          {visibleUsers.length} user{visibleUsers.length === 1 ? "" : "s"} shown
        </div>
      </section>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] text-slate-500">User profile</p>
                <h3 className="mt-1 text-[22px] font-semibold text-slate-900">{getDisplayName(selectedUser)}</h3>
                <p className="mt-1 text-[13px] text-slate-500">{selectedUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <Avatar user={selectedUser} />
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={selectedUser.role} />
                <StatusPill status={selectedUser.status} />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Department</p>
                <p className="mt-2 text-[14px] text-slate-800">{selectedUser.department || "—"}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Last active</p>
                <p className="mt-2 text-[14px] text-slate-800">{formatLastActive(selectedUser.last_login)}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Created</p>
                <p className="mt-2 text-[14px] text-slate-800">
                  {formatDistanceToNow(new Date(selectedUser.created_at), { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Role</p>
                <select
                  value={selectedUser.role}
                  onChange={(e) => handleRoleChange(selectedUser.id, e.target.value)}
                  disabled={pendingRoleId === selectedUser.id}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-700 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
                >
                  {sortedRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleStatusChange(selectedUser.id, "inactive")}
                disabled={pendingStatusId === selectedUser.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Deactivate
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(selectedUser)}
                disabled={pendingDeleteId === selectedUser.id}
                className="rounded-xl bg-slate-900 px-4 py-3 text-[14px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {pendingDeleteId === selectedUser.id ? "Deleting..." : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
