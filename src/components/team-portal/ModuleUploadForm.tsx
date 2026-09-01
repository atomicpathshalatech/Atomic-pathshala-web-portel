"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AcademicSelector } from "@/components/academic/AcademicSelector";

type BrandProfileOption = { id: string; name: string };

export function ModuleUploadForm({ brandProfiles }: { brandProfiles: BrandProfileOption[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [batch, setBatch] = useState("");
  const [chapter, setChapter] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [brandProfileId, setBrandProfileId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please choose a PDF file.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set(
        "metadata",
        JSON.stringify({
          title,
          subject: subject || undefined,
          class: classLabel || undefined,
          batch: batch || undefined,
          chapter: chapter || undefined,
          facultyName: facultyName || undefined,
          academicYear: academicYear || undefined,
          brandProfileId: brandProfileId || undefined,
        })
      );

      const res = await fetch("/api/team/modules", { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Could not upload this module.");
        setSubmitting(false);
        return;
      }
      router.push(`/team/modules/${body.data.module.id}`);
    } catch {
      setError("Network connection error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-4 max-w-xl">
      {error && <p className="text-label-sm text-error">{error}</p>}

      <div>
        <label className="text-label-sm text-on-surface-variant block mb-1">Source PDF *</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-label-sm"
        />
      </div>

      <div>
        <label className="text-label-sm text-on-surface-variant block mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          placeholder="Physics — Electrostatics Module"
        />
      </div>

      {/* Academic NCERT Canonical Selector */}
      <div className="pt-2">
        <AcademicSelector
          onChange={(s) => {
            if (s.classId) setClassLabel(s.classId.includes("11") ? "11" : "12");
            if (s.subjectName) setSubject(s.subjectName);
            if (s.chapterTitle) setChapter(s.chapterTitle);
          }}
          requireTopic={false}
          showLanguageSwitch={true}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
            placeholder="e.g. Physics"
          />
        </div>
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">Chapter</label>
          <input
            type="text"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
            placeholder="e.g. Electric Charges and Fields"
          />
        </div>
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">Class</label>
          <input
            type="text"
            value={classLabel}
            onChange={(e) => setClassLabel(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
            placeholder="e.g. 11 or 12"
          />
        </div>
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">Batch</label>
          <input
            type="text"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          />
        </div>
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">Faculty Name</label>
          <input
            type="text"
            value={facultyName}
            onChange={(e) => setFacultyName(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          />
        </div>
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
            placeholder="2026-27"
          />
        </div>
      </div>

      {brandProfiles.length > 0 && (
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">Brand Profile</label>
          <select
            value={brandProfileId}
            onChange={(e) => setBrandProfileId(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          >
            <option value="">None (choose later)</option>
            {brandProfiles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-on-primary rounded-full px-5 py-2.5 font-label-md text-label-md disabled:opacity-60 hover:opacity-90 transition-opacity"
      >
        {submitting ? "Uploading…" : "Upload Module"}
      </button>
    </form>
  );
}
