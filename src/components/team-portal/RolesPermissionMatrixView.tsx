"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS } from "@/lib/rbac/permissions";
import { PERMISSION_GROUPS as ALL_GROUPS } from "@/lib/rbac/permission-groups";
import { OpsBackButton } from "@/components/common/OpsBackButton";

export function RolesPermissionMatrixView() {
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("TEACHER");
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New Custom Role Modal
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/team/roles");
      if (!res.ok) throw new Error("Failed to load roles");
      const data = await res.json();
      setRoles(data.roles || []);
      const current = data.roles.find((r: any) => r.name === selectedRole);
      if (current) {
        setActivePermissions(current.permissions || []);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleRoleSelect = (roleName: string) => {
    setSelectedRole(roleName);
    const found = roles.find((r) => r.name === roleName);
    if (found) {
      setActivePermissions(found.permissions || []);
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

      if (!res.ok) throw new Error("Failed to save role permissions");
      toast.success(`Role permissions for ${selectedRole} saved successfully!`);
      loadRoles();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_ROLE",
          roleName: newRoleName.toUpperCase().replace(/\s+/g, "_"),
          label: newRoleLabel || newRoleName,
          description: newRoleDesc,
          permissions: activePermissions,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create role");
      }

      toast.success(`Custom Role "${newRoleLabel}" created!`);
      setIsAddRoleOpen(false);
      loadRoles();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
            Role Permission Matrix Configurator
          </h1>
          <p className="text-xs text-slate-500">
            Define granular action permissions for the 8 primary roles or configure custom organizational roles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddRoleOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">add_moderator</span>
            <span>+ Custom Role</span>
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

      {/* 2. ROLE SELECTOR CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {[
          "TEACHER",
          "SUPER_ADMIN",
          "ADMIN",
          "CONTENT_CREATOR",
          "SME",
          "SALES",
          "DESIGNER",
          "VIDEO_EDITOR",
        ].map((rName) => {
          const isSelected = selectedRole === rName;
          const roleObj = roles.find((r) => r.name === rName);

          return (
            <button
              key={rName}
              type="button"
              onClick={() => handleRoleSelect(rName)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition shrink-0 flex items-center gap-2 border ${
                isSelected
                  ? "bg-[#031635] text-white border-[#031635] shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300"
              }`}
            >
              <span>{rName.replace(/_/g, " ")}</span>
              {roleObj && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {roleObj.usersCount} users
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. VISUAL MATRIX GRID — every permission in the catalogue */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={permissionSearch}
            onChange={(e) => setPermissionSearch(e.target.value)}
            placeholder="Search a permission or area (e.g. live class, schedule, chapter)…"
            className="flex-1 min-w-[16rem] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
          <span className="text-xs text-slate-500">
            {activePermissions.length} of {ALL_GROUPS.reduce((n, g) => n + g.actions.length, 0)} permissions on
          </span>
        </div>
        {ALL_GROUPS.map((g) => {
          const q = permissionSearch.trim().toLowerCase();
          if (!q) return g;
          if (g.name.toLowerCase().includes(q)) return g;
          return { ...g, actions: g.actions.filter((a) => a.label.toLowerCase().includes(q) || a.code.includes(q)) };
        }).filter((g) => g.actions.length > 0).map((grp) => (
          <div
            key={grp.name}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-extrabold text-sm text-[#031635] dark:text-white uppercase tracking-wider">
                {grp.name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const codes = grp.actions.map((a) => a.code);
                    setActivePermissions(Array.from(new Set([...activePermissions, ...codes])));
                  }}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => {
                    const codes = new Set(grp.actions.map((a) => a.code));
                    setActivePermissions(activePermissions.filter((c) => !codes.has(c)));
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
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between text-xs transition ${
                      isChecked
                        ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs">{act.label}</p>
                      <p className="text-[9px] font-mono opacity-70 truncate max-w-[120px]">{act.code}</p>
                    </div>

                    <span className="material-symbols-outlined text-base">
                      {isChecked ? "check_box" : "check_box_outline_blank"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 4. ADD CUSTOM ROLE MODAL */}
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
                  placeholder="e.g. ACADEMIC_COORDINATOR"
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
                  placeholder="e.g. Academic Coordinator"
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
    </div>
  );
}
