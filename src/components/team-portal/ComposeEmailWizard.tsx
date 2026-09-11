"use client";

import { useState, useEffect, useCallback } from "react";

type Batch = { id: string; name: string };
type Teacher = { id: string; name: string };
type Template = { id: string; key: string; name: string; category: string; subject: string; bodyHtml: string };

const GROUPS: { value: string; label: string; needsBatch?: boolean; needsTeacher?: boolean }[] = [
  { value: "ALL_STUDENTS", label: "All Students" },
  { value: "ALL_STAFF", label: "All Staff" },
  { value: "BATCH", label: "Selected Batch", needsBatch: true },
  { value: "TEACHER", label: "Selected Teacher", needsTeacher: true },
];

export function ComposeEmailWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [group, setGroup] = useState("ALL_STUDENTS");
  const [batchId, setBatchId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sample, setSample] = useState<{ name: string; email: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team/communication/recipients/students?limit=1")
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        setBatches(j.data.filterOptions.batches);
        setTeachers(j.data.filterOptions.teachers);
      });
    fetch("/api/team/communication/templates")
      .then((r) => r.json())
      .then((j) => j.success && setTemplates(j.data.templates.filter((t: Template & { isActive: boolean }) => t.isActive)));
  }, []);

  const groupDef = GROUPS.find((g) => g.value === group)!;

  const runPreview = useCallback(async () => {
    setBusy(true);
    const res = await fetch("/api/team/communication/campaigns/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientGroup: group, batchId: groupDef.needsBatch ? batchId : undefined, teacherId: groupDef.needsTeacher ? teacherId : undefined }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.success) {
      setPreviewCount(json.data.count);
      setSample(json.data.sample);
      setStep(2);
    } else {
      alert(json.error || "Could not preview recipients.");
    }
  }, [group, batchId, teacherId, groupDef]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBodyHtml(t.bodyHtml);
    }
  }

  async function confirmSend() {
    if (!confirm(`Send this email to ${previewCount} recipient${previewCount === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch("/api/team/communication/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subject.slice(0, 100) || "Untitled campaign",
        recipientGroup: group,
        batchId: groupDef.needsBatch ? batchId : undefined,
        teacherId: groupDef.needsTeacher ? teacherId : undefined,
        subject,
        bodyHtml,
        templateId: templateId || undefined,
        confirmedRecipientCount: previewCount,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.success) {
      setResult(`Campaign "${json.data.campaign.name}" created — ${previewCount} recipients queued.`);
      setStep(1);
      setSubject("");
      setBodyHtml("");
      setPreviewCount(null);
    } else {
      alert(json.error || "Send failed.");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          {result}
        </div>
      )}

      {/* Step 1: recipients */}
      <section className={`rounded-2xl border p-5 ${step === 1 ? "border-primary" : "border-slate-200 dark:border-slate-700"}`}>
        <h2 className="font-bold text-slate-900 dark:text-white mb-3">1. Recipients</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGroup(g.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                group === g.value
                  ? "bg-primary text-white border-primary"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {groupDef.needsBatch && (
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="">Select a batch…</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {groupDef.needsTeacher && (
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="">Select a teacher…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {step === 1 && (
          <button
            onClick={runPreview}
            disabled={busy || (groupDef.needsBatch && !batchId) || (groupDef.needsTeacher && !teacherId)}
            className="mt-3 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white disabled:opacity-40"
          >
            {busy ? "Checking…" : "Preview recipients"}
          </button>
        )}
        {previewCount !== null && (
          <div className="mt-3 text-xs text-slate-500">
            <b>{previewCount}</b> recipient{previewCount === 1 ? "" : "s"} match.
            {sample.length > 0 && <span> e.g. {sample.map((s) => s.name).join(", ")}…</span>}
          </div>
        )}
      </section>

      {/* Step 2: compose */}
      {step >= 2 && (
        <section className={`rounded-2xl border p-5 ${step === 2 ? "border-primary" : "border-slate-200 dark:border-slate-700"}`}>
          <h2 className="font-bold text-slate-900 dark:text-white mb-3">2. Compose</h2>
          <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="">— Start from a template (optional) —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="Email body (HTML). Use {{recipient_name}} etc."
            rows={8}
            className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
          />
          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!subject || !bodyHtml}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white disabled:opacity-40"
            >
              Preview & Confirm
            </button>
          )}
        </section>
      )}

      {/* Step 3: confirm */}
      {step === 3 && (
        <section className="rounded-2xl border border-primary p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-3">3. Confirm</h2>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm mb-3">
            <div className="font-semibold">{subject}</div>
            <div className="mt-1 text-xs text-slate-500 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </div>
          <button
            onClick={confirmSend}
            disabled={busy}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-rose-600 text-white disabled:opacity-40"
          >
            {busy ? "Sending…" : `Send to ${previewCount} Recipient${previewCount === 1 ? "" : "s"}`}
          </button>
        </section>
      )}
    </div>
  );
}
