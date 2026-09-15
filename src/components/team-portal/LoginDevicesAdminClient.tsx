"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface DeviceItem {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceCategory: "DESKTOP" | "TABLET" | "MOBILE";
  deviceType: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  isBlocked: boolean;
  lastActiveAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
}

interface UserDeviceItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  role: string;
  lastLoginAt: string | null;
  allowedDeviceTypes: string[];
  maxActiveDevices: number;
  activeDeviceCount: number;
  desktopCount: number;
  tabletCount: number;
  mobileCount: number;
  devices: DeviceItem[];
}

interface Stats {
  totalActiveSessions: number;
  desktopCount: number;
  tabletCount: number;
  mobileCount: number;
  totalBlocked: number;
}

export function LoginDevicesAdminClient() {
  const [stats, setStats] = useState<Stats>({
    totalActiveSessions: 0,
    desktopCount: 0,
    tabletCount: 0,
    mobileCount: 0,
    totalBlocked: 0,
  });
  const [users, setUsers] = useState<UserDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Drawer / Selected User State
  const [selectedUser, setSelectedUser] = useState<UserDeviceItem | null>(null);
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
  const [maxDevices, setMaxDevices] = useState<number>(3);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function fetchDevicesData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/team/security/devices?${params.toString()}`);
      const body = await res.json();
      if (body.success) {
        setStats(body.data.stats);
        setUsers(body.data.users);
      } else {
        toast.error(body.error || "Failed to load device sessions");
      }
    } catch {
      toast.error("Network error while loading devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDevicesData();
  }, [categoryFilter]);

  function openUserDrawer(u: UserDeviceItem) {
    setSelectedUser(u);
    setAllowedCategories(u.allowedDeviceTypes || ["DESKTOP", "TABLET", "MOBILE"]);
    setMaxDevices(u.maxActiveDevices || 3);
  }

  async function saveUserPolicy() {
    if (!selectedUser) return;
    setSavingPolicy(true);
    try {
      const res = await fetch(`/api/team/security/devices/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedDeviceTypes: allowedCategories,
          maxActiveDevices: maxDevices,
        }),
      });
      const body = await res.json();
      if (body.success) {
        toast.success("User device permissions updated successfully");
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? { ...u, allowedDeviceTypes: allowedCategories, maxActiveDevices: maxDevices }
              : u
          )
        );
        setSelectedUser((prev) =>
          prev ? { ...prev, allowedDeviceTypes: allowedCategories, maxActiveDevices: maxDevices } : null
        );
      } else {
        toast.error(body.error || "Failed to update permissions");
      }
    } catch {
      toast.error("Failed to save device policy");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleDeviceAction(sessionId: string, action: "LOGOUT" | "BLOCK" | "ALLOW" | "REMOVE") {
    setActionLoadingId(sessionId);
    try {
      if (action === "LOGOUT" || action === "REMOVE") {
        const res = await fetch(
          `/api/team/security/devices/session/${sessionId}${action === "REMOVE" ? "?remove=true" : ""}`,
          { method: "DELETE" }
        );
        const body = await res.json();
        if (body.success) {
          toast.success(action === "REMOVE" ? "Device removed" : "Device logged out");
          refreshUserSessionState(sessionId, action);
        } else {
          toast.error(body.error || "Action failed");
        }
      } else if (action === "BLOCK" || action === "ALLOW") {
        const res = await fetch(`/api/team/security/devices/session/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const body = await res.json();
        if (body.success) {
          toast.success(action === "BLOCK" ? "Device blocked" : "Device unblocked and allowed");
          refreshUserSessionState(sessionId, action);
        } else {
          toast.error(body.error || "Action failed");
        }
      }
    } catch {
      toast.error("Failed to execute action");
    } finally {
      setActionLoadingId(null);
    }
  }

  function refreshUserSessionState(sessionId: string, action: string) {
    if (!selectedUser) return;
    const now = new Date().toISOString();

    const updatedDevices = selectedUser.devices
      .map((d) => {
        if (d.id === sessionId) {
          if (action === "LOGOUT") {
            return { ...d, revokedAt: now, revokedReason: "ADMIN_REVOKED" };
          }
          if (action === "BLOCK") {
            return { ...d, isBlocked: true, revokedAt: d.revokedAt || now, revokedReason: "ADMIN_BLOCKED" };
          }
          if (action === "ALLOW") {
            return { ...d, isBlocked: false, revokedAt: null, revokedReason: null };
          }
        }
        return d;
      })
      .filter((d) => (action === "REMOVE" ? d.id !== sessionId : true));

    const activeCount = updatedDevices.filter((d) => !d.revokedAt).length;

    setSelectedUser({
      ...selectedUser,
      activeDeviceCount: activeCount,
      devices: updatedDevices,
    });

    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              activeDeviceCount: activeCount,
              devices: updatedDevices,
            }
          : u
      )
    );
  }

  async function logoutAllForUser(userId: string) {
    if (!confirm("Are you sure you want to sign out this user from ALL active devices?")) return;
    try {
      const res = await fetch(`/api/team/security/devices/${userId}/logout-all`, {
        method: "POST",
      });
      const body = await res.json();
      if (body.success) {
        toast.success(`All ${body.data.count || 0} active devices signed out`);
        fetchDevicesData();
        if (selectedUser?.id === userId) {
          setSelectedUser((prev) =>
            prev
              ? {
                  ...prev,
                  activeDeviceCount: 0,
                  devices: prev.devices.map((d) => ({
                    ...d,
                    revokedAt: d.revokedAt || new Date().toISOString(),
                    revokedReason: "ADMIN_LOGOUT_ALL",
                  })),
                }
              : null
          );
        }
      } else {
        toast.error(body.error || "Failed to logout devices");
      }
    } catch {
      toast.error("Failed to execute logout all");
    }
  }

  function toggleCategory(cat: string) {
    setAllowedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Devices</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalActiveSessions}
          </div>
          <div className="text-xs text-teal-600 font-medium mt-1">Total Online Sessions</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Laptops / Desktops</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.desktopCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Windows, Mac, Linux</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tablets</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.tabletCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">iPad & Android Tablets</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Mobile Phones</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.mobileCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Android, iOS, App</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Blocked Devices</div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {stats.totalBlocked}
          </div>
          <div className="text-xs text-rose-500 font-medium mt-1">Security Restricted</div>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDevicesData();
          }}
          className="flex-1 min-w-[280px] max-w-md relative"
        >
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student/staff name, email, phone..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
          />
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Category:</span>
          {(["", "DESKTOP", "TABLET", "MOBILE"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                categoryFilter === cat
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat === ""
                ? "All Devices"
                : cat === "DESKTOP"
                ? "💻 Laptop"
                : cat === "TABLET"
                ? "📱 Tablet"
                : "📱 Mobile"}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl animate-spin text-teal-600 mb-2">
              progress_activity
            </span>
            <p className="text-sm font-medium">Loading user device sessions...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-2">
              devices_off
            </span>
            <p className="font-bold text-slate-800 dark:text-slate-200">No Users or Devices Found</p>
            <p className="text-xs text-slate-500 mt-1">Try changing your search term or category filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Active Devices</th>
                  <th className="px-5 py-3.5">Allowed Categories</th>
                  <th className="px-5 py-3.5">Last Active</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{u.email}</div>
                      {u.phone && <div className="text-[11px] text-slate-400">{u.phone}</div>}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {u.role}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            u.activeDeviceCount > 0
                              ? "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          {u.activeDeviceCount} / {u.maxActiveDevices} Active
                        </span>

                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          {u.desktopCount > 0 && <span title="Laptop active">💻{u.desktopCount}</span>}
                          {u.tabletCount > 0 && <span title="Tablet active">📱{u.tabletCount}</span>}
                          {u.mobileCount > 0 && <span title="Mobile active">📲{u.mobileCount}</span>}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {["DESKTOP", "TABLET", "MOBILE"].map((cat) => {
                          const allowed = u.allowedDeviceTypes?.includes(cat);
                          return (
                            <span
                              key={cat}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                allowed
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 line-through"
                              }`}
                            >
                              {cat === "DESKTOP" ? "Laptop" : cat === "TABLET" ? "Tablet" : "Mobile"}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Never"}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => openUserDrawer(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 transition"
                      >
                        <span className="material-symbols-outlined text-sm">devices</span>
                        Manage Devices
                      </button>

                      {u.activeDeviceCount > 0 && (
                        <button
                          onClick={() => logoutAllForUser(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Logout all devices for this user"
                        >
                          <span className="material-symbols-outlined text-sm">logout</span>
                          Logout All
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Device Management Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/80 text-teal-600 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined">devices</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {selectedUser.name} &bull; Login Devices
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedUser.email} &bull; {selectedUser.role} (ID: {selectedUser.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Category Permissions & Limit Controls */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Allowed Device Categories & Limit
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure which device types this user can use to log in.
                    </p>
                  </div>
                  <button
                    onClick={saveUserPolicy}
                    disabled={savingPolicy}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition disabled:opacity-50"
                  >
                    {savingPolicy ? "Saving..." : "Save Policy"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "DESKTOP", label: "Laptop / Desktop", icon: "computer", desc: "Windows, Mac, Linux" },
                    { id: "TABLET", label: "Tablet / iPad", icon: "tablet_mac", desc: "iPadOS & Tablets" },
                    { id: "MOBILE", label: "Mobile Phone", icon: "smartphone", desc: "Android, iOS, App" },
                  ].map((cat) => {
                    const isAllowed = allowedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                          isAllowed
                            ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500/40 text-teal-900 dark:text-teal-200"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 opacity-60"
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg mt-0.5">
                          {isAllowed ? "check_box" : "check_box_outline_blank"}
                        </span>
                        <div>
                          <div className="font-bold text-xs">{cat.label}</div>
                          <div className="text-[11px] opacity-80 mt-0.5">{cat.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Maximum Active Devices:
                  </label>
                  <select
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(Number(e.target.value))}
                    className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={1}>1 Device</option>
                    <option value={2}>2 Devices</option>
                    <option value={3}>3 Devices (Standard: 1 Laptop + 1 Tablet + 1 Mobile)</option>
                    <option value={4}>4 Devices</option>
                    <option value={5}>5 Devices</option>
                  </select>
                </div>
              </div>

              {/* Registered Devices List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Registered & Active Devices ({selectedUser.devices.length})
                  </h4>
                  {selectedUser.activeDeviceCount > 0 && (
                    <button
                      onClick={() => logoutAllForUser(selectedUser.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      Logout All Devices
                    </button>
                  )}
                </div>

                {selectedUser.devices.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    No devices registered for this user yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedUser.devices.map((device) => {
                      const isActive = !device.revokedAt && !device.isBlocked;
                      const isLoading = actionLoadingId === device.id;
                      return (
                        <div
                          key={device.id}
                          className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            device.isBlocked
                              ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                              : isActive
                              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-400"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="material-symbols-outlined text-2xl text-teal-600 dark:text-teal-400 mt-1">
                              {device.deviceCategory === "MOBILE"
                                ? "smartphone"
                                : device.deviceCategory === "TABLET"
                                ? "tablet_mac"
                                : "computer"}
                            </span>

                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{device.deviceName || `${device.os} (${device.browser})`}</span>
                                {isActive && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-500/20">
                                    ACTIVE
                                  </span>
                                )}
                                {device.isBlocked && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950 text-rose-600 border border-rose-500/20">
                                    BLOCKED
                                  </span>
                                )}
                                {device.revokedAt && !device.isBlocked && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500">
                                    {device.revokedReason || "LOGGED OUT"}
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>OS: {device.os || "Unknown"}</span>
                                <span>&bull;</span>
                                <span>Browser: {device.browser || "Unknown"}</span>
                                {device.ipAddress && (
                                  <>
                                    <span>&bull;</span>
                                    <span>IP: {device.ipAddress}</span>
                                  </>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                                <span>
                                  First login:{" "}
                                  {new Date(device.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <span>&bull;</span>
                                <span>
                                  Last active:{" "}
                                  {new Date(device.lastActiveAt).toLocaleString("en-IN", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {isActive && (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleDeviceAction(device.id, "LOGOUT")}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition disabled:opacity-50"
                              >
                                {isLoading ? "..." : "Logout"}
                              </button>
                            )}

                            {device.isBlocked ? (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleDeviceAction(device.id, "ALLOW")}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 transition disabled:opacity-50"
                              >
                                {isLoading ? "..." : "Unblock"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleDeviceAction(device.id, "BLOCK")}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 transition disabled:opacity-50"
                              >
                                {isLoading ? "..." : "Block"}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => {
                                if (confirm("Remove this device registration to free up category slot?")) {
                                  handleDeviceAction(device.id, "REMOVE");
                                }
                              }}
                              className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-rose-500 transition disabled:opacity-50"
                              title="Remove device registration"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
