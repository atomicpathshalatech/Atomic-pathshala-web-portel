"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { humanize } from "./QuestionReviewParts";

type CollectionRow = { id: string; name: string; description: string | null; count: number; updatedAt: string };
type CollectionQuestion = { id: string; questionCode: string | null; subject: string; chapter: string | null; type: string; status: string; addedAt: string; preview: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status})`);
  return body.data as T;
}

/** Collections of questions: make, rename and delete them; see and remove their questions. */
export function QuestionCollectionsWorkspace({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<CollectionRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<CollectionQuestion[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await api<{ collections: CollectionRow[] }>("/api/team/question-collections")).collections);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load collections");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: string) => {
    setOpenId(id);
    setQuestions(null);
    try {
      setQuestions((await api<{ collection: { questions: CollectionQuestion[] } }>(`/api/team/question-collections/${id}`)).collection.questions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the collection");
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/team/question-collections", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      setName("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the collection");
    } finally {
      setBusy(false);
    }
  };

  const removeQuestion = async (questionId: string) => {
    if (!openId) return;
    try {
      await api(`/api/team/question-collections/${openId}`, { method: "POST", body: JSON.stringify({ questionId, action: "remove" }) });
      setQuestions((q) => q?.filter((x) => x.id !== questionId) ?? null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove it");
    }
  };

  const deleteCollection = async (id: string) => {
    try {
      await api(`/api/team/question-collections/${id}`, { method: "DELETE" });
      if (openId === id) {
        setOpenId(null);
        setQuestions(null);
      }
      setConfirmDelete(null);
      await load();
      toast.success("Collection deleted. Its questions are still in the Question Bank.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete it");
    }
  };

  const current = rows?.find((r) => r.id === openId) ?? null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Question Collections</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your own sets of questions — for a test you are building, tricky questions to revisit, a topic pool. Add a question from its review page (“Add to collection”). Deleting a collection never deletes its questions.
        </p>
      </div>

      {canEdit && (
        <div className="flex gap-2 max-w-md">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void create()}
            placeholder="New collection name"
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <button type="button" disabled={busy || !name.trim()} onClick={() => void create()} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">
            Create
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-2">
          {rows === null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400">No collections yet.</p>
          ) : (
            rows.map((c) => (
              <div
                key={c.id}
                className={`rounded-2xl border p-3 flex items-center gap-3 ${openId === c.id ? "border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`}
              >
                <button type="button" onClick={() => void open(c.id)} className="flex-1 min-w-0 text-left">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">📁 {c.name}</div>
                  <div className="text-xs text-slate-500">{c.count} question{c.count === 1 ? "" : "s"}</div>
                </button>
                {canEdit &&
                  (confirmDelete === c.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button type="button" onClick={() => void deleteCollection(c.id)} className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold">Delete</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded-lg border border-slate-300">Keep</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(c.id)} className="text-xs text-slate-400 hover:text-rose-600" title="Delete this collection (its questions stay)">
                      Delete
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 min-h-[12rem]">
          {!current ? (
            <p className="text-sm text-slate-400">Open a collection to see its questions.</p>
          ) : (
            <div className="space-y-3">
              <h2 className="font-bold text-slate-900 dark:text-white">{current.name}</h2>
              {questions === null ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : questions.length === 0 ? (
                <p className="text-sm text-slate-400">No questions in this collection yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {questions.map((q) => (
                    <li key={q.id} className="py-2.5 flex items-start gap-3">
                      <Link href={`/team/questions/${q.id}/review`} className="flex-1 min-w-0 group">
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
                          <span className="font-mono font-semibold text-blue-600 group-hover:underline">{q.questionCode || q.id.slice(-8)}</span>
                          <span>{q.subject}</span>
                          {q.chapter && <span>· {q.chapter}</span>}
                          <span>· {humanize(q.type)}</span>
                          <span>· {humanize(q.status)}</span>
                        </div>
                        <div className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">{q.preview || "(no text)"}</div>
                      </Link>
                      {canEdit && (
                        <button type="button" onClick={() => void removeQuestion(q.id)} className="text-xs text-slate-400 hover:text-rose-600 shrink-0" title="Take out of this collection (the question is not deleted)">
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
