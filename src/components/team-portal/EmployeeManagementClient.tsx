"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmployeeCreatorModal } from "./EmployeeCreatorModal";
import { EmployeeIdCardModal } from "./EmployeeIdCardModal";
import { EmployeeCertificateModal, OfficialDocumentType } from "./EmployeeCertificateModal";

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  photoUrl: string | null;
  designation: string;
  department: string;
  dateOfJoining: string | Date;
  employmentType: string;
  workLocation: string;
  assignedBatch: string | null;
  status: string;
  verificationStatus: string;
  verificationToken: string;
  qrCodeDataUrl: string | null;
  lastWorkingDate: string | Date | null;
  certificates?: any[];
  _count?: {
    certificates: number;
    verificationLogs: number;
  };
}

interface EmployeeManagementClientProps {
  initialEmployees: Employee[];
  stats: {
    total: number;
    active: number;
    former: number;
    revoked: number;
  };
}

export function EmployeeManagementClient({
  initialEmployees,
  stats,
}: EmployeeManagementClientProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Modals state
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [selectedForCard, setSelectedForCard] = useState<Employee | null>(null);
  const [selectedForCert, setSelectedForCert] = useState<Employee | null>(null);
  const [certInitialType, setCertInitialType] = useState<OfficialDocumentType>("JOINING_LETTER");

  // Quick Action in flight state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    if (!emp) return false;
    const matchesSearch =
      searchTerm.trim() === "" ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || emp.status === statusFilter;
    const matchesType = typeFilter === "ALL" || emp.employmentType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  async function handleSyncFaculty() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/team/employees/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync faculty");
      alert(data.message || "Faculty synced successfully!");
      router.refresh();
      // Reload current employee list
      const listRes = await fetch("/api/team/employees");
      const listData = await listRes.json();
      if (listData?.data?.employees) {
        setEmployees(listData.data.employees);
      }
    } catch (err: any) {
      alert(err.message || "Failed to sync faculty");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRevoke(employeeId: string) {
    if (!confirm("Are you sure you want to officially REVOKE verification for this employee?")) return;
    setActionLoadingId(employeeId);
    try {
      const res = await fetch(`/api/team/employees/${employeeId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Administrative revocation" }),
      });
      if (!res.ok) throw new Error("Revocation failed");
      router.refresh();
      // optimistic update
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? { ...e, verificationStatus: "REVOKED", status: "TERMINATED" }
            : e
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to revoke");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReissueQr(employeeId: string) {
    if (!confirm("This will invalidate the previous QR code and issue a brand-new verification token. Proceed?")) return;
    setActionLoadingId(employeeId);
    try {
      const res = await fetch(`/api/team/employees/${employeeId}/reissue-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reissue QR");
      router.refresh();
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                verificationToken: data.verificationToken,
                qrCodeDataUrl: data.qrCodeDataUrl,
                verificationStatus: "ACTIVE",
              }
            : e
        )
      );
      alert("New QR code generated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to reissue QR");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Registered</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">Permanent sequential IDs</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Employees</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.active}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Current verifiable staff</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">Former / Relieved</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.former}</p>
          <p className="text-[11px] text-sky-600 mt-0.5">Verified service records</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Revoked Credentials</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.revoked}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Suspended / Inactive</p>
        </div>
      </div>

      {/* Control & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by name, ID, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="FORMER">Former Employees</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
          >
            <option value="ALL">All Employment Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="PART_TIME">Part Time</option>
            <option value="VISITING_FACULTY">Visiting Faculty</option>
            <option value="INDEPENDENT_CONSULTANT">Independent Consultant</option>
            <option value="INTERN">Intern</option>
            <option value="CONTRACT">Contract</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncFaculty}
            className="px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-[#0a2463] dark:text-blue-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            title="Automatically import all teachers and staff into employee verification records"
          >
            <span>{isSyncing ? "Syncing..." : "🔄 Auto-Sync Faculty"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatorOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#0a2463] hover:bg-[#0f3a9e] text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            <span>+ Add Employee</span>
          </button>
        </div>
      </div>

      {/* Employees Table / Cards */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Designation & Dept</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">QR Code</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No employee records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const isRevoked =
                    emp?.verificationStatus === "REVOKED" || emp?.status === "TERMINATED";
                  const isFormer = emp?.status === "FORMER";
                  const isActive = emp?.status === "ACTIVE" && !isRevoked;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Photo */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {emp.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={emp.photoUrl}
                              alt={emp.name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0a2463] dark:text-blue-300 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                              {emp.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {emp.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Joined {new Date(emp.dateOfJoining).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {emp.employeeId}
                      </td>

                      {/* Designation & Department */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {emp.designation}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {emp.department}
                        </p>
                      </td>

                      {/* Employment Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {emp.employmentType.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ● Active
                          </span>
                        )}
                        {isFormer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            ● Former
                          </span>
                        )}
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            ● Revoked
                          </span>
                        )}
                        {!isActive && !isFormer && !isRevoked && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            ● Inactive
                          </span>
                        )}
                      </td>

                      {/* QR Thumbnail */}
                      <td className="py-3.5 px-4">
                        {emp.qrCodeDataUrl ? (
                          <a
                            href={emp.qrCodeDataUrl}
                            download={`${emp.employeeId}-QR.png`}
                            title="Click to download high-res QR"
                            className="inline-block p-1 rounded-lg border border-slate-200 hover:border-blue-400 bg-white"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={emp.qrCodeDataUrl}
                              alt="QR"
                              className="w-8 h-8 object-contain"
                            />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {/* View ID Card */}
                          <button
                            type="button"
                            onClick={() => setSelectedForCard(emp)}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                            title="Preview and download CR80 printable ID card"
                          >
                            🪪 ID Card
                          </button>

                          {/* 4 Primary Document Categories */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCertInitialType("JOINING_LETTER");
                                setSelectedForCert(emp);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                              title="Issue Official Joining Confirmation Letter"
                            >
                              ✉️ Joining
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCertInitialType("EXPERIENCE_CERTIFICATE");
                                setSelectedForCert(emp);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-blue-700 dark:text-blue-300"
                              title="Issue Experience Certificate"
                            >
                              🎓 Experience
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCertInitialType("RELIEVING_LETTER");
                                setSelectedForCert(emp);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-amber-700 dark:text-amber-300"
                              title="Issue Relieving Letter & Clearance Record"
                            >
                              📋 Relieving
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCertInitialType("CONTRACT_LETTER");
                                setSelectedForCert(emp);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-purple-700 dark:text-purple-300"
                              title="Generate Complete Service Agreement Contract with PDF Preview"
                            >
                              ⚖️ Contract Letter
                            </button>
                          </div>

                          {/* Public Verify Link */}
                          <Link
                            href={`/verify/${emp.employeeId}`}
                            target="_blank"
                            className="px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                            title="Open public verification page"
                          >
                            ↗ Public
                          </Link>

                          {/* Rotate / Reissue QR */}
                          <button
                            type="button"
                            disabled={actionLoadingId === emp.id}
                            onClick={() => handleReissueQr(emp.id)}
                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-600"
                            title="Rotate QR verification token"
                          >
                            🔄
                          </button>

                          {/* Revoke */}
                          {!isRevoked && (
                            <button
                              type="button"
                              disabled={actionLoadingId === emp.id}
                              onClick={() => handleRevoke(emp.id)}
                              className="p-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-[11px] text-rose-600 font-bold"
                              title="Revoke Verification"
                            >
                              ⛔
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <EmployeeCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onCreated={(newEmp) => {
          setEmployees((prev) => [newEmp, ...prev]);
        }}
      />

      <EmployeeIdCardModal
        isOpen={Boolean(selectedForCard)}
        onClose={() => setSelectedForCard(null)}
        employee={selectedForCard}
      />

      <EmployeeCertificateModal
        isOpen={Boolean(selectedForCert)}
        onClose={() => setSelectedForCert(null)}
        employee={selectedForCert}
        initialType={certInitialType}
      />
    </div>
  );
}
