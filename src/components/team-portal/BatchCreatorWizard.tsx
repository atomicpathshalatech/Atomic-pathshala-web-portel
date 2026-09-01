"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type CourseOption = { id: string; title: string; slug: string };
type TeacherOption = { id: string; employeeCode: string; department: string; user: { name: string } };

export function BatchCreatorWizard({
  courses,
  teachers,
}: {
  courses: CourseOption[];
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "NEET 2027 Phoenix Target Batch",
    code: `NEET27-PHOENIX-${Math.floor(100 + Math.random() * 900)}`,
    targetExam: "NEET UG",
    classGrade: "Class 11 & 12",
    medium: "Hinglish (Hindi + English)",
    courseId: courses[0]?.id || "",
    capacity: 250,
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    description: "Complete 2-year concept-first preparation batch for NEET aspirants with live whiteboard sessions, DPPs, and AIR test series.",
    mrpPrice: "₹14,999",
    offerPrice: "₹7,499",
    discountPercent: "50%",
    teacherIds: teachers.slice(0, 3).map((t) => t.id),
  });

  const selectedCourse = courses.find((c) => c.id === form.courseId);

  async function handleCreate() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Batch Name and Batch Code are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/team/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          description: form.description.trim() || undefined,
          targetExam: form.targetExam,
          courseId: form.courseId || undefined,
          status: "UPCOMING",
          startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
          capacity: form.capacity > 0 ? form.capacity : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not create batch.");
        return;
      }

      const batchId = data.data.batch.id;

      // Assign initial teachers
      for (const tId of form.teacherIds) {
        const teacher = teachers.find((t) => t.id === tId);
        await fetch(`/api/team/batches/${batchId}/teachers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacherId: tId,
            subject: teacher?.department || "General",
          }),
        }).catch(() => {});
      }

      toast.success("Batch successfully created! Redirecting to Course Flow...");
      router.push(`/team/batches/${batchId}`);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepsList = [
    { num: 1, label: "Basic Information" },
    { num: 2, label: "Academic Program" },
    { num: 3, label: "Faculty Assignment" },
    { num: 4, label: "Pricing & Access" },
    { num: 5, label: "Review & Publish" },
  ];

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-xl space-y-8">
      {/* Wizard Step Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-outline-variant/20 pb-5">
        {stepsList.map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num)}
              className={`text-left p-2.5 rounded-2xl transition-all ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : isDone
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                Step 0{s.num}
              </span>
              <span className="font-bold text-xs truncate block">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-on-surface">Step 1 — Batch Identity &amp; Details</h3>
            <p className="text-xs text-on-surface-variant">Set the name, batch code, target exam, and cohort capacity.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Batch Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Batch Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Target Exam</label>
              <select
                value={form.targetExam}
                onChange={(e) => setForm({ ...form, targetExam: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="NEET UG">NEET UG</option>
                <option value="JEE Main & Advanced">JEE Main &amp; Advanced</option>
                <option value="Class 11 CBSE / Boards">Class 11 CBSE / Boards</option>
                <option value="Class 12 CBSE / Boards">Class 12 CBSE / Boards</option>
                <option value="Foundation (Class 9-10)">Foundation (Class 9-10)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Class / Grade</label>
              <select
                value={form.classGrade}
                onChange={(e) => setForm({ ...form, classGrade: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Class 11 & 12">Class 11 &amp; 12</option>
                <option value="Class 12">Class 12</option>
                <option value="Dropper / Repeater">Dropper / Repeater</option>
                <option value="Class 9 & 10">Class 9 &amp; 10</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Language / Medium</label>
              <select
                value={form.medium}
                onChange={(e) => setForm({ ...form, medium: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Hinglish (Hindi + English)">Hinglish (Hindi + English)</option>
                <option value="English">English</option>
                <option value="Hindi">हिंदी (Hindi)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Cohort Capacity (Seats)</label>
              <input
                type="number"
                min="10"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Batch Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Step 2: Course & Academic Structure */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-on-surface">Step 2 — Course &amp; Master Content Linkage</h3>
            <p className="text-xs text-on-surface-variant">
              Connect this batch to an academic course. You will be able to import centralized Master Chapters in the Course Flow dashboard.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Select Parent Academic Course</label>
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-xs font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-high/30 border border-outline-variant/20 space-y-2">
            <span className="text-[11px] font-bold text-primary uppercase block">
              Architectural Feature &middot; Zero Duplicate Content
            </span>
            <p className="text-xs text-on-surface leading-relaxed">
              Once created, you can import Master Chapters (like <code>CH-BIO-001</code>) into this batch. All master lectures, DPPs, and tests will automatically become available for batch-specific delivery scheduling.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Faculty Assignment */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-on-surface">Step 3 — Assigned Educators</h3>
            <p className="text-xs text-on-surface-variant">Select faculty members to be assigned to this batch.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
            {teachers.map((t) => {
              const isChecked = form.teacherIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                    isChecked
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, teacherIds: [...form.teacherIds, t.id] });
                      } else {
                        setForm({ ...form, teacherIds: form.teacherIds.filter((id) => id !== t.id) });
                      }
                    }}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-bold text-xs text-on-surface">{t.user.name}</p>
                    <p className="text-[11px] text-on-surface-variant">{t.department} &middot; {t.employeeCode}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Pricing & Access */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-on-surface">Step 4 — Pricing &amp; Enrollment Rules</h3>
            <p className="text-xs text-on-surface-variant">Set the commercial pricing and discount plan.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Standard MRP Price</label>
              <input
                type="text"
                value={form.mrpPrice}
                onChange={(e) => setForm({ ...form, mrpPrice: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Offer / Sale Price</label>
              <input
                type="text"
                value={form.offerPrice}
                onChange={(e) => setForm({ ...form, offerPrice: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-primary outline-none focus:ring-2 focus:ring-primary font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Discount Percentage</label>
              <input
                type="text"
                value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-xs text-emerald-600 outline-none focus:ring-2 focus:ring-primary font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Review & Publish */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-on-surface">Step 5 — Review &amp; Launch</h3>
            <p className="text-xs text-on-surface-variant">Review all batch parameters before publishing to the platform.</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 space-y-4 bg-surface-container-lowest text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase">Batch Name</span>
                <span className="font-bold text-on-surface">{form.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase">Batch Code</span>
                <span className="font-mono font-bold text-primary">{form.code}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase">Target Exam</span>
                <span className="font-semibold text-on-surface">{form.targetExam}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase">Offer Price</span>
                <span className="font-bold text-primary">{form.offerPrice}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant block uppercase">Assigned Educators ({form.teacherIds.length})</span>
              <p className="font-semibold text-on-surface mt-0.5">
                {form.teacherIds
                  .map((id) => teachers.find((t) => t.id === id)?.user.name)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container-high transition-colors"
          >
            &larr; Back
          </button>
        ) : <div />}

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="px-7 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Next Step</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleCreate}
            className="px-8 py-3 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            {submitting ? "Creating Batch & Flow..." : "Confirm & Launch Batch"}
          </button>
        )}
      </div>
    </div>
  );
}
