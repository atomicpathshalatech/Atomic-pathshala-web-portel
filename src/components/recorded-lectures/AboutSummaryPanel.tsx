"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SummaryView } from "./SummaryView";

export type SummaryItem = {
  id: string;
  revision: number;
  aboutRevision: number;
  content: string;
  status: "DRAFT" | "APPROVED" | "PUBLISHED" | "SUPERSEDED";
  outdated: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  generatedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
};

export type AboutSummaryData = {
  id: string;
  about: { content: string; revision: number; updatedAt: string | null };
  summaries: SummaryItem[];
};

const ABOUT_GUIDE = [
  "What was taught in this lecture",
  "Main concepts and important definitions",
  "Formulas, equations or reactions (write $...$ for maths, e.g. $v = u + at$)",
  "Examples and numericals solved",
  "Common mistakes discussed and exam-oriented points",
  "Homework or revision instructions",
];

const MIN_WORDS = 25;

const STATUS_STYLE: Record<SummaryItem["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  APPROVED: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  PUBLISHED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  SUPERSEDED: "bg-slate-100 text-slate-500",
};

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(typeof json.error === "string" ? json.error : "Something went wrong.");
  return json.data;
}

/**
 * The teacher's About (what was taught) and the lecture summary made from it.
 * No PDF/PPT needed. Generated summaries stay drafts until approved and
 * published; a summary from an older About is flagged OUTDATED.
 */
export function AboutSummaryPanel({ lecture, onLecture }: { lecture: AboutSummaryData; onLecture: (next: any) => void }) {
  const [about, setAbout] = useState(lecture.about.content);
  const [aboutRevision, setAboutRevision] = useState(lecture.about.revision);
  const [savingAbout, setSavingAbout] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  const words = about.trim().split(/\s+/).filter(Boolean).length;
  const aboutDirty = about.trim() !== lecture.about.content.trim();
  const working = lecture.summaries.find((s) => s.status !== "SUPERSEDED") ?? null;
  const published = lecture.summaries.find((s) => s.status === "PUBLISHED") ?? null;

  const saveAbout = async () => {
    setSavingAbout(true);
    try {
      const data = await call(`/api/team/recorded-lectures/${lecture.id}/about`, "PUT", { content: about, baseRevision: aboutRevision });
      setAboutRevision(data.about.revision);
      toast.success(data.outdatedSummaries ? "About saved. The existing summary is now marked outdated — regenerate it." : "About saved.");
      onLecture({ ...lecture, about: data.about, summaries: lecture.summaries.map((s) => (s.aboutRevision < data.about.revision && s.status !== "SUPERSEDED" ? { ...s, outdated: true } : s)) });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingAbout(false);
    }
  };

  const summaryAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const data = await call(`/api/team/recorded-lectures/${lecture.id}/summary`, "POST", { action, ...extra });
      if (data.lecture) onLecture(data.lecture);
      setEditing(null);
      toast.success(
        action === "generate" ? "Summary generated — review it, then approve." : action === "approve" ? "Summary approved." : action === "publish" ? "Summary published to students." : action === "unpublish" ? "Summary hidden from students." : "Draft saved."
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">edit_note</span>
            About this lecture
          </h3>
          <p className="text-xs text-slate-500 mt-1">Write what you taught. The lecture summary is made only from this — no PDF or PPT is needed.</p>
        </div>
        <ul className="grid gap-1 sm:grid-cols-2 text-xs text-slate-500 list-disc pl-5">
          {ABOUT_GUIDE.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <label htmlFor={`about-${lecture.id}`} className="sr-only">
          About this lecture
        </label>
        <textarea
          id={`about-${lecture.id}`}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={10}
          placeholder={"e.g.\nTopics: Ionic bond, covalent bond, Fajan's rule…\nFormula: Bond order = ½(Nb − Na)\nExample: why $\\text{AlCl}_3$ is covalent…\nCommon mistake: …\nHomework: NCERT exercise 4.1–4.10"}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono leading-relaxed"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-xs ${words < MIN_WORDS ? "text-amber-600" : "text-slate-500"}`}>
            {words} words{words < MIN_WORDS ? ` — at least ${MIN_WORDS} needed for a summary` : ""}
          </span>
          <button
            type="button"
            disabled={!aboutDirty || savingAbout}
            onClick={saveAbout}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2"
          >
            {savingAbout ? "Saving…" : aboutDirty ? "Save About" : "Saved"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">summarize</span>
            Lecture summary
          </h3>
          <button
            type="button"
            disabled={Boolean(busy) || aboutDirty || words < MIN_WORDS}
            onClick={() => summaryAction("generate")}
            title={aboutDirty ? "Save the About first" : words < MIN_WORDS ? `Write at least ${MIN_WORDS} words in the About` : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50 text-sm font-bold px-3 py-1.5"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            {busy === "generate" ? "Generating…" : working ? "Regenerate summary" : "Generate summary"}
          </button>
        </div>

        {published && (!working || working.id !== published.id) && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Students currently see version {published.revision}. The newer version below is not visible to them until you publish it.
          </p>
        )}

        {!working ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
            No summary yet. Save the About, then generate one. Students see nothing until you approve and publish it.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS_STYLE[working.status]}`}>{working.status}</span>
              {working.outdated && (
                <span className="rounded-full px-2 py-0.5 font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  OUTDATED — the About changed; regenerate before publishing
                </span>
              )}
              <span className="text-slate-500">
                Version {working.revision}
                {working.aiModel ? ` · ${working.aiProvider} ${working.aiModel}` : ""}
                {working.generatedAt ? ` · ${new Date(working.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}
              </span>
            </div>

            {editing === working.id ? (
              <div className="space-y-2">
                <label htmlFor={`sum-${working.id}`} className="sr-only">
                  Edit summary
                </label>
                <textarea
                  id={`sum-${working.id}`}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={14}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
                <p className="text-xs text-slate-500">Use ### for a heading, - for a point, - [ ] for a checklist item, $...$ for formulas.</p>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-3">
                  <SummaryView markdown={draftText} />
                </div>
              </div>
            ) : (
              <SummaryView markdown={working.content} />
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {editing === working.id ? (
                <>
                  <button
                    type="button"
                    disabled={Boolean(busy) || !draftText.trim()}
                    onClick={() => summaryAction("save", { summaryId: working.id, content: draftText })}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5"
                  >
                    {busy === "save" ? "Saving…" : "Save draft"}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold px-3 py-1.5">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {working.status !== "PUBLISHED" && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftText(working.content);
                        setEditing(working.id);
                      }}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold px-3 py-1.5"
                    >
                      Edit
                    </button>
                  )}
                  {working.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={Boolean(busy) || working.outdated}
                      onClick={() => summaryAction("approve", { summaryId: working.id })}
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5"
                    >
                      {busy === "approve" ? "Approving…" : "Approve"}
                    </button>
                  )}
                  {working.status === "APPROVED" && (
                    <button
                      type="button"
                      disabled={Boolean(busy) || working.outdated}
                      onClick={() => summaryAction("publish", { summaryId: working.id })}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5"
                    >
                      {busy === "publish" ? "Publishing…" : "Publish to students"}
                    </button>
                  )}
                  {working.status === "PUBLISHED" && (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => summaryAction("unpublish", { summaryId: working.id })}
                      className="rounded-lg border border-rose-300 text-rose-700 dark:text-rose-300 text-xs font-bold px-3 py-1.5"
                    >
                      {busy === "unpublish" ? "Hiding…" : "Unpublish"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
