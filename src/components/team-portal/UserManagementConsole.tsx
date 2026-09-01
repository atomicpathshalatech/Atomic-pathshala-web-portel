"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "EXPIRED" | "PENDING_VERIFICATION";
  role: string;
  roleLabel: string;
  department: string;
  position: string;
  subject: string | null;
  subjectScope: string[];
  batchScope: string[];
  contractType: string;
  contractStart: string | null;
  contractEnd: string | null;
  contractNote: string | null;
  overridesCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}

const PRIMARY_ROLES = [
  { value: "TEACHER", label: "Teacher", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "SUPER_ADMIN", label: "Super Admin", badge: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "ADMIN", label: "Admin", badge: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "CONTENT_CREATOR", label: "Content Creator", badge: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: "SME", label: "Subject Matter Expert (SME)", badge: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { value: "SALES", label: "Sales", badge: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  { value: "DESIGNER", label: "Designer", badge: "bg-pink-100 text-pink-800 border-pink-300" },
  { value: "VIDEO_EDITOR", label: "Video Editor", badge: "bg-rose-100 text-rose-800 border-rose-300" },
];

const SUBJECT_OPTIONS = ["Physics", "Chemistry", "Biology", "Mathematics", "Botany", "Zoology", "ALL"];

export function UserManagementConsole() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Quick Create Form (Matching Reference Screenshot)
  const [quickForm, setQuickForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "TEACHER",
    subject: "Physics",
  });
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Advanced User Modal
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [advForm, setAdvForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    roleName: "TEACHER",
    department: "Academic",
    position: "Physics Faculty",
    subject: "Physics",
    subjectScope: ["Physics"],
    batchScope: ["ALL"],
    contractType: "FULL_TIME",
    contractStart: new Date().toISOString().split("T")[0],
    contractEnd: "",
    contractNote: "",
  });

  // Departments & Positions Catalog
  const [catalog, setCatalog] = useState<{ departments: string[]; positions: any[]; contractTypes: any[] }>({
    departments: [],
    positions: [],
    contractTypes: [],
  });

  // Selected for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/team/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
      setStats(data.stats || {});
    } catch (err: any) {
      toast.error(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const res = await fetch("/api/team/departments");
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadCatalog();
  }, []);

  // Quick Create Submit
  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.name || !quickForm.email || !quickForm.password) {
      toast.error("Please fill Name, Email, and Password");
      return;
    }

    try {
      setIsCreatingQuick(true);
      const res = await fetch("/api/team/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickForm.name,
          email: quickForm.email,
          password: quickForm.password,
          roleName: quickForm.role,
          subject: quickForm.subject,
          department: quickForm.role === "TEACHER" ? "Academic" : "Administration",
          position: quickForm.role === "TEACHER" ? `${quickForm.subject} Faculty` : "Staff",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      toast.success(`User "${quickForm.name}" created successfully!`);
      setQuickForm({ name: "", email: "", password: "", role: "TEACHER", subject: "Physics" });
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingQuick(false);
    }
  };

  // Advanced User Submit
  const handleAdvancedCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/team/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(advForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      toast.success(`User "${advForm.name}" created successfully with granular scopes!`);
      setIsAdvancedModalOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Toggle User Status
  const handleToggleStatus = async (user: UserItem) => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/team/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`User status updated to ${newStatus}`);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase());

      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesDept = deptFilter === "ALL" || u.department === deptFilter;
      const matchesSubject = subjectFilter === "ALL" || u.subject?.includes(subjectFilter);
      const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesDept && matchesSubject && matchesStatus;
    });
  }, [users, search, roleFilter, deptFilter, subjectFilter, statusFilter]);

  const getRoleBadge = (role: string) => {
    const found = PRIMARY_ROLES.find((r) => r.value === role);
    return found?.badge || "bg-slate-100 text-slate-800 border-slate-300";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. TOP CONSOLE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
              👑
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Super Admin Console
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#031635] dark:text-white">
            User Management &amp; Access Control
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl">
            Create, manage roles, departments, positions, contract durations, granular permissions, and resource scopes across all Atomic OPS teams.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/team/roles"
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-base">security</span>
            <span>Role Matrix</span>
          </Link>
          <Link
            href="/team/departments"
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-base">corporate_fare</span>
            <span>Departments</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsAdvancedModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-[#031635] dark:bg-purple-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>+ Add User</span>
          </button>
        </div>
      </div>

      {/* 2. STATS KPI CHIPS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Total Users", val: stats.totalUsers || 0, color: "text-[#031635] dark:text-white", icon: "group" },
          { label: "Active Users", val: stats.activeUsers || 0, color: "text-emerald-600", icon: "check_circle" },
          { label: "Teachers", val: stats.teachersCount || 0, color: "text-blue-600", icon: "school" },
          { label: "Content Creators", val: stats.contentCount || 0, color: "text-amber-600", icon: "edit_note" },
          { label: "SME Reviewers", val: stats.smeCount || 0, color: "text-indigo-600", icon: "verified" },
          { label: "Sales Team", val: stats.salesCount || 0, color: "text-cyan-600", icon: "trending_up" },
          { label: "Designers", val: stats.designerCount || 0, color: "text-pink-600", icon: "palette" },
          { label: "Video Editors", val: stats.videoCount || 0, color: "text-rose-600", icon: "movie" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex flex-col justify-between"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
              {s.label}
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-lg font-black ${s.color}`}>{s.val}</span>
              <span className="material-symbols-outlined text-slate-400 text-base">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. QUICK CREATE USER BAR (EXACT PATTERN FROM REFERENCE SCREENSHOT) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
          <h2 className="text-sm font-extrabold text-[#031635] dark:text-white uppercase tracking-wider">
            Quick User Creation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Instantly create a Teacher, Content Creator, SME, or Admin with default module permissions.
          </p>
        </div>

        <form onSubmit={handleQuickCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Name</label>
            <input
              type="text"
              placeholder="e.g. Mukul Kashyap"
              value={quickForm.name}
              onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
            <input
              type="email"
              placeholder="user@atomicops.com"
              value={quickForm.email}
              onChange={(e) => setQuickForm({ ...quickForm, email: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={quickForm.password}
              onChange={(e) => setQuickForm({ ...quickForm, password: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Role</label>
            <select
              value={quickForm.role}
              onChange={(e) => setQuickForm({ ...quickForm, role: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-slate-900 dark:text-white font-bold"
            >
              {PRIMARY_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Subject</label>
            <select
              value={quickForm.subject}
              onChange={(e) => setQuickForm({ ...quickForm, subject: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-slate-900 dark:text-white"
            >
              {SUBJECT_OPTIONS.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isCreatingQuick}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>{isCreatingQuick ? "Creating..." : "Create User"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. SEARCH & GRANULAR FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Search by Name, Email, or User ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-medium"
          >
            <option value="ALL">All Roles</option>
            {PRIMARY_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-medium"
          >
            <option value="ALL">All Departments</option>
            {catalog.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-medium"
          >
            <option value="ALL">All Subjects</option>
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-medium"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* 5. ENTERPRISE USERS DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Department &amp; Position</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading users database...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition group">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <Link href={`/team/users/${u.id}`} className="hover:text-blue-600 transition">
                          {u.name}
                        </Link>
                        {u.overridesCount > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-extrabold uppercase">
                            {u.overridesCount} Overrides
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[180px]">
                      {u.email}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${getRoleBadge(
                          u.role
                        )}`}
                      >
                        {u.role.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{u.position}</p>
                      <p className="text-[10px] text-slate-400">{u.department}</p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium">
                      {u.subject || "—"}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-700"
                            : "bg-rose-50 text-rose-700 hover:bg-emerald-50 hover:text-emerald-700"
                        } transition`}
                        title="Click to toggle status"
                      >
                        {u.status}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/team/users/${u.id}`}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-[11px] font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Details</span>
                        </Link>
                        <Link
                          href={`/team/users/${u.id}?tab=access`}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition flex items-center gap-1"
                          title="Permission Overrides"
                        >
                          <span className="material-symbols-outlined text-sm">tune</span>
                          <span>Matrix</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. ADVANCED ADD USER MODAL */}
      {isAdvancedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#031635] dark:text-white">
                  Add Enterprise User &amp; Granular RBAC
                </h3>
                <p className="text-xs text-slate-500">
                  Configure user identity, organizational position, contract dates, and scope restrictions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-black flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdvancedCreate} className="space-y-4 text-xs">
              {/* Section 1: Basic Details */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-blue-600">1. Identity Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Priya Sharma"
                      value={advForm.name}
                      onChange={(e) => setAdvForm({ ...advForm, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="priya@atomicpathshala.com"
                      value={advForm.email}
                      onChange={(e) => setAdvForm({ ...advForm, email: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={advForm.password}
                      onChange={(e) => setAdvForm({ ...advForm, password: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+91 9876543210"
                      value={advForm.phone}
                      onChange={(e) => setAdvForm({ ...advForm, phone: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Role, Department & Position */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-blue-600">2. Organization &amp; Role</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Role (Permission Tier) *</label>
                    <select
                      value={advForm.roleName}
                      onChange={(e) => setAdvForm({ ...advForm, roleName: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      {PRIMARY_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
                    <select
                      value={advForm.department}
                      onChange={(e) => setAdvForm({ ...advForm, department: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {catalog.departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Position / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Chemistry Faculty"
                      value={advForm.position}
                      onChange={(e) => setAdvForm({ ...advForm, position: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Subject & Batch Scoping */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-blue-600">3. Resource Scoping</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Primary Subject</label>
                    <select
                      value={advForm.subject}
                      onChange={(e) => setAdvForm({ ...advForm, subject: e.target.value, subjectScope: [e.target.value] })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {SUBJECT_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Batch Access Scope</label>
                    <select
                      value={advForm.batchScope[0] || "ALL"}
                      onChange={(e) => setAdvForm({ ...advForm, batchScope: [e.target.value] })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <option value="ALL">All Batches (Unrestricted)</option>
                      <option value="NEET_2027">NEET 2027 Batches Only</option>
                      <option value="JEE_2026">JEE 2026 Batches Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Contract Details */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-blue-600">4. Contract &amp; HR Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Contract Type</label>
                    <select
                      value={advForm.contractType}
                      onChange={(e) => setAdvForm({ ...advForm, contractType: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {catalog.contractTypes.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Start Date</label>
                    <input
                      type="date"
                      value={advForm.contractStart}
                      onChange={(e) => setAdvForm({ ...advForm, contractStart: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">End Date (Auto-Expiry)</label>
                    <input
                      type="date"
                      value={advForm.contractEnd}
                      onChange={(e) => setAdvForm({ ...advForm, contractEnd: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Contract Note</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Special agreement: Content review & live Doubt solving for NEET 2027"
                    value={advForm.contractNote}
                    onChange={(e) => setAdvForm({ ...advForm, contractNote: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdvancedModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#031635] text-white font-bold shadow-md hover:opacity-90"
                >
                  Create Enterprise User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
