"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SummaryView } from "./SummaryView";
import { HandwrittenNotes } from "./HandwrittenNotes";

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
  language?: string;
  source?: "ABOUT" | "VIDEO" | "TRANSLATION" | "VIDEO_TRANSLATION" | string;
  kind?: "SUMMARY" | "NOTES" | string;
};

export type AboutSummaryData = {
  id: string;
  language?: string;
  about: { content: string; revision: number; updatedAt: string | null };
  summaries: SummaryItem[];
};

type Lang = "hi" | "en";
type Kind = "SUMMARY" | "NOTES";
const langOf = (l: string | undefined): Lang => (/hindi|हिंदी|हिन्दी/i.test(String(l ?? "")) ? "hi" : "en");
const LANG_LABEL: Record<Lang, string> = { hi: "हिंदी", en: "English" };
const SOURCE_LABEL: Record<string, string> = {
  ABOUT: "from the About",
  VIDEO: "from the video",
  TRANSLATION: "translated (NCERT)",
  VIDEO_TRANSLATION: "from the video, translated (NCERT)",
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

const kindOf = (s: SummaryItem): Kind => (s.kind === "NOTES" ? "NOTES" : "SUMMARY");

/**
 * The teacher's About, the lecture summary and the class notes.
 *
 * Summary: made from the About or from the video (speech + board +
 * dictation). Notes: only what the teacher wrote on the board and dictated,
 * shown to students as a handwritten copy. Both stay drafts until reviewed,
 * approved and published; each language has its own published version.
 */
export function AboutSummaryPanel({
  lecture,
  onLecture,
  transcriptReady = false,
}: {
  lecture: AboutSummaryData;
  onLecture: (next: any) => void;
  /** The AI pass has read the video: notes and a video summary can be made. */
  transcriptReady?: boolean;
}) {
  const [about, setAbout] = useState(lecture.about.content);
  const [aboutRevision, setAboutRevision] = useState(lecture.about.revision);
  const [savingAbout, setSavingAbout] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const words = about.trim().split(/\s+/).filter(Boolean).length;
  const aboutDirty = about.trim() !== lecture.about.content.trim();

  const saveAbout = async () => {
    setSavingAbout(true);
    try {
      const data = await call(`/api/team/recorded-lectures/${lecture.id}/about`, "PUT", { content: about, baseRevision: aboutRevision });
      setAboutRevision(data.about.revision);
      toast.success(data.outdatedSummaries ? "About saved. The existing summary is now marked outdated — regenerate it." : "About saved.");
      onLecture({
        ...lecture,
        about: data.about,
        summaries: lecture.summaries.map((s) =>
          s.aboutRevision < data.about.revision && s.status !== "SUPERSEDED" && kindOf(s) === "SUMMARY" && (s.source === "ABOUT" || s.source === "TRANSLATION" || !s.source) ? { ...s, outdated: true } : s
        ),
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingAbout(false);
    }
  };

  /** Runs a summary/notes action; resolves true when it worked. */
  const act = async (key: string, action: string, extra: Record<string, unknown>, done: string) => {
    setBusy(key);
    try {
      const data = await call(`/api/team/recorded-lectures/${lecture.id}/summary`, "POST", { action, ...extra });
      if (data.lecture) onLecture(data.lecture);
      toast.success(done);
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <SummaryTrack
        kind="NOTES"
        lecture={lecture}
        busy={busy}
        act={act}
        title="Class notes (handwritten copy)"
        icon="stylus_note"
        intro="Everything the teacher wrote on the board and dictated (“ye likh lo…”), as a clean notebook page. Check it against the video, edit if needed, then approve and publish."
        generate={[
          {
            action: "generate-notes",
            label: "Create notes from video",
            icon: "stylus_note",
            disabled: !transcriptReady,
            title: transcriptReady ? "Made by ChatGPT from the board writing and dictation" : "Run “Process with AI” on the video first",
          },
        ]}
        emptyHint={transcriptReady ? "No notes yet. Press “Create notes from video”." : "No notes yet. First run “Process with AI” above — it reads the board and the dictation from the video."}
      />

      <section className="space-y-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">edit_note</span>
            About this lecture
          </h3>
          <p className="text-xs text-slate-500 mt-1">Write what you taught. A summary can be made from this (no PDF or PPT needed), or from the video itself after “Process with AI”.</p>
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

      <SummaryTrack
        kind="SUMMARY"
        lecture={lecture}
        busy={busy}
        act={act}
        title="Lecture summary"
        icon="summarize"
        generate={[
          {
            action: "generate-video",
            label: "Create summary from video",
            icon: "smart_display",
            disabled: !transcriptReady,
            title: transcriptReady ? "Made from what the teacher said, wrote and dictated" : "Run “Process with AI” on the video first",
          },
          {
            action: "generate",
            label: "Summary from About",
            icon: "auto_awesome",
            disabled: aboutDirty || words < MIN_WORDS,
            title: aboutDirty ? "Save the About first" : words < MIN_WORDS ? `Write at least ${MIN_WORDS} words in the About` : undefined,
            secondary: true,
          },
        ]}
        emptyHint="No summary yet. Create one from the video or from the About. Students see nothing until you approve and publish it."
      />
    </div>
  );
}

type GenerateButton = { action: string; label: string; icon: string; disabled: boolean; title?: string; secondary?: boolean };

/** One kind (summary or notes): language tabs, the working version, and its review buttons. */
function SummaryTrack({
  kind,
  lecture,
  busy,
  act,
  title,
  icon,
  intro,
  generate,
  emptyHint,
}: {
  kind: Kind;
  lecture: AboutSummaryData;
  busy: string | null;
  act: (key: string, action: string, extra: Record<string, unknown>, done: string) => Promise<boolean>;
  title: string;
  icon: string;
  intro?: string;
  generate: GenerateButton[];
  emptyHint: string;
}) {
  const ownLang = langOf(lecture.language);
  const [tab, setTab] = useState<Lang>(ownLang);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const noun = kind === "NOTES" ? "Notes" : "Summary";
  const Render = kind === "NOTES" ? HandwrittenNotes : SummaryView;

  const mine = lecture.summaries.filter((s) => kindOf(s) === kind);
  const inLang = (l: Lang) => mine.filter((s) => langOf(s.language ?? lecture.language) === l);
  const working = inLang(tab).find((s) => s.status !== "SUPERSEDED") ?? null;
  const published = inLang(tab).find((s) => s.status === "PUBLISHED") ?? null;
  const otherLang: Lang = tab === "hi" ? "en" : "hi";
  const hasLang = (l: Lang) => inLang(l).some((s) => s.status !== "SUPERSEDED");
  const key = (a: string) => `${kind}:${a}`;
  const isBusy = (a: string) => busy === key(a);

  const run = async (action: string, extra: Record<string, unknown>, done: string, then?: () => void) => {
    if (await act(key(action), action, extra, done)) {
      setEditing(null);
      then?.();
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">{icon}</span>
            {title}
          </h3>
          {intro && <p className="text-xs text-slate-500 mt-1 max-w-xl">{intro}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {generate.map((g) => (
            <button
              key={g.action}
              type="button"
              disabled={Boolean(busy) || g.disabled}
              onClick={() => run(g.action, {}, `${noun} created — review it, then approve.`, () => setTab(ownLang))}
              title={g.title}
              className={
                g.secondary
                  ? "inline-flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50 text-sm font-bold px-3 py-1.5"
                  : "inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-3 py-1.5"
              }
            >
              <span className="material-symbols-outlined text-base">{g.icon}</span>
              {isBusy(g.action) ? "Creating…" : g.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label={`${noun} language`} className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
        {(["hi", "en"] as Lang[])
          .sort((a, b) => Number(b === ownLang) - Number(a === ownLang))
          .map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={tab === l}
              onClick={() => {
                setTab(l);
                setEditing(null);
              }}
              className={`rounded-md px-3 py-1 text-xs font-bold ${tab === l ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
            >
              {LANG_LABEL[l]}
              {l === ownLang ? " (lecture)" : ""}
              {hasLang(l) ? "" : " · none"}
            </button>
          ))}
      </div>

      {published && (!working || working.id !== published.id) && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Students currently see version {published.revision}. The newer version below is not visible to them until you publish it.
        </p>
      )}

      {!working ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 space-y-3">
          {tab === ownLang ? (
            <p>{emptyHint}</p>
          ) : (
            <>
              <p>
                No {LANG_LABEL[tab]} version yet. Translate the {LANG_LABEL[otherLang]} one (NCERT terms, formulas kept as they are).
              </p>
              {(() => {
                const from = inLang(otherLang).find((s) => s.status !== "SUPERSEDED");
                return (
                  <button
                    type="button"
                    disabled={Boolean(busy) || !from}
                    onClick={() => from && run("translate", { summaryId: from.id, to: tab }, "Translation ready as a draft — review it, then approve and publish.")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-3 py-1.5"
                  >
                    <span className="material-symbols-outlined text-base">translate</span>
                    {isBusy("translate") ? "Translating…" : `Translate to ${LANG_LABEL[tab]}`}
                  </button>
                );
              })()}
            </>
          )}
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
              {working.source ? ` · ${SOURCE_LABEL[working.source] ?? working.source}` : ""}
              {working.aiModel ? ` · ${working.aiProvider} ${working.aiModel}` : ""}
              {working.generatedAt ? ` · ${new Date(working.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}
            </span>
          </div>

          {editing === working.id ? (
            <div className="space-y-2">
              <label htmlFor={`sum-${working.id}`} className="sr-only">
                Edit {noun.toLowerCase()}
              </label>
              <textarea
                id={`sum-${working.id}`}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={16}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-slate-500">
                ### heading · - point · 1. step · {kind === "NOTES" ? "> important line · [Diagram: …] · " : "- [ ] checklist · "}$...$ formula
              </p>
              <Render markdown={draftText} />
            </div>
          ) : (
            <Render markdown={working.content} />
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {editing === working.id ? (
              <>
                <button
                  type="button"
                  disabled={Boolean(busy) || !draftText.trim()}
                  onClick={() => run("save", { summaryId: working.id, content: draftText }, "Draft saved.")}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5"
                >
                  {isBusy("save") ? "Saving…" : "Save draft"}
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
                    onClick={() => run("approve", { summaryId: working.id }, `${noun} approved.`)}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5"
                  >
                    {isBusy("approve") ? "Approving…" : "Approve"}
                  </button>
                )}
                {working.status === "APPROVED" && (
                  <button
                    type="button"
                    disabled={Boolean(busy) || working.outdated}
                    onClick={() => run("publish", { summaryId: working.id }, `${noun} published to students.`)}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5"
                  >
                    {isBusy("publish") ? "Publishing…" : "Publish to students"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => run("translate", { summaryId: working.id, to: otherLang }, "Translation ready as a draft — review it, then approve and publish.", () => setTab(otherLang))}
                  title={`A new ${LANG_LABEL[otherLang]} draft in NCERT terms; formulas stay as they are`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold px-3 py-1.5"
                >
                  <span className="material-symbols-outlined text-sm">translate</span>
                  {isBusy("translate") ? "Translating…" : `Translate to ${LANG_LABEL[otherLang]}${hasLang(otherLang) ? " (new version)" : ""}`}
                </button>
                {working.status === "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => run("unpublish", { summaryId: working.id }, `${noun} hidden from students.`)}
                    className="rounded-lg border border-rose-300 text-rose-700 dark:text-rose-300 text-xs font-bold px-3 py-1.5"
                  >
                    {isBusy("unpublish") ? "Hiding…" : "Unpublish"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
