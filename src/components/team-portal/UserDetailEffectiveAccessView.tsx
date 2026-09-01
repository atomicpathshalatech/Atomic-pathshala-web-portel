"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const MODULES_MATRIX = [
  {
    module: "Question Bank",
    description: "Question authoring, OCR, AI solutions, verification & approvals",
    actions: [
      { code: "question.read", label: "View" },
      { code: "question.create", label: "Create" },
      { code: "question.update", label: "Edit" },
      { code: "question.delete", label: "Delete" },
      { code: "question.verify", label: "Verify" },
      { code: "question.approve", label: "Approve" },
      { code: "question.reject", label: "Reject" },
      { code: "question.import", label: "Import" },
      { code: "question.export", label: "Export" },
    ],
  },
  {
    module: "Test Portal",
    description: "Mock test creation, section authoring, blueprint rules & publishing",
    actions: [
      { code: "test.read", label: "View" },
      { code: "test.create", label: "Create" },
      { code: "test.update", label: "Edit" },
      { code: "test.delete", label: "Delete" },
      { code: "test.publish", label: "Publish" },
      { code: "test.approve", label: "Approve" },
      { code: "test.reject", label: "Reject" },
      { code: "test.export", label: "Export" },
      { code: "test.import", label: "Import" },
    ],
  },
  {
    module: "DPP (Daily Practice Problems)",
    description: "DPP sheet creation, assignment to lectures, solution review",
    actions: [
      { code: "dpp.read", label: "View" },
      { code: "dpp.create", label: "Create" },
      { code: "dpp.update", label: "Edit" },
      { code: "dpp.delete", label: "Delete" },
      { code: "dpp.publish", label: "Publish" },
      { code: "dpp.approve", label: "Approve" },
      { code: "dpp.reject", label: "Reject" },
    ],
  },
  {
    module: "Doubt Desk",
    description: "Student doubt answering, OCR handwritten solving, academic review",
    actions: [
      { code: "doubt.read", label: "View" },
      { code: "doubt.resolve", label: "Solve" },
      { code: "doubt.review", label: "Review" },
    ],
  },
  {
    module: "Batches & Courses",
    description: "Batch roadmap, subject chapters, student enrollments, timetable",
    actions: [
      { code: "batch.read", label: "View" },
      { code: "batch.create", label: "Create" },
      { code: "batch.update", label: "Edit" },
      { code: "batch.delete", label: "Delete" },
      { code: "batch.enrollment.manage", label: "Enrollments" },
      { code: "batch.schedule.manage", label: "Schedule" },
    ],
  },
  {
    module: "Design Studio",
    description: "Thumbnails, course artwork, chapter creatives, branding assets",
    actions: [
      { code: "design.read", label: "View" },
      { code: "design.create", label: "Create" },
      { code: "design.update", label: "Edit" },
      { code: "design.delete", label: "Delete" },
      { code: "design.publish", label: "Publish" },
      { code: "design.asset.upload", label: "Upload" },
    ],
  },
  {
    module: "Video Production",
    description: "Lecture recordings, video editing projects, preview & encoding",
    actions: [
      { code: "video.read", label: "View" },
      { code: "video.create", label: "Create" },
      { code: "video.update", label: "Edit" },
      { code: "video.delete", label: "Delete" },
      { code: "video.publish", label: "Publish" },
      { code: "video.upload", label: "Upload" },
    ],
  },
  {
    module: "CRM & Sales",
    description: "Student leads, counselor assignment, pipeline, sales analytics",
    actions: [
      { code: "crm.lead.read", label: "View Leads" },
      { code: "crm.lead.create", label: "Add Lead" },
      { code: "crm.lead.assign", label: "Assign" },
      { code: "crm.lead.update", label: "Update" },
      { code: "crm.lead.delete", label: "Delete" },
      { code: "crm.sales.report.view", label: "Reports" },
    ],
  },
  {
    module: "Administration & RBAC",
    description: "User accounts, role assignments, department catalog, audit trails",
    actions: [
      { code: "admin.user.read", label: "View Users" },
      { code: "admin.user.create", label: "Create User" },
      { code: "admin.user.update", label: "Edit User" },
      { code: "admin.user.delete", label: "Delete User" },
      { code: "admin.user.status", label: "Status" },
      { code: "admin.user.permission.override", label: "Overrides" },
      { code: "admin.role.manage", label: "Role Matrix" },
      { code: "admin.department.manage", label: "Departments" },
      { code: "admin.audit.view", label: "Audit Logs" },
    ],
  },
];

export function UserDetailEffectiveAccessView({ userId }: { userId: string }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"effective" | "overrides" | "professional" | "scoping" | "audit">("effective");

  // Edit form state
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editContractType, setEditContractType] = useState("");
  const [editContractEnd, setEditContractEnd] = useState("");
  const [editContractNote, setEditContractNote] = useState("");

  const loadUser = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/users/${userId}`);
      if (!res.ok) throw new Error("Failed to load user details");
      const data = await res.json();
      setUser(data.user);
      setEditRole(data.user.role);
      setEditStatus(data.user.status);
      setEditDept(data.user.department || "Academic");
      setEditPosition(data.user.position || "Staff");
      setEditContractType(data.user.contractType || "FULL_TIME");
      setEditContractEnd(data.user.contractEnd ? data.user.contractEnd.split("T")[0] : "");
      setEditContractNote(data.user.contractNote || "");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [userId]);

  // Handle User-Level Permission Override Toggle
  const handleToggleOverride = async (permissionCode: string, currentGranted: boolean | undefined) => {
    try {
      let nextGranted = true;
      let action: string | undefined = undefined;

      if (currentGranted === true) {
        nextGranted = false; // Deny
      } else if (currentGranted === false) {
        action = "RESET"; // Reset to default
      } else {
        nextGranted = true; // Explicit Grant
      }

      const res = await fetch(`/api/team/users/${userId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissionCode,
          granted: nextGranted,
          action,
          reason: `Admin configured override from user access matrix`,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update override");
      }

      toast.success(`Permission ${permissionCode} override updated!`);
      loadUser();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Save Professional / Role Changes
  const handleSaveProfile = async () => {
    try {
      const res = await fetch(`/api/team/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleName: editRole,
          status: editStatus,
          department: editDept,
          position: editPosition,
          contractType: editContractType,
          contractEnd: editContractEnd || null,
          contractNote: editContractNote,
        }),
      });

      if (!res.ok) throw new Error("Failed to save changes");
      toast.success("User profile & permissions updated!");
      loadUser();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading || !user) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
        Loading user effective permissions...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. HEADER BREADCRUMB & USER IDENTITY CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/team/users" className="hover:text-blue-600 font-bold transition flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>All Users</span>
            </Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-mono">{user.id}</span>
          </p>

          <span
            className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
              user.status === "ACTIVE"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-rose-100 text-rose-800 border border-rose-300"
            }`}
          >
            {user.status}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 text-white font-black text-xl flex items-center justify-center shadow-md">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#031635] dark:text-white">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs font-mono text-slate-500">{user.email}</span>
                <span className="text-slate-300">•</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold">
                  {user.role.replace(/_/g, " ")}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-semibold">{user.position}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">{user.department}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveProfile}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>Save Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { key: "effective", label: "Effective Access Matrix", icon: "security" },
          { key: "overrides", label: "Permission Overrides", icon: "tune" },
          { key: "professional", label: "Professional & Contract", icon: "badge" },
          { key: "scoping", label: "Resource Scoping", icon: "filter_alt" },
          { key: "audit", label: "Audit Trail", icon: "history" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-[#031635] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 3. TAB 1: EFFECTIVE ACCESS MATRIX */}
      {activeTab === "effective" && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 text-lg shrink-0">info</span>
            <div>
              <p className="font-bold">Effective Access Formula</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5 leading-relaxed">
                Final Permission = <strong>Role Permissions</strong> + <strong>User Overrides</strong> + <strong>Subject Scope ({user.subjectScope.join(", ") || "All"})</strong> + <strong>Batch Scope ({user.batchScope.join(", ") || "All"})</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {MODULES_MATRIX.map((mod) => (
              <div
                key={mod.module}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#031635] dark:text-white">{mod.module}</h3>
                    <p className="text-[11px] text-slate-500">{mod.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {mod.actions.map((act) => {
                    const isGranted = user.effectivePermissions[act.code];
                    const override = user.overrides?.find((o: any) => o.permissionCode === act.code);

                    return (
                      <div
                        key={act.code}
                        className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition ${
                          isGranted
                            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                            : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs">{act.label}</p>
                          <p className="text-[9px] font-mono opacity-70 truncate max-w-[120px]">{act.code}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          {override && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                override.granted ? "bg-purple-200 text-purple-800" : "bg-rose-200 text-rose-800"
                              }`}
                              title={override.reason || "Override applied"}
                            >
                              Override
                            </span>
                          )}
                          <span className="material-symbols-outlined text-base">
                            {isGranted ? "check_circle" : "cancel"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TAB 2: PERMISSION OVERRIDES */}
      {activeTab === "overrides" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-[#031635] dark:text-white uppercase tracking-wider">
              Configure Explicit User Overrides
            </h3>
            <p className="text-xs text-slate-500">
              Grant or deny specific action permissions for this individual user without changing their primary role.
            </p>
          </div>

          <div className="space-y-6">
            {MODULES_MATRIX.map((mod) => (
              <div key={mod.module} className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{mod.module}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {mod.actions.map((act) => {
                    const isEffective = user.effectivePermissions[act.code];
                    const override = user.overrides?.find((o: any) => o.permissionCode === act.code);

                    return (
                      <div
                        key={act.code}
                        className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{act.label}</p>
                          <p className="text-[9px] font-mono text-slate-400">{act.code}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleOverride(act.code, override ? override.granted : undefined)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                              override?.granted === true
                                ? "bg-purple-600 text-white"
                                : override?.granted === false
                                ? "bg-rose-600 text-white"
                                : isEffective
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {override?.granted === true
                              ? "Granted (Override)"
                              : override?.granted === false
                              ? "Denied (Override)"
                              : isEffective
                              ? "Role Granted"
                              : "Role Denied"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB 3: PROFESSIONAL & CONTRACT DETAILS */}
      {activeTab === "professional" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-[#031635] dark:text-white uppercase tracking-wider">
              Professional &amp; Contract Information
            </h3>
            <p className="text-xs text-slate-500">
              Manage department assignment, position designation, and employment contract parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
              <input
                type="text"
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Position / Designation</label>
              <input
                type="text"
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Contract Type</label>
              <select
                value={editContractType}
                onChange={(e) => setEditContractType(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="CONSULTANT">Consultant</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="TEMPORARY">Temporary</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Contract End Date (Auto-Expiry)</label>
              <input
                type="date"
                value={editContractEnd}
                onChange={(e) => setEditContractEnd(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 dark:text-slate-300">Contract Note</label>
              <textarea
                rows={3}
                value={editContractNote}
                onChange={(e) => setEditContractNote(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                placeholder="Details of agreement, scope of responsibilities, hourly rate, or special terms..."
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: RESOURCE SCOPING */}
      {activeTab === "scoping" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 text-xs">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-[#031635] dark:text-white uppercase tracking-wider">
              Subject &amp; Batch Resource Scope
            </h3>
            <p className="text-xs text-slate-500">
              Restrict teacher or SME content permissions to their assigned subjects and active batches.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Assigned Subjects</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {["Physics", "Chemistry", "Biology", "Mathematics", "Botany", "Zoology"].map((sub) => {
                  const isChecked = user.subjectScope.includes(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={async () => {
                        const newScope = isChecked
                          ? user.subjectScope.filter((s: string) => s !== sub)
                          : [...user.subjectScope, sub];
                        await fetch(`/api/team/users/${userId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ subjectScope: newScope }),
                        });
                        toast.success("Subject scope updated!");
                        loadUser();
                      }}
                      className={`px-3 py-1.5 rounded-xl border font-bold transition ${
                        isChecked
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-600"
                      }`}
                    >
                      {sub} {isChecked ? "✓" : "+"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="font-bold text-slate-700 dark:text-slate-300">Batch Scope</label>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Currently assigned: <strong>{user.batchScope.join(", ") || "All Batches (Unrestricted)"}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 5: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-[#031635] dark:text-white uppercase tracking-wider">
              User Audit Log &amp; Security Trail
            </h3>
            <p className="text-xs text-slate-500">
              Immutable historical record of every role change, permission override, and status update for this user.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {user.auditLogs?.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">No audit log records found.</p>
            ) : (
              user.auditLogs?.map((log: any) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-blue-600">{log.action}</span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                      {JSON.stringify(log.metadata || {})}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
