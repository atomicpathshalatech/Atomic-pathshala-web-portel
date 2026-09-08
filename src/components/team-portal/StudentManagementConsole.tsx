"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface StudentItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  enrollmentNumber: string;
  studentIdCode: string;
  class: string;
  targetExam: string;
  fatherName: string;
  motherName: string;
  city: string;
  state: string;
  academicStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | string;
  userStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | string;
  xp: number;
  level: number;
  enrolledBatches: {
    enrollmentId: string;
    batchId: string;
    batchTitle: string;
    grade: string;
    targetExam: string;
    enrolledAt: string;
  }[];
  subscription?: {
    id: string;
    planType: string;
    status: string;
    expiresAt: string;
  } | null;
  createdAt: string;
}

export interface BatchOption {
  id: string;
  title: string;
  grade: string;
  targetExam: string;
}

const CLASS_OPTIONS = ["Class 9", "Class 10", "Class 11", "Class 12", "Dropper", "ALL"];
const TARGET_EXAM_OPTIONS = ["NEET", "JEE Main", "JEE Advanced", "Foundation", "ALL"];
const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

export function StudentManagementConsole() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [availableBatches, setAvailableBatches] = useState<BatchOption[]>([]);
  const [stats, setStats] = useState<{ totalStudents: number; activeStudents: number; neetStudents: number; jeeStudents: number }>({
    totalStudents: 0,
    activeStudents: 0,
    neetStudents: 0,
    jeeStudents: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [examFilter, setExamFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Add Student Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    targetClass: "Class 11",
    targetExam: "NEET",
    fatherName: "Parent",
    motherName: "Parent",
    city: "Delhi",
    state: "Delhi",
    batchId: "",
  });
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);

  // Course Access Modal
  const [selectedStudentForAccess, setSelectedStudentForAccess] = useState<StudentItem | null>(null);
  const [selectedBatchToGrant, setSelectedBatchToGrant] = useState("");
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);
  const [isRevokingAccess, setIsRevokingAccess] = useState<string | null>(null);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (classFilter !== "ALL") params.set("class", classFilter);
      if (examFilter !== "ALL") params.set("targetExam", examFilter);
      if (batchFilter !== "ALL") params.set("batchId", batchFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const res = await fetch(`/api/team/students?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load students directory");
      const json = await res.json();
      if (json.success && json.data) {
        setStudents(json.data.students || []);
        setStats(json.data.stats || { totalStudents: 0, activeStudents: 0, neetStudents: 0, jeeStudents: 0 });
        setAvailableBatches(json.data.availableBatches || []);
        setTotalPages(json.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load student data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [page, classFilter, examFilter, batchFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadStudents();
  };

  // Add Student Handler
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.password) {
      toast.error("Please fill Name, Email, and Password");
      return;
    }

    try {
      setIsCreatingStudent(true);
      const res = await fetch("/api/team/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create student");

      toast.success(`Student ${addForm.name} registered with Enrollment ID #${json.data.enrollmentNumber}!`);
      setIsAddModalOpen(false);
      setAddForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        targetClass: "Class 11",
        targetExam: "NEET",
        fatherName: "Parent",
        motherName: "Parent",
        city: "Delhi",
        state: "Delhi",
        batchId: "",
      });
      loadStudents();
    } catch (err: any) {
      toast.error(err.message || "Failed to create student");
    } finally {
      setIsCreatingStudent(false);
    }
  };

  // Grant Course / Batch Access
  const handleGrantAccess = async () => {
    if (!selectedStudentForAccess || !selectedBatchToGrant) {
      toast.error("Please select a batch to grant access.");
      return;
    }

    try {
      setIsGrantingAccess(true);
      const res = await fetch(`/api/team/students/${selectedStudentForAccess.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: selectedBatchToGrant }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to grant course access");

      toast.success(json.message || "Course access granted successfully!");
      setSelectedBatchToGrant("");
      
      // Update local state for immediate feedback
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === selectedStudentForAccess.id) {
            const addedBatch = availableBatches.find((b) => b.id === selectedBatchToGrant);
            const exists = s.enrolledBatches.some((eb) => eb.batchId === selectedBatchToGrant);
            if (!exists && addedBatch) {
              const updatedBatches = [
                ...s.enrolledBatches,
                {
                  enrollmentId: json.data?.id || `new_${Date.now()}`,
                  batchId: addedBatch.id,
                  batchTitle: addedBatch.title,
                  grade: addedBatch.grade,
                  targetExam: addedBatch.targetExam,
                  enrolledAt: new Date().toISOString(),
                },
              ];
              setSelectedStudentForAccess({ ...s, enrolledBatches: updatedBatches });
              return { ...s, enrolledBatches: updatedBatches };
            }
          }
          return s;
        })
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to grant batch access");
    } finally {
      setIsGrantingAccess(false);
    }
  };

  // Revoke Course / Batch Access
  const handleRevokeAccess = async (batchId: string, batchTitle: string) => {
    if (!selectedStudentForAccess) return;
    if (!confirm(`Are you sure you want to revoke access to "${batchTitle}" for ${selectedStudentForAccess.name}?`)) {
      return;
    }

    try {
      setIsRevokingAccess(batchId);
      const res = await fetch(`/api/team/students/${selectedStudentForAccess.id}/enroll?batchId=${batchId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to revoke access");

      toast.success(`Access to "${batchTitle}" dropped.`);
      
      // Update local state
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === selectedStudentForAccess.id) {
            const updatedBatches = s.enrolledBatches.filter((eb) => eb.batchId !== batchId);
            setSelectedStudentForAccess({ ...s, enrolledBatches: updatedBatches });
            return { ...s, enrolledBatches: updatedBatches };
          }
          return s;
        })
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke access");
    } finally {
      setIsRevokingAccess(null);
    }
  };

  // Status Toggle
  const handleToggleStatus = async (studentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await fetch(`/api/team/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, academicStatus: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update status");

      toast.success(`Student status updated to ${nextStatus}`);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, academicStatus: nextStatus, userStatus: nextStatus } : s))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update student status");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-3xl">school</span>
            Student Management &amp; Course Access
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Dedicated student directory, batch/course assignments, and real-time access provisioning.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Add New Student
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">groups</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Students</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active Status</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.activeStudents}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">medical_services</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">NEET Aspirants</p>
            <p className="text-2xl font-bold text-purple-600">{stats.neetStudents}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">engineering</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">JEE Aspirants</p>
            <p className="text-2xl font-bold text-amber-600">{stats.jeeStudents}</p>
          </div>
        </div>
      </div>

      {/* Search & Multi-filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, email, phone, enrollment #..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl transition cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Class</label>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white"
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Target Exam</label>
            <select
              value={examFilter}
              onChange={(e) => {
                setExamFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white"
            >
              {TARGET_EXAM_OPTIONS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Batch / Course</label>
            <select
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white"
            >
              <option value="ALL">All Batches</option>
              {availableBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.grade})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3.5">Student Details</th>
                <th className="px-4 py-3.5">Enrollment #</th>
                <th className="px-4 py-3.5">Target &amp; Class</th>
                <th className="px-4 py-3.5">Active Courses / Batches</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <span className="material-symbols-outlined text-3xl animate-spin mb-2 text-blue-600">
                      progress_activity
                    </span>
                    <p>Loading students directory…</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2 text-gray-300">school</span>
                    <p className="font-medium text-gray-600">No students found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your search terms or filters</p>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
                          {student.name ? student.name[0]?.toUpperCase() : "S"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 leading-tight">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                          {student.phone && <p className="text-[11px] text-gray-400">{student.phone}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-mono text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                        {student.enrollmentNumber}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full w-fit">
                          {student.targetExam}
                        </span>
                        <span className="text-xs text-gray-500">{student.class}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {student.enrolledBatches.length === 0 ? (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            No Batch Enrolled
                          </span>
                        ) : (
                          student.enrolledBatches.map((b) => (
                            <span
                              key={b.batchId}
                              className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md"
                              title={`Enrolled at ${new Date(b.enrolledAt).toLocaleDateString()}`}
                            >
                              {b.batchTitle}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          student.academicStatus === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : student.academicStatus === "SUSPENDED"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            student.academicStatus === "ACTIVE"
                              ? "bg-emerald-500"
                              : student.academicStatus === "SUSPENDED"
                              ? "bg-red-500"
                              : "bg-gray-400"
                          }`}
                        />
                        {student.academicStatus}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForAccess(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                          title="Grant or revoke batch/course access"
                        >
                          <span className="material-symbols-outlined text-sm">key</span>
                          Course Access
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(student.id, student.academicStatus)}
                          className={`p-1.5 rounded-lg border text-xs transition ${
                            student.academicStatus === "ACTIVE"
                              ? "text-red-600 hover:bg-red-50 border-red-200"
                              : "text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                          }`}
                          title={student.academicStatus === "ACTIVE" ? "Suspend Student" : "Activate Student"}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {student.academicStatus === "ACTIVE" ? "block" : "check_circle"}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-gray-300 rounded text-gray-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 bg-white border border-gray-300 rounded text-gray-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Course / Batch Access Management */}
      {selectedStudentForAccess && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">manage_accounts</span>
                  Manage Course &amp; Batch Access
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Student: <span className="font-semibold text-gray-800">{selectedStudentForAccess.name}</span> ({selectedStudentForAccess.enrollmentNumber})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForAccess(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Currently Enrolled Batches */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Currently Enrolled Courses / Batches ({selectedStudentForAccess.enrolledBatches.length})
              </label>

              {selectedStudentForAccess.enrolledBatches.length === 0 ? (
                <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-500">
                  No active batch enrollments. Student does not have access to any course yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl max-h-48 overflow-y-auto">
                  {selectedStudentForAccess.enrolledBatches.map((b) => (
                    <div key={b.batchId} className="flex items-center justify-between p-3 bg-white">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{b.batchTitle}</p>
                        <p className="text-[11px] text-gray-500">
                          {b.grade} • {b.targetExam} • Enrolled {new Date(b.enrolledAt).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isRevokingAccess === b.batchId}
                        onClick={() => handleRevokeAccess(b.batchId, b.batchTitle)}
                        className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                      >
                        {isRevokingAccess === b.batchId ? "Dropping…" : "Revoke Access"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grant Access to New Batch */}
            <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                Grant Access to a New Batch
              </label>

              <div className="flex gap-2">
                <select
                  value={selectedBatchToGrant}
                  onChange={(e) => setSelectedBatchToGrant(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a Batch / Course to Enroll…</option>
                  {availableBatches
                    .filter((b) => !selectedStudentForAccess.enrolledBatches.some((eb) => eb.batchId === b.id))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.grade} - {b.targetExam})
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  disabled={!selectedBatchToGrant || isGrantingAccess}
                  onClick={handleGrantAccess}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow disabled:opacity-50 cursor-pointer"
                >
                  {isGrantingAccess ? "Granting…" : "Grant Access"}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentForAccess(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Student */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">person_add</span>
                  Add &amp; Enroll New Student
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create student account with credentials and assign batch access.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Student Full Name"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Login Password *</label>
                  <input
                    type="password"
                    required
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Set student password"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile / WhatsApp</label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Class</label>
                  <select
                    value={addForm.targetClass}
                    onChange={(e) => setAddForm({ ...addForm, targetClass: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {CLASS_OPTIONS.filter((c) => c !== "ALL").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Exam</label>
                  <select
                    value={addForm.targetExam}
                    onChange={(e) => setAddForm({ ...addForm, targetExam: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {TARGET_EXAM_OPTIONS.filter((e) => e !== "ALL").map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Batch / Course</label>
                  <select
                    value={addForm.batchId}
                    onChange={(e) => setAddForm({ ...addForm, batchId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select Batch (Optional)</option>
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.grade})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreatingStudent}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingStudent ? "Creating Student…" : "Register & Enroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
