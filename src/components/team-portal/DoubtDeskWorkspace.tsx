"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

type Doubt = {
  id: string;
  subject: string | null;
  body: string;
  priority: "NORMAL" | "HIGH";
  status: "OPEN" | "RESOLVED" | "FLAGGED";
  expertExplanation: string | null;
  videoUrl: string | null;
  createdAt: string;
  resolvedAt: string | null;
  student: {
    enrollmentNumber: string;
    targetExam: string;
    user: { name: string };
  };
};

const STATUS_TABS = [
  { key: "OPEN", label: "Open" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "FLAGGED", label: "Flagged" },
] as const;

export function DoubtDeskWorkspace({ canResolve }: { canResolve: boolean }) {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "RESOLVED" | "FLAGGED">("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/doubts?status=${status}`);
      const body = await res.json();
      if (body.success) {
        setDoubts(body.data.doubts);
        setSelectedId(body.data.doubts[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  useEffect(() => {
    setExplanation("");
    setVideoUrl("");
  }, [selectedId]);

  const selected = doubts.find((d) => d.id === selectedId) ?? null;

  async function resolve(status: "RESOLVED" | "FLAGGED") {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/doubts/${selected.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expertExplanation: explanation, videoUrl }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update this doubt");
        return;
      }
      toast.success(status === "RESOLVED" ? "Marked as resolved" : "Flagged for review");
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
        <h1 className="font-headline-lg text-headline-lg text-primary">Doubt Desk</h1>
        <p className="text-on-surface-variant font-body-md">Resolve doubts submitted by students.</p>
      </div>

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
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
        {/* Left: feed */}
        <section className="lg:col-span-4 glass-card rounded-xl overflow-hidden flex flex-col max-h-[70vh]">
          <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low/50">
            <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
              {statusFilter === "OPEN" ? "Pending" : STATUS_TABS.find((t) => t.key === statusFilter)?.label}{" "}
              ({doubts.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading && <p className="text-on-surface-variant font-body-md p-4">Loading...</p>}
            {!loading && doubts.length === 0 && (
              <p className="text-on-surface-variant font-body-md p-4">No doubts here.</p>
            )}
            {doubts.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left glass-card p-4 rounded-xl border-2 transition-all ${
                  selectedId === d.id ? "border-primary" : "border-transparent hover:border-primary/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label-md text-label-md text-on-surface">{d.student.user.name}</span>
                  {d.priority === "HIGH" && (
                    <span className="px-2 py-0.5 bg-error-container text-on-error-container text-[10px] font-bold rounded-full">
                      High Priority
                    </span>
                  )}
                </div>
                <p className="text-body-md text-on-surface line-clamp-2 mb-2">{d.body}</p>
                <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                  <span>{new Date(d.createdAt).toLocaleString()}</span>
                  {d.subject && <span className="font-bold text-primary">{d.subject}</span>}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Right: detail */}
        <section className="lg:col-span-8 glass-card rounded-xl p-6 md:p-8">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-on-surface-variant font-body-md py-24">
              Select a doubt from the list.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-outline-variant/20">
                <div>
                  <p className="text-label-sm text-on-surface-variant">
                    {selected.student.user.name} • {selected.student.targetExam} •{" "}
                    {selected.student.enrollmentNumber}
                  </p>
                  {selected.subject && <p className="font-label-md text-primary">{selected.subject}</p>}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    selected.status === "RESOLVED"
                      ? "bg-tertiary-container text-on-tertiary-container"
                      : selected.status === "FLAGGED"
                        ? "bg-error-container text-on-error-container"
                        : "bg-primary-container text-on-primary-container"
                  }`}
                >
                  {selected.status}
                </span>
              </div>

              <div className="glass-card p-gutter rounded-2xl bg-surface-container-low/50">
                <p className="text-body-lg text-on-surface leading-relaxed">{selected.body}</p>
              </div>

              {selected.status === "OPEN" && canResolve ? (
                <div className="space-y-4">
                  <div>
                    <label className="font-label-md text-label-md text-on-surface">Expert Explanation</label>
                    <textarea
                      rows={5}
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Provide a detailed, step-by-step explanation..."
                      className="w-full mt-1.5 p-4 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-body-md text-body-md"
                    />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface">
                      Video walkthrough URL (optional)
                    </label>
                    <input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full mt-1.5 p-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-body-md text-body-md"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      disabled={submitting}
                      onClick={() => resolve("RESOLVED")}
                      className="flex-1 px-8 py-3 bg-primary text-on-primary rounded-xl font-bold text-label-md shadow-lg hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      Publish Resolution
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => resolve("FLAGGED")}
                      className="px-6 py-3 border border-error text-error rounded-xl font-bold text-label-md hover:bg-error/5 transition-colors disabled:opacity-60"
                    >
                      Flag Instead
                    </button>
                  </div>
                </div>
              ) : selected.status === "OPEN" ? (
                <p className="text-on-surface-variant font-body-md">
                  You don&apos;t have permission to resolve doubts.
                </p>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-headline-md text-headline-md text-on-surface">
                    {selected.status === "RESOLVED" ? "Expert Explanation" : "Flagged"}
                  </h3>
                  {selected.expertExplanation && (
                    <p className="text-body-md text-on-surface whitespace-pre-wrap">
                      {selected.expertExplanation}
                    </p>
                  )}
                  {selected.videoUrl && (
                    <a
                      href={selected.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-base">play_circle</span>
                      Watch video walkthrough
                    </a>
                  )}
                  {selected.resolvedAt && (
                    <p className="text-label-sm text-on-surface-variant">
                      Updated {new Date(selected.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
