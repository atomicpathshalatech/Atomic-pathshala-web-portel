"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { OpsBackButton } from "@/components/common/OpsBackButton";

export function DepartmentPositionManager() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // Add Position Form
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState("Academic");
  const [customDept, setCustomDept] = useState("");
  const [posName, setPosName] = useState("");
  const [defaultRole, setDefaultRole] = useState("TEACHER");
  const [description, setDescription] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/team/departments");
      if (!res.ok) throw new Error("Failed to load departments");
      const data = await res.json();
      setDepartments(data.departments || []);
      setPositions(data.positions || []);
      setGrouped(data.grouped || {});
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const dept = customDept.trim() || selectedDept;

    try {
      const res = await fetch("/api/team/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: dept,
          position: posName,
          defaultRole,
          description,
        }),
      });

      if (!res.ok) throw new Error("Failed to add position");
      toast.success(`Position "${posName}" added under ${dept}!`);
      setIsAddOpen(false);
      setPosName("");
      setCustomDept("");
      setDescription("");
      loadData();
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
            <span className="text-xs font-extrabold uppercase text-blue-600">Departments &amp; Positions</span>
          </div>
          <h1 className="text-2xl font-black text-[#031635] dark:text-white mt-1">
            Centralized Organization Catalog
          </h1>
          <p className="text-xs text-slate-500">
            Standardize job positions, departments, and default role suggestions across user creation and contract forms.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>+ Add Position</span>
        </button>
      </div>

      {/* 2. GROUPED DEPARTMENTS & POSITIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Object.entries(grouped).map(([dept, items]) => (
          <div
            key={dept}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-extrabold text-sm text-[#031635] dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black">
                    🏢
                  </span>
                  <span>{dept}</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{items.length} Positions</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {items.map((pos) => (
                  <div key={pos.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{pos.position}</p>
                      {pos.description && (
                        <p className="text-[10px] text-slate-400 line-clamp-1">{pos.description}</p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-bold">
                      {pos.defaultRole}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDept(dept);
                setIsAddOpen(true);
              }}
              className="w-full py-2 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 text-slate-500 hover:text-blue-600 text-xs font-bold transition flex items-center justify-center gap-1 mt-2"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Add to {dept}</span>
            </button>
          </div>
        ))}
      </div>

      {/* 3. ADD POSITION MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-extrabold text-base text-[#031635] dark:text-white">Add Organizational Position</h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-black flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPosition} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="__NEW__">+ New Department...</option>
                </select>

                {selectedDept === "__NEW__" && (
                  <input
                    type="text"
                    required
                    placeholder="Enter new department name..."
                    value={customDept}
                    onChange={(e) => setCustomDept(e.target.value)}
                    className="w-full mt-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Position / Designation Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Zoology Reviewer"
                  value={posName}
                  onChange={(e) => setPosName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Default Suggested Role *</label>
                <select
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  <option value="TEACHER">TEACHER</option>
                  <option value="CONTENT_CREATOR">CONTENT_CREATOR</option>
                  <option value="SME">SME</option>
                  <option value="SALES">SALES</option>
                  <option value="DESIGNER">DESIGNER</option>
                  <option value="VIDEO_EDITOR">VIDEO_EDITOR</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of responsibilities..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700"
                >
                  Save Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
