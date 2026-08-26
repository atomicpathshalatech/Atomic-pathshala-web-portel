"use client";

import { useState } from "react";
import { toast } from "sonner";

type Testimonial = {
  id: string;
  studentName: string;
  studentClass: string | null;
  targetExam: string | null;
  quote: string;
  isApproved: boolean;
};

export function TestimonialManager({ initialTestimonials }: { initialTestimonials: Testimonial[] }) {
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [showForm, setShowForm] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [quote, setQuote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, studentClass: studentClass || undefined, targetExam: targetExam || undefined, quote }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not create testimonial.");
      setTestimonials((prev) => [...prev, json.data.testimonial]);
      toast.success("Testimonial added — approve it to make it public.");
      setShowForm(false);
      setStudentName(""); setStudentClass(""); setTargetExam(""); setQuote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create testimonial.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleApproved(id: string, isApproved: boolean) {
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !isApproved }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setTestimonials((prev) => prev.map((t) => (t.id === id ? json.data.testimonial : t)));
    } catch {
      toast.error("Could not update testimonial.");
    }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
      setTestimonials((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error("Could not delete testimonial.");
    }
  }

  return (
    <div className="space-y-stack-md">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)} className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md">
          New Testimonial
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="glass-card rounded-2xl p-6 space-y-3">
          <input required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student name" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          <div className="grid grid-cols-2 gap-3">
            <input value={studentClass} onChange={(e) => setStudentClass(e.target.value)} placeholder="Class (optional)" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
            <input value={targetExam} onChange={(e) => setTargetExam(e.target.value)} placeholder="Target exam (optional)" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          </div>
          <textarea required value={quote} onChange={(e) => setQuote(e.target.value)} rows={3} placeholder="Quote" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          <button type="submit" disabled={submitting} className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md disabled:opacity-60">
            {submitting ? "Saving…" : "Add Testimonial"}
          </button>
        </form>
      )}

      <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
        {testimonials.length === 0 && <p className="p-8 text-center text-on-surface-variant font-body-md">No testimonials yet.</p>}
        {testimonials.map((t) => (
          <div key={t.id} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-label-lg text-label-lg text-on-surface">{t.studentName}</p>
              <p className="text-label-sm text-on-surface-variant italic truncate">&ldquo;{t.quote}&rdquo;</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => toggleApproved(t.id, t.isApproved)}
                className={`text-label-sm px-2 py-1 rounded-full font-bold uppercase tracking-wide text-[10px] ${t.isApproved ? "bg-green-500/10 text-green-700" : "bg-surface-container-high text-on-surface-variant"}`}
              >
                {t.isApproved ? "Approved" : "Pending"}
              </button>
              <button onClick={() => remove(t.id)} className="text-label-sm text-error hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
