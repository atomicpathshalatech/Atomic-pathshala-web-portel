"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/layout/Modal";
import { ThumbnailUploader } from "./ThumbnailUploader";

export interface TestSeriesEditModalProps {
  series: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    targetBatch?: string | null;
    className?: string | null;
    course?: string | null;
    examType?: string | null;
    tags?: string | null;
    thumbnailUrl?: string | null;
    visibility: string;
    status: string;
  };
  triggerVariant?: "button" | "table-action" | "icon";
}

export function TestSeriesEditModal({
  series,
  triggerVariant = "button",
}: TestSeriesEditModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState(series.name || "");
  const [description, setDescription] = useState(series.description || "");
  const [targetBatch, setTargetBatch] = useState(series.targetBatch || "");
  const [classNameVal, setClassNameVal] = useState(series.className || "");
  const [course, setCourse] = useState(series.course || "");
  const [examType, setExamType] = useState(series.examType || "");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">(
    series.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE"
  );
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "ARCHIVED">(
    series.status === "ACTIVE"
      ? "ACTIVE"
      : series.status === "ARCHIVED"
      ? "ARCHIVED"
      : "DRAFT"
  );
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    series.thumbnailUrl || null
  );

  const initialTags = series.tags
    ? series.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");

  function handleOpen() {
    setName(series.name || "");
    setDescription(series.description || "");
    setTargetBatch(series.targetBatch || "");
    setClassNameVal(series.className || "");
    setCourse(series.course || "");
    setExamType(series.examType || "");
    setVisibility(series.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE");
    setStatus(
      series.status === "ACTIVE"
        ? "ACTIVE"
        : series.status === "ARCHIVED"
        ? "ARCHIVED"
        : "DRAFT"
    );
    setThumbnailUrl(series.thumbnailUrl || null);
    setTags(
      series.tags
        ? series.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : []
    );
    setOpen(true);
  }

  function addTag() {
    const val = tagInput.trim();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
    }
    setTagInput("");
  }

  function removeTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a series name.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/team/test-series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          targetBatch: targetBatch.trim(),
          className: classNameVal.trim(),
          course: course.trim(),
          examType: examType.trim(),
          visibility,
          status,
          tags,
          thumbnailUrl: thumbnailUrl || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to update test series.");
        setSaving(false);
        return;
      }

      toast.success("Test series updated successfully!");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong updating test series.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {triggerVariant === "button" && (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-sm border border-slate-200 dark:border-slate-700"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          <span>Edit Series</span>
        </button>
      )}

      {triggerVariant === "table-action" && (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          Edit
        </button>
      )}

      {triggerVariant === "icon" && (
        <button
          type="button"
          onClick={handleOpen}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Edit Test Series"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} size="lg">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Test Series ID
                </span>
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {series.code}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Test Series
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Series Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NEET Full Syllabus Test Series"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <span className="text-[11px] text-slate-400">
                  {description.length}/10000 chars
                </span>
              </div>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about what this series covers, schedule, pattern, syllabus..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
              />
            </div>

            {/* Thumbnail */}
            <div>
              <ThumbnailUploader
                value={thumbnailUrl}
                onChange={(url) => setThumbnailUrl(url)}
                label="Series Thumbnail (16:9)"
              />
            </div>

            {/* Cohort details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Batch
                </label>
                <input
                  type="text"
                  value={targetBatch}
                  onChange={(e) => setTargetBatch(e.target.value)}
                  placeholder="e.g. NEET Selection Pro Batch"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Class
                </label>
                <input
                  type="text"
                  value={classNameVal}
                  onChange={(e) => setClassNameVal(e.target.value)}
                  placeholder="e.g. 11, 12, Dropper"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Course
                </label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. NEET UG, IIT-JEE"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exam Type
                </label>
                <input
                  type="text"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  placeholder="e.g. Full Syllabus, Minor, Unit Test"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "PRIVATE" | "PUBLIC")
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="PRIVATE">Private (Batch Enrolled Only)</option>
                  <option value="PUBLIC">Public (Available in Store / All)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value as "DRAFT" | "ACTIVE" | "ARCHIVED"
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ACTIVE">Active (Live)</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tags
              </label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-rose-600 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Type a tag and press Add or Enter..."
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-60"
              >
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
