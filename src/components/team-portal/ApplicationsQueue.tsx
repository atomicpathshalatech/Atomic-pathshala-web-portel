"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { DEPARTMENT_OPTIONS } from "@/lib/validation/teacher";

type Status = "PENDING" | "INTERVIEWING" | "VERIFIED" | "REJECTED" | "ARCHIVED";

type Application = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  subject: string;
  experienceYears: number;
  bio: string | null;
  resumeUrl: string | null;
  portfolioUrl: string | null;
  status: Status;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const TABS: { key: Status; label: string }[] = [
  { key: "PENDING", label: "Pending Review" },
  { key: "INTERVIEWING", label: "Interviewing" },
  { key: "VERIFIED", label: "Hired" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ARCHIVED", label: "Archived" },
];

const STATUS_STYLES: Record<Status, string> = {
  PENDING: "bg-primary-container text-on-primary-container",
  INTERVIEWING: "bg-secondary-container text-on-secondary-container",
  VERIFIED: "bg-tertiary-container text-on-tertiary-container",
  REJECTED: "bg-error-container text-on-error-container",
  ARCHIVED: "bg-surface-container-high text-on-surface-variant",
};

export function ApplicationsQueue({ canApprove }: { canApprove: boolean }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showApproveForm, setShowApproveForm] = useState(false);

  // Approve form fields
  const [employeeCode, setEmployeeCode] = useState("");
  const [department, setDepartment] = useState("");
  const [subjectsInput, setSubjectsInput] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async (status: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/faculty/applications?status=${status}`);
      const body = await res.json();
      if (body.success) {
        setApplications(body.data.applications);
        setSelectedId(body.data.applications[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  useEffect(() => {
    setShowApproveForm(false);
    setEmployeeCode("");
    setDepartment("");
    setSubjectsInput("");
    setPassword("");
  }, [selectedId]);

  const selected = applications.find((a) => a.id === selectedId) ?? null;

  async function changeStatus(status: "INTERVIEWING" | "REJECTED" | "ARCHIVED" | "PENDING") {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/faculty/applications/${selected.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update this application");
        return;
      }
      toast.success("Status updated");
      load(statusFilter);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function approve() {
    if (!selected) return;
    if (!employeeCode || !department || !password) {
      toast.error("Employee code, department, and a temporary password are required");
      return;
    }
    setSubmitting(true);
    try {
      const subjects = subjectsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/team/faculty/applications/${selected.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode,
          department,
          subjects: subjects.length ? subjects : [selected.subject],
          password,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not approve this application");
        return;
      }
      toast.success(`Hired! Login: ${body.data.email}`);
      load(statusFilter);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-stack-md">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Faculty Applications</h1>
        <p className="text-on-surface-variant font-body-md">
          Candidates apply at <span className="font-mono text-label-sm">/careers/apply</span> — review
          and hire them here.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-lg font-label-md text-label-md transition-colors ${
              statusFilter === tab.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left: list */}
        <section className="lg:col-span-5 glass-card rounded-xl overflow-hidden flex flex-col max-h-[70vh]">
          <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low/50">
            <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
              {applications.length} applicant{applications.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading && <p className="text-on-surface-variant font-body-md p-4">Loading...</p>}
            {!loading && applications.length === 0 && (
              <p className="text-on-surface-variant font-body-md p-4">No applications here.</p>
            )}
            {applications.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left glass-card p-4 rounded-xl border-2 transition-all ${
                  selectedId === a.id ? "border-primary" : "border-transparent hover:border-primary/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-md text-label-md text-on-surface">{a.fullName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[a.status]}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-label-sm text-on-surface-variant">
                  {a.subject} • {a.experienceYears}+ yrs experience
                </p>
                <p className="text-[11px] text-outline mt-1">
                  Applied {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Right: detail */}
        <section className="lg:col-span-7 glass-card rounded-xl p-6 md:p-8">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-on-surface-variant font-body-md py-24">
              Select an applicant from the list.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-outline-variant/20">
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">{selected.fullName}</h3>
                  <p className="text-label-sm text-on-surface-variant">
                    {selected.email} {selected.phone && `• ${selected.phone}`}
                  </p>
                  <p className="text-label-sm text-primary font-bold mt-1">
                    {selected.subject} • {selected.experienceYears}+ years
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_STYLES[selected.status]}`}>
                  {selected.status}
                </span>
              </div>

              {selected.bio && (
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
                    Teaching Background
                  </h4>
                  <p className="text-body-md text-on-surface whitespace-pre-wrap">{selected.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selected.resumeUrl && (
                  <a
                    href={selected.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 border border-outline-variant/30 rounded-xl hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary">description</span>
                    <span className="text-label-md">View Resume</span>
                  </a>
                )}
                {selected.portfolioUrl && (
                  <a
                    href={selected.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 border border-outline-variant/30 rounded-xl hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary">play_circle</span>
                    <span className="text-label-md">View Portfolio / Sample</span>
                  </a>
                )}
              </div>

              {selected.status !== "VERIFIED" && selected.status !== "REJECTED" && (
                <div className="flex flex-wrap gap-3 pt-2 border-t border-outline-variant/20">
                  {canApprove && !showApproveForm && (
                    <button
                      disabled={submitting}
                      onClick={() => setShowApproveForm(true)}
                      className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-label-md shadow-lg hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      Approve &amp; Hire
                    </button>
                  )}
                  {selected.status === "PENDING" && (
                    <button
                      disabled={submitting}
                      onClick={() => changeStatus("INTERVIEWING")}
                      className="px-6 py-2.5 border border-primary text-primary rounded-xl font-label-md hover:bg-primary/5 transition-all disabled:opacity-60"
                    >
                      Schedule Interview
                    </button>
                  )}
                  <button
                    disabled={submitting}
                    onClick={() => changeStatus("REJECTED")}
                    className="px-6 py-2.5 border border-error text-error rounded-xl font-label-md hover:bg-error/5 transition-all disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => changeStatus("ARCHIVED")}
                    className="px-6 py-2.5 text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container-high transition-all disabled:opacity-60"
                  >
                    Archive
                  </button>
                </div>
              )}

              {showApproveForm && (
                <div className="glass-card p-6 rounded-xl space-y-4 bg-primary-container/5 border border-primary/20">
                  <h4 className="font-label-md text-label-md text-primary uppercase tracking-wider">
                    Create Login &amp; Faculty Profile
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-label-sm text-on-surface-variant">Employee Code</label>
                      <input
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        placeholder="e.g. EMP-2026-014"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-label-sm text-on-surface-variant">Department</label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className={inputClass}
                      >
                        <option value="" disabled>
                          Select department
                        </option>
                        {DEPARTMENT_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-label-sm text-on-surface-variant">
                        Subjects (comma-separated)
                      </label>
                      <input
                        value={subjectsInput}
                        onChange={(e) => setSubjectsInput(e.target.value)}
                        placeholder={selected.subject}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-label-sm text-on-surface-variant">Temporary Password</label>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="text"
                        placeholder="Min. 8 characters"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <p className="text-label-sm text-on-surface-variant">
                    Share this password with {selected.fullName} directly — it won&apos;t be shown again.
                  </p>
                  <div className="flex gap-3">
                    <button
                      disabled={submitting}
                      onClick={approve}
                      className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-label-md shadow-lg hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      {submitting ? "Creating..." : "Confirm & Create Account"}
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => setShowApproveForm(false)}
                      className="px-6 py-2.5 text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container-high transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {selected.status === "VERIFIED" && (
                <div className="bg-tertiary-container/10 border border-tertiary/20 rounded-xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary">check_circle</span>
                  <p className="text-body-md text-on-surface">
                    Hired — a login has been created for {selected.email}.
                  </p>
                </div>
              )}
              {selected.status === "REJECTED" && (
                <div className="bg-error-container/10 border border-error/20 rounded-xl p-4">
                  <p className="text-body-md text-on-surface">This application was rejected.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const inputClass =
  "w-full mt-1 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all";
