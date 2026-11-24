"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  SimulationResult,
  ComparisonResult,
} from "@/lib/rbac/role-simulator";

interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  department: string;
  position: string;
  role: { id: string; name: string; label: string; isSystem: boolean } | null;
  contractEnd: string | null;
  overridesCount: number;
  subjectScope: string[];
  batchScope: string[];
}

interface RoleSummary {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
}

export function RoleSimulatorDashboard() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);

  // Active top tab
  const [activeTab, setActiveTab] = useState<"EMPLOYEE" | "ROLE" | "COMPARE">("EMPLOYEE");

  // Selection states
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRoleName, setSelectedRoleName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");

  // Comparison states
  const [compareTarget1, setCompareTarget1] = useState<{ type: "EMPLOYEE" | "ROLE"; idOrName: string }>({
    type: "ROLE",
    idOrName: "TEACHER",
  });
  const [compareTarget2, setCompareTarget2] = useState<{ type: "EMPLOYEE" | "ROLE"; idOrName: string }>({
    type: "ROLE",
    idOrName: "SME",
  });
  const [comparisonResult, setComparisonResult] = useState<{
    base: SimulationResult;
    target: SimulationResult;
    diff: ComparisonResult;
  } | null>(null);
  const [comparing, setComparing] = useState(false);

  // Active simulation
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Inspection sub-tab in simulation preview
  const [subTab, setSubTab] = useState<"OVERVIEW" | "SIDEBAR" | "MATRIX" | "BUTTONS" | "PERMISSIONS" | "SCOPE">("OVERVIEW");
  const [buttonModuleFilter, setButtonModuleFilter] = useState<string>("ALL");
  const [permSearch, setPermSearch] = useState<string>("");

  // Load initial employees & roles
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/team/role-preview");
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load Role Simulator");
        }
        setEmployees(json.data.employees || []);
        setRoles(json.data.roles || []);

        // Default selection: first employee or teacher role
        if (json.data.employees?.length > 0) {
          const first = json.data.employees[0];
          setSelectedUserId(first.id);
          triggerEmployeeSimulation(first.id);
        } else if (json.data.roles?.length > 0) {
          setSelectedRoleName(json.data.roles[0].name);
          triggerRoleSimulation(json.data.roles[0].name);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to initialize Role Simulator");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function triggerEmployeeSimulation(userId: string) {
    if (!userId) return;
    try {
      setSimulating(true);
      const res = await fetch("/api/team/role-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SIMULATE_EMPLOYEE", userId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to simulate employee");
      }
      setSimulation(json.data.simulation);
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  async function triggerRoleSimulation(roleName: string) {
    if (!roleName) return;
    try {
      setSimulating(true);
      const res = await fetch("/api/team/role-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SIMULATE_ROLE", roleName }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to simulate role");
      }
      setSimulation(json.data.simulation);
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  async function runComparison() {
    try {
      setComparing(true);
      const res = await fetch("/api/team/role-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "COMPARE",
          userId: compareTarget1.type === "EMPLOYEE" ? compareTarget1.idOrName : undefined,
          roleName: compareTarget1.type === "ROLE" ? compareTarget1.idOrName : undefined,
          compareTarget: compareTarget2,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Comparison failed");
      }
      setComparisonResult({
        base: json.data.baseSimulation,
        target: json.data.targetSimulation,
        diff: json.data.comparison,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to perform comparison");
    } finally {
      setComparing(false);
    }
  }

  const departments = Array.from(new Set(employees.map((e) => e.department))).filter(Boolean);

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.role?.label && e.role.label.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDept = deptFilter === "ALL" || e.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading Role Simulator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PERSISTENT SUPER ADMIN PREVIEW BANNER (When simulation active) */}
      {simulation && (
        <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white px-4 py-3 rounded-2xl shadow-lg border border-blue-400/30 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-white/10 text-white material-symbols-outlined text-[20px]">
              visibility
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900">
                  Super Admin Preview Mode
                </span>
                <span className="text-xs text-blue-200">
                  Viewing as: <strong className="text-white">{simulation.targetUser.name}</strong> ({simulation.targetUser.roleLabel})
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Strictly Read-Only Sandbox • Actual session is NOT switched • {simulation.totalGrantedCount} Effective Permissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Switcher */}
            <select
              value={activeTab === "EMPLOYEE" ? selectedUserId : selectedRoleName}
              onChange={(e) => {
                if (activeTab === "EMPLOYEE") {
                  setSelectedUserId(e.target.value);
                  triggerEmployeeSimulation(e.target.value);
                } else {
                  setSelectedRoleName(e.target.value);
                  triggerRoleSimulation(e.target.value);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
            >
              {activeTab === "EMPLOYEE"
                ? employees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="text-slate-900">
                      {emp.name} ({emp.role?.label || "Staff"})
                    </option>
                  ))
                : roles.map((r) => (
                    <option key={r.name} value={r.name} className="text-slate-900">
                      {r.label} ({r.userCount} users)
                    </option>
                  ))}
            </select>

            <Link
              href="/team"
              className="px-3 py-1.5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 text-xs font-bold transition flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Exit Preview</span>
            </Link>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[28px]">
              admin_panel_settings
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              View As / Role Preview Simulator
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulate and inspect the exact dashboard, sidebar menus, page actions, data scopes, and permissions of any team member or role.
          </p>
        </div>

        {/* TOP TAB CONTROLS */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab("EMPLOYEE");
              if (selectedUserId) triggerEmployeeSimulation(selectedUserId);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "EMPLOYEE"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            <span>Employee-Wise Preview</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("ROLE");
              if (!selectedRoleName && roles.length > 0) {
                setSelectedRoleName(roles[0].name);
                triggerRoleSimulation(roles[0].name);
              } else if (selectedRoleName) {
                triggerRoleSimulation(selectedRoleName);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "ROLE"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            <span>Role-Wise Preview</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("COMPARE");
              if (!comparisonResult) runComparison();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "COMPARE"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
            <span>Compare Roles / Staff</span>
          </button>
        </div>
      </div>

      {/* MODE A: EMPLOYEE-WISE PREVIEW SELECTOR */}
      {activeTab === "EMPLOYEE" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Select Employee to Simulate</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold">
                  {filteredEmployees.length} Available
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Simulation calculates effective permissions factoring in Assigned Role + Individual Overrides + Data Scopes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search name, role, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employee Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedUserId === emp.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedUserId(emp.id);
                    triggerEmployeeSimulation(emp.id);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-slate-50/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {emp.name}
                      </span>
                      {emp.status === "ACTIVE" ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Account" />
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 font-bold">
                          {emp.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{emp.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold truncate">
                      {emp.role?.label || "No Role"}
                    </span>
                    {emp.overridesCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold">
                        {emp.overridesCount} override(s)
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE B: ROLE-WISE PREVIEW SELECTOR */}
      {activeTab === "ROLE" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Select Baseline Role to Simulate</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold">
                {roles.length} Roles
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Simulates clean role defaults as defined by the RBAC matrix and database role permissions, without individual user overrides.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {roles.map((r) => {
              const isSelected = selectedRoleName === r.name;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRoleName(r.name);
                    triggerRoleSimulation(r.name);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-slate-50/50"
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                      {r.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">{r.name}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>{r.userCount} member(s)</span>
                    {r.isSystem && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                        System
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE C: SIDE-BY-SIDE ROLE COMPARISON TOOL */}
      {activeTab === "COMPARE" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Side-by-Side Role & Employee Comparator
            </h2>
            <p className="text-xs text-slate-500">
              Pick any two employees or roles to compute shared vs exclusive permissions, sidebar visibility diffs, and data scope boundaries.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target 1 Picker */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 space-y-3">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Target 1 (Baseline)
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={compareTarget1.type}
                    onChange={(e) =>
                      setCompareTarget1({
                        type: e.target.value as any,
                        idOrName: e.target.value === "ROLE" ? "TEACHER" : employees[0]?.id || "",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="ROLE">Role Baseline</option>
                    <option value="EMPLOYEE">Specific Employee</option>
                  </select>

                  <select
                    value={compareTarget1.idOrName}
                    onChange={(e) => setCompareTarget1({ ...compareTarget1, idOrName: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    {compareTarget1.type === "ROLE"
                      ? roles.map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.label} ({r.name})
                          </option>
                        ))
                      : employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({e.role?.label || "Staff"})
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              {/* Target 2 Picker */}
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  Target 2 (Compare Against)
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={compareTarget2.type}
                    onChange={(e) =>
                      setCompareTarget2({
                        type: e.target.value as any,
                        idOrName: e.target.value === "ROLE" ? "SME" : employees[0]?.id || "",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="ROLE">Role Baseline</option>
                    <option value="EMPLOYEE">Specific Employee</option>
                  </select>

                  <select
                    value={compareTarget2.idOrName}
                    onChange={(e) => setCompareTarget2({ ...compareTarget2, idOrName: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    {compareTarget2.type === "ROLE"
                      ? roles.map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.label} ({r.name})
                          </option>
                        ))
                      : employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({e.role?.label || "Staff"})
                          </option>
                        ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={runComparison}
                disabled={comparing}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {comparing ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">compare</span>
                )}
                <span>Run Comparison Analysis</span>
              </button>
            </div>
          </div>

          {/* Comparison Output */}
          {comparisonResult && (
            <div className="space-y-6">
              {/* VENN METRICS SUMMARY */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500 block truncate">
                    Exclusive to {comparisonResult.base.targetUser.name}
                  </span>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {comparisonResult.diff.exclusiveTo1.length}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Permissions not held by Target 2</p>
                </div>

                <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500 block">Shared Permissions</span>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {comparisonResult.diff.sharedPermissions.length}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Held by both targets</p>
                </div>

                <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900 bg-white dark:bg-slate-900 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500 block truncate">
                    Exclusive to {comparisonResult.target.targetUser.name}
                  </span>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {comparisonResult.diff.exclusiveTo2.length}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Permissions not held by Target 1</p>
                </div>
              </div>

              {/* SIDEBAR NAVIGATION DIFF TABLE */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">menu</span>
                  <span>Sidebar Navigation Visibility Differences</span>
                </h3>

                {comparisonResult.diff.sidebarDifferences.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                    Both targets have identical sidebar visibility.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-3">Sidebar Item</th>
                          <th className="p-3">{comparisonResult.base.targetUser.name}</th>
                          <th className="p-3">{comparisonResult.target.targetUser.name}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {comparisonResult.diff.sidebarDifferences.map((diff, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{diff.label}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  diff.target1State === "VISIBLE"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {diff.target1State}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  diff.target2State === "VISIBLE"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {diff.target2State}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE SIMULATION INSPECTION DASHBOARD (Modes A & B) */}
      {(activeTab === "EMPLOYEE" || activeTab === "ROLE") && simulation && (
        <div className="space-y-6">
          {/* TARGET INFO SUMMARY CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
                  {simulation.targetUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {simulation.targetUser.name}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold">
                      {simulation.targetUser.roleLabel}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold font-mono">
                      {simulation.targetUser.roleName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {simulation.targetUser.department} Department • {simulation.targetUser.position} • Status:{" "}
                    <strong className={simulation.targetUser.status === "ACTIVE" ? "text-emerald-600" : "text-amber-600"}>
                      {simulation.targetUser.status}
                    </strong>
                  </p>
                </div>
              </div>

              {/* METRIC BADGES */}
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Permissions</span>
                  <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                    {simulation.totalGrantedCount}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Visible Nav Items</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {simulation.sidebarEvaluation.visibleCount} / {simulation.sidebarEvaluation.totalCount}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Action Buttons</span>
                  <span className="text-base font-extrabold text-purple-600 dark:text-purple-400">
                    {simulation.pageActions.filter((a) => a.state === "VISIBLE").length}
                  </span>
                </div>
              </div>
            </div>

            {/* DATA SCOPE STRIP */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 font-medium">Subject Scope: </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {simulation.dataScope.subjectScope.length > 0
                      ? simulation.dataScope.subjectScope.join(", ")
                      : "Unrestricted (All Subjects)"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Batch Scope: </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {simulation.dataScope.batchScope.length > 0
                      ? simulation.dataScope.batchScope.join(", ")
                      : "Unrestricted (All Batches)"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    simulation.dataScope.studentPiiRestricted
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  PII: {simulation.dataScope.studentPiiRestricted ? "Masked" : "Full Access"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    simulation.dataScope.financeRestricted
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  Finance: {simulation.dataScope.financeRestricted ? "Restricted" : "Visible"}
                </span>
              </div>
            </div>
          </div>

          {/* INSPECTOR SUB-TABS */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
            {[
              { id: "OVERVIEW", label: "Dashboard Shell Preview", icon: "dashboard" },
              { id: "SIDEBAR", label: "Sidebar Navigation Inspector", icon: "menu" },
              { id: "MATRIX", label: "Module Permission Matrix", icon: "table_chart" },
              { id: "BUTTONS", label: "Button-Level Action Inspector", icon: "touch_app" },
              { id: "PERMISSIONS", label: "Permission Sources & Overrides", icon: "rule" },
              { id: "SCOPE", label: "Data Scope & Boundaries", icon: "lock" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as any)}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  subTab === tab.id
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW & SIMULATED DASHBOARD SHELL */}
          {subTab === "OVERVIEW" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Simulated Left Sidebar */}
              <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block px-2">
                  Simulated Sidebar Navigation
                </span>
                <div className="space-y-1">
                  {simulation.sidebarEvaluation.items.map((item, i) => (
                    <div
                      key={i}
                      className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                        item.state === "VISIBLE"
                          ? "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-bold"
                          : "opacity-40 line-through text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">
                          {item.icon || "circle"}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
                          item.state === "VISIBLE"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {item.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulated Main Dashboard Center */}
              <div className="md:col-span-3 space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-[20px]">preview</span>
                      <span>Simulated Dashboard Experience</span>
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold">
                      Interactive Live Mock
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    Below is the visual reproduction of what this employee sees upon login. Actions requiring missing permissions are automatically disabled with tooltips.
                  </p>

                  {/* Simulated Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                      <span className="text-[11px] text-slate-400 block">Questions Module</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {simulation.effectivePermissions.includes("question.read") ? "Accessible" : "Blocked"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                      <span className="text-[11px] text-slate-400 block">PYQ Verification</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {simulation.effectivePermissions.includes("question.read") ? "Accessible" : "Blocked"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                      <span className="text-[11px] text-slate-400 block">Batches & Courses</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {simulation.effectivePermissions.includes("batch.read") ? "Accessible" : "Blocked"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                      <span className="text-[11px] text-slate-400 block">Finance & Revenue</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {simulation.effectivePermissions.includes("finance.view") ? "Accessible" : "Restricted"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sample Action Buttons Preview */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Simulated Page Action Buttons
                  </h4>

                  <div className="flex flex-wrap items-center gap-2">
                    {simulation.pageActions.slice(0, 8).map((act, i) => (
                      <div
                        key={i}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                          act.state === "VISIBLE"
                            ? "bg-blue-600 text-white border-blue-600"
                            : act.state === "DISABLED_READONLY"
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                            : "hidden"
                        }`}
                        title={act.reason}
                      >
                        <span className="material-symbols-outlined text-[16px]">{act.icon}</span>
                        <span>{act.label}</span>
                        {act.state === "DISABLED_READONLY" && (
                          <span className="material-symbols-outlined text-[14px]">lock</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SIDEBAR NAVIGATION INSPECTOR */}
          {subTab === "SIDEBAR" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Sidebar Navigation Menu Access Evaluation</span>
              </h3>
              <p className="text-xs text-slate-500">
                Detailed audit showing whether each item in the Team Portal sidebar is visible, restricted, or hidden for this employee.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Menu Item</th>
                      <th className="p-3">Route Path</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Required Permission(s)</th>
                      <th className="p-3">Resolution Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {simulation.sidebarEvaluation.items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-slate-500">
                            {item.icon || "circle"}
                          </span>
                          <span>{item.label}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">{item.href}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              item.state === "VISIBLE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.state === "RESTRICTED"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {item.state}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {item.requiredPermissions ? item.requiredPermissions.join(", ") : "None (Public to Team)"}
                        </td>
                        <td className="p-3 text-slate-500">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MODULE PERMISSION MATRIX */}
          {subTab === "MATRIX" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Comprehensive Module Permission Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Evaluation across all functional modules: View, Create, Edit, Delete, Approve, Publish, and Manage capabilities.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 text-left">Module</th>
                      <th className="p-3">View</th>
                      <th className="p-3">Create</th>
                      <th className="p-3">Edit</th>
                      <th className="p-3">Delete</th>
                      <th className="p-3">Approve</th>
                      <th className="p-3">Publish</th>
                      <th className="p-3">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {simulation.moduleMatrix.map((mod, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 text-left font-bold text-slate-900 dark:text-white">
                          {mod.moduleLabel}
                        </td>
                        {[
                          mod.view,
                          mod.create,
                          mod.edit,
                          mod.delete,
                          mod.approve,
                          mod.publish,
                          mod.manage,
                        ].map((granted, idx) => (
                          <td key={idx} className="p-3">
                            {granted ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold text-[13px]">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 text-[13px]">
                                ✕
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BUTTON-LEVEL ACTION INSPECTOR */}
          {subTab === "BUTTONS" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Page Action Button Inspector
                  </h3>
                  <p className="text-xs text-slate-500">
                    Audits all individual action buttons (e.g. Add Question, Edit, Delete, Import PDF, Approve) with their UI state.
                  </p>
                </div>

                <select
                  value={buttonModuleFilter}
                  onChange={(e) => setButtonModuleFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  <option value="ALL">All Modules</option>
                  {Array.from(new Set(simulation.pageActions.map((a) => a.module))).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Action Button</th>
                      <th className="p-3">Module</th>
                      <th className="p-3">UI State</th>
                      <th className="p-3">Required Permission</th>
                      <th className="p-3">Resolution Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {simulation.pageActions
                      .filter((a) => buttonModuleFilter === "ALL" || a.module === buttonModuleFilter)
                      .map((act, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-slate-500">
                              {act.icon}
                            </span>
                            <span>{act.label}</span>
                          </td>
                          <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">{act.module}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                act.state === "VISIBLE"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : act.state === "DISABLED_READONLY"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                              }`}
                            >
                              {act.state}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                            {act.requiredPermission}
                          </td>
                          <td className="p-3 text-slate-500">{act.reason}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: PERMISSION SOURCE & OVERRIDES */}
          {subTab === "PERMISSIONS" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Permission Resolution & Override Source Inspector
                  </h3>
                  <p className="text-xs text-slate-500">
                    Shows exactly why each permission was granted or denied (Role Default, DB, Explicit Override, or Super Admin).
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Filter permission code..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0">
                    <tr>
                      <th className="p-3">Permission Code</th>
                      <th className="p-3">Granted?</th>
                      <th className="p-3">Resolution Source</th>
                      <th className="p-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {simulation.detailedPermissions
                      .filter((p) => p.code.toLowerCase().includes(permSearch.toLowerCase()))
                      .map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{p.code}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                p.granted
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {p.granted ? "GRANTED" : "DENIED"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                p.source === "ADMIN_BYPASS"
                                  ? "bg-amber-100 text-amber-800"
                                  : p.source.startsWith("USER_OVERRIDE")
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {p.source}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{p.details}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: DATA SCOPES */}
          {subTab === "SCOPE" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Data Scope & Isolation Boundaries
              </h3>
              <p className="text-xs text-slate-500">
                Data filters and privacy boundaries that constrain the employee's visibility even when permissions are granted.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Subject Scope Restriction
                  </span>
                  <p className="text-xs text-slate-500">
                    {simulation.dataScope.subjectScope.length > 0
                      ? `Limited to: ${simulation.dataScope.subjectScope.join(", ")}. Questions outside these subjects are filtered out.`
                      : "Unrestricted. Employee can view and interact with all subjects."}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Batch Scope Restriction
                  </span>
                  <p className="text-xs text-slate-500">
                    {simulation.dataScope.batchScope.length > 0
                      ? `Limited to batches: ${simulation.dataScope.batchScope.join(", ")}.`
                      : "Unrestricted. Employee can view and manage all batches."}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Student PII Privacy Policy
                  </span>
                  <p className="text-xs text-slate-500">
                    {simulation.dataScope.studentPiiRestricted
                      ? "Masked. Student phone numbers, email addresses, and parents' details are hidden or redacted."
                      : "Unmasked. Employee has full administrative access to student contact details."}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Finance & Revenue Boundaries
                  </span>
                  <p className="text-xs text-slate-500">
                    {simulation.dataScope.financeRestricted
                      ? "Restricted. Financial analytics, payment ledgers, and revenue reports are completely hidden."
                      : "Accessible. Employee can view financial ledgers and settlement reports."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
