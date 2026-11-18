"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS } from "@/lib/rbac/permissions";
import { PERMISSION_GROUPS as ALL_GROUPS } from "@/lib/rbac/permission-groups";
import { OpsBackButton } from "@/components/common/OpsBackButton";

interface RoleUser {
  id: string;
  name: string;
  email: string;
  status: string;
  photoUrl?: string | null;
  department?: string | null;
  position?: string | null;
}

interface RoleItem {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  usersCount: number;
  users?: RoleUser[];
  permissions: string[];
}

export function RolesPermissionMatrixView() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("CONTENT_GROWTH_EXECUTIVE");
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [isCloneRoleOpen, setIsCloneRoleOpen] = useState(false);
  const [isAssignUserOpen, setIsAssignUserOpen] = useState(false);

  // Form states
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const [editRoleLabel, setEditRoleLabel] = useState("");
  const [editRoleDesc, setEditRoleDesc] = useState("");

  const [cloneTargetName, setCloneTargetName] = useState("");
  const [cloneTargetLabel, setCloneTargetLabel] = useState("");
  const [cloneTargetDesc, setCloneTargetDesc] = useState("");

  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState("");

  const loadRoles = async (targetRoleToSelect?: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/team/roles");
      if (!res.ok) throw new Error("Failed to load roles");
      const data = await res.json();
      const loadedRoles: RoleItem[] = data.roles || [];
      setRoles(loadedRoles);
      setAssignableUsers(data.assignableUsers || []);

      const nextRole = targetRoleToSelect || selectedRole;
      const found = loadedRoles.find((r) => r.name === nextRole) || loadedRoles[0];
      if (found) {
        setSelectedRole(found.name);
        setActivePermissions(found.permissions || []);
        setEditRoleLabel(found.label);
        setEditRoleDesc(found.description || "");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles("CONTENT_GROWTH_EXECUTIVE");
  }, []);

  const handleRoleSelect = (roleName: string) => {
    setSelectedRole(roleName);
    const found = roles.find((r) => r.name === roleName);
    if (found) {
      setActivePermissions(found.permissions || []);
      setEditRoleLabel(found.label);
      setEditRoleDesc(found.description || "");
    }
  };

  const handleTogglePermission = (code: string) => {
    if (activePermissions.includes(code)) {
      setActivePermissions(activePermissions.filter((c) => c !== code));
    } else {
      setActivePermissions([...activePermissions, code]);
    }
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PERMISSIONS",
          roleName: selectedRole,
          permissions: activePermissions,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save role permissions");
      }
      toast.success(`Role permissions for ${selectedRole} saved successfully!`);
      await loadRoles(selectedRole);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanName = newRoleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_ROLE",
          roleName: cleanName,
          label: newRoleLabel.trim() || cleanName.replace(/_/g, " "),
          description: newRoleDesc.trim(),
          permissions: activePermissions,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create role");
      }

      toast.success(`Custom Role "${newRoleLabel}" created!`);
      setIsAddRoleOpen(false);
      setNewRoleName("");
      setNewRoleLabel("");
      setNewRoleDesc("");
      await loadRoles(cleanName);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateRoleDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_ROLE",
          roleName: selectedRole,
          label: editRoleLabel.trim(),
          description: editRoleDesc.trim(),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update role details");
      }

      toast.success(`Role details for "${editRoleLabel}" updated!`);
      setIsEditRoleOpen(false);
      await loadRoles(selectedRole);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCloneRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanTarget = cloneTargetName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLONE_ROLE",
          sourceRoleName: selectedRole,
          targetRoleName: cleanTarget,
          label: cloneTargetLabel.trim() || cleanTarget.replace(/_/g, " "),
          description: cloneTargetDesc.trim(),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to clone role");
      }

      toast.success(`Role cloned to "${cloneTargetLabel}" successfully!`);
      setIsCloneRoleOpen(false);
      setCloneTargetName("");
      setCloneTargetLabel("");
      setCloneTargetDesc("");
      await loadRoles(cleanTarget);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserIdToAssign) {
      toast.error("Please select a team member.");
      return;
    }
    try {
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN_USER_ROLE",
          userId: selectedUserIdToAssign,
          roleName: selectedRole,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to assign role");
      }

      toast.success("Team member assigned to role!");
      setIsAssignUserOpen(false);
      setSelectedUserIdToAssign("");
      await loadRoles(selectedRole);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveUserFromRole = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName} from this role? Their staff access will be revoked immediately.`)) {
      return;
    }
    try {
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REMOVE_USER_ROLE",
          userId,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to remove user from role");
      }

      toast.success(`${userName} removed from role. Access revoked immediately.`);
      await loadRoles(selectedRole);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const currentRoleObj = roles.find((r) => r.name === selectedRole);

  const totalAllPermissions = ALL_GROUPS.reduce((n, g) => n + g.actions.length, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <OpsBackButton href="/team/users" label="Back to Users" />
            <span className="text-slate-300">/</span>
            <span className="text-xs font-extrabold uppercase text-blue-600">Roles &amp; Permissions</span>
          </div>
          <h1 className="text-2xl font-black text-[#031635] dark:text-white mt-1">
            Custom Role Builder &amp; Permission Matrix
          </h1>
          <p className="text-xs text-slate-500">
            Configure system roles, create custom organizational roles, clone roles, and manage granular permissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddRoleOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add_moderator</span>
            <span>+ Create Custom Role</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCloneTargetName(`${selectedRole}_CUSTOM`);
              setCloneTargetLabel(`${currentRoleObj?.label || selectedRole} (Copy)`);
              setCloneTargetDesc(currentRoleObj?.description || "");
              setIsCloneRoleOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-purple-300 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-base">content_copy</span>
            <span>Clone Role</span>
          </button>
          <button
            type="button"
            onClick={handleSavePermissions}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">save</span>
            <span>{saving ? "Saving..." : "Save Role Matrix"}</span>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC ROLE SELECTOR CHIPS */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Select Role to Configure ({roles.length} Roles Registered)
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {roles.map((r) => {
            const isSelected = selectedRole === r.name;
            const isFeatured = r.name === "CONTENT_GROWTH_EXECUTIVE";

            return (
              <button
                key={r.id || r.name}
                type="button"
                onClick={() => handleRoleSelect(r.name)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition shrink-0 flex items-center gap-2 border ${
                  isSelected
                    ? "bg-[#031635] text-white border-[#031635] shadow-md"
                    : isFeatured
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 hover:border-blue-400"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300"
                }`}
              >
                <span>{r.label || r.name.replace(/_/g, " ")}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {r.usersCount} users
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CURRENT ROLE DETAIL CARD & MEMBERS ASSIGNMENT */}
      {currentRoleObj && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-[#031635] dark:text-white">
                  {currentRoleObj.label}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  {currentRoleObj.name}
                </span>
                {currentRoleObj.isSystem ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    System Role
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Custom Role
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {currentRoleObj.description || "No description provided for this role."}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditRoleLabel(currentRoleObj.label);
                  setEditRoleDesc(currentRoleObj.description || "");
                  setIsEditRoleOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-blue-600 hover:border-blue-300 transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Edit Details</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAssignUserOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                <span>+ Assign Member</span>
              </button>
            </div>
          </div>

          {/* Members in this role */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Assigned Employees / Members ({currentRoleObj.users?.length || 0}):
              </span>
            </div>
            {currentRoleObj.users && currentRoleObj.users.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {currentRoleObj.users.map((u) => (
                  <div
                    key={u.id}
                    className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                        {u.name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveUserFromRole(u.id, u.name)}
                      className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center shrink-0 transition"
                      title="Revoke access immediately (Remove Role)"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No members currently assigned to this role. Click &quot;+ Assign Member&quot; to assign staff.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. VISUAL MATRIX GRID — granular permissions grouped by module */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex-1 min-w-[16rem]">
            <input
              type="search"
              value={permissionSearch}
              onChange={(e) => setPermissionSearch(e.target.value)}
              placeholder="Search permission or module (e.g. media, youtube, social, campaign, batches)…"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900">
              {activePermissions.length} of {totalAllPermissions} permissions granted
            </span>
            <button
              type="button"
              onClick={() => {
                const allCodes = ALL_GROUPS.flatMap((g) => g.actions.map((a) => a.code));
                setActivePermissions(Array.from(new Set(allCodes)));
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => setActivePermissions([])}
              className="text-xs font-bold text-slate-400 hover:text-rose-600"
            >
              Clear All
            </button>
          </div>
        </div>

        {ALL_GROUPS.map((g) => {
          const q = permissionSearch.trim().toLowerCase();
          if (!q) return g;
          if (g.name.toLowerCase().includes(q)) return g;
          return { ...g, actions: g.actions.filter((a) => a.label.toLowerCase().includes(q) || a.code.includes(q)) };
        }).filter((g) => g.actions.length > 0).map((grp) => {
          const groupCodes = grp.actions.map((a) => a.code);
          const allInGroupChecked = groupCodes.every((c) => activePermissions.includes(c));

          return (
            <div
              key={grp.name}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-[#031635] dark:text-white uppercase tracking-wider">
                    {grp.name}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    ({grp.actions.filter((a) => activePermissions.includes(a.code)).length}/{grp.actions.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePermissions(Array.from(new Set([...activePermissions, ...groupCodes])));
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const setCodes = new Set(groupCodes);
                      setActivePermissions(activePermissions.filter((c) => !setCodes.has(c)));
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {grp.actions.map((act) => {
                  const isChecked = activePermissions.includes(act.code);

                  return (
                    <button
                      key={act.code}
                      type="button"
                      onClick={() => handleTogglePermission(act.code)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between text-xs transition cursor-pointer ${
                        isChecked
                          ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-xs truncate">{act.label}</p>
                        <p className="text-[9px] font-mono opacity-70 truncate">{act.code}</p>
                      </div>

                      <span className="material-symbols-outlined text-base shrink-0">
                        {isChecked ? "check_box" : "check_box_outline_blank"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. CREATE CUSTOM ROLE MODAL */}
      {isAddRoleOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-extrabold text-base text-[#031635] dark:text-white">Create Custom Role</h3>
              <button
                type="button"
                onClick={() => setIsAddRoleOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-black flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Role Identifier (Unique Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MARKETING_COORDINATOR"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 uppercase font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Display Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marketing Coordinator"
                  value={newRoleLabel}
                  onChange={(e) => setNewRoleLabel(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Responsibilities, scope of authority, and access tier..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddRoleOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT ROLE DETAILS MODAL */}
      {isEditRoleOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-extrabold text-base text-[#031635] dark:text-white">Edit Role Details</h3>
              <button
                type="button"
                onClick={() => setIsEditRoleOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-black flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRoleDetails} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Role Identifier</label>
                <input
                  type="text"
                  disabled
                  value={selectedRole}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 uppercase font-mono opacity-60"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Display Label *</label>
                <input
                  type="text"
                  required
                  value={editRoleLabel}
                  onChange={(e) => setEditRoleLabel(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={3}
                  value={editRoleDesc}
                  onChange={(e) => setEditRoleDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditRoleOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700"
                >
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. CLONE ROLE MODAL */}
      {isCloneRoleOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <h3 className="font-extrabold text-base text-[#031635] dark:text-white">Clone Role</h3>
                <p className="text-[11px] text-slate-500">Source: {selectedRole}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCloneRoleOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-black flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCloneRole} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">New Role Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MARKETING_OFFICER"
                  value={cloneTargetName}
                  onChange={(e) => setCloneTargetName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 uppercase font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Display Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marketing Officer"
                  value={cloneTargetLabel}
                  onChange={(e) => setCloneTargetLabel(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={cloneTargetDesc}
                  onChange={(e) => setCloneTargetDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCloneRoleOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700"
                >
                  Clone Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. ASSIGN USER MODAL */}
      {isAssignUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <h3 className="font-extrabold text-base text-[#031635] dark:text-white">Assign Member to Role</h3>
                <p className="text-[11px] text-blue-600 font-bold">{currentRoleObj?.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignUserOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-black flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignUser} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Select Team Member *</label>
                <select
                  required
                  value={selectedUserIdToAssign}
                  onChange={(e) => setSelectedUserIdToAssign(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="">-- Choose employee / staff --</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) — Current: {u.role?.label || "No Role"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-300 text-[11px]">
                <p className="font-bold">Immediate Effect:</p>
                <p>The selected user will immediately acquire all active permissions of this role.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignUserOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700"
                >
                  Assign Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
