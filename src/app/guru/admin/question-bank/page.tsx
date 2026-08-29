"use client";

import { useCallback, useEffect, useState } from "react";
import { useAiChatUser } from "@/components/ai-chat/AiChatUserContext";

interface BankQuestion {
  id: string;
  subject: string;
  chapter: string | null;
  topic: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string | null;
  questionType?: string | null;
  language: string;
  source: string;
  timesUsed: number;
  createdAt: string;
}

interface ApiResponse {
  questions: BankQuestion[];
  total: number;
  page: number;
  pageSize: number;
  filters: { subjects: string[]; chapters: string[]; topics: string[] };
  error?: string;
}

export default function QuestionBankAdminPage() {
  const { user } = useAiChatUser();
  const isAdmin = user.isAdmin;
  const canView = user.isQuestionBankViewer;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<BankQuestion>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (subject) params.set("subject", subject);
      if (chapter) params.set("chapter", chapter);
      if (topic) params.set("topic", topic);
      if (difficulty) params.set("difficulty", difficulty);
      if (questionType) params.set("questionType", questionType);
      params.set("page", String(page));

      const res = await fetch(`/api/ai-chat/admin/question-bank?${params.toString()}`);
      const json = (await res.json()) as ApiResponse;

      if (!res.ok) {
        setError(json.error ?? "Could not load question bank.");
        return;
      }
      setData(json);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [search, subject, chapter, topic, difficulty, questionType, page]);

  useEffect(() => {
    if (canView) void load();
  }, [load, canView]);

  const submitReport = async (id: string) => {
    if (!reportReason.trim()) return;
    await fetch("/api/ai-chat/admin/question-bank/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionBankId: id, reason: reportReason.trim() }),
    });
    setReportingId(null);
    setReportReason("");
    alert("Report submitted to Admin.");
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question permanently?")) return;
    await fetch(`/api/ai-chat/admin/question-bank?id=${id}`, { method: "DELETE" });
    void load();
  };

  const startEdit = (q: BankQuestion) => {
    setEditingId(q.id);
    setEditDraft({ ...q });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch("/api/ai-chat/admin/question-bank", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editDraft }),
    });
    setEditingId(null);
    void load();
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-slate-500">
          Question Bank access is limited to Teachers and Admins.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Question Bank</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        All questions automatically saved from generated quizzes.
        {data && ` ${data.total} total questions.`}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search question text/topic..."
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800 sm:col-span-3"
        />
        <select
          value={subject}
          onChange={(e) => {
            setPage(1);
            setSubject(e.target.value);
            setChapter("");
            setTopic("");
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Subjects</option>
          {data?.filters.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={chapter}
          onChange={(e) => {
            setPage(1);
            setChapter(e.target.value);
            setTopic("");
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Chapters</option>
          {data?.filters.chapters.map((c) => (
            <option key={c} value={c ?? ""}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={topic}
          onChange={(e) => {
            setPage(1);
            setTopic(e.target.value);
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Topics</option>
          {data?.filters.topics.map((t) => (
            <option key={t} value={t ?? ""}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => {
            setPage(1);
            setDifficulty(e.target.value);
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <select
          value={questionType}
          onChange={(e) => {
            setPage(1);
            setQuestionType(e.target.value);
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Formats</option>
          <option value="single_correct">Single Correct MCQ</option>
          <option value="table_based">Table-based</option>
          <option value="assertion_reason">Assertion-Reason</option>
          <option value="statement_based">Statement-based</option>
          <option value="two_statement">Two-Statement</option>
          <option value="match_2_column">Match Column (2)</option>
          <option value="match_3_column">Match Column (3)</option>
          <option value="match_conceptual">Match Conceptual</option>
          <option value="sequence">Sequence</option>
          <option value="correct_incorrect">Correct/Incorrect</option>
          <option value="except">EXCEPT type</option>
          <option value="numerical">Numerical</option>
          <option value="diagram_based">Diagram-based</option>
          <option value="figure_table">Figure + Table</option>
          <option value="flowchart">Flowchart</option>
          <option value="multi_statement_combination">Multi-Statement</option>
          <option value="concept_table">Concept + Table</option>
          <option value="image_statement">Image + Statement</option>
          <option value="graph_based">Graph-based</option>
          <option value="case_based">Case-based</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <>
          <div className="space-y-2">
            {data?.questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {q.subject}
                  </span>
                  {q.chapter && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {q.chapter}
                    </span>
                  )}
                  {q.topic && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {q.topic}
                    </span>
                  )}
                  {q.difficulty && (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 font-medium text-atomic-orange dark:bg-orange-950/20">
                      {q.difficulty}
                    </span>
                  )}
                  <span className="ml-auto text-slate-400">Used {q.timesUsed}x</span>
                </div>

                {editingId === q.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDraft.text ?? ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      rows={3}
                    />
                    {editDraft.options?.map((opt, i) => (
                      <input
                        key={i}
                        value={opt}
                        onChange={(e) =>
                          setEditDraft((d) => {
                            const options = [...(d.options ?? [])];
                            options[i] = e.target.value;
                            return { ...d, options };
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    ))}
                    <select
                      value={editDraft.correctIndex ?? 0}
                      onChange={(e) => setEditDraft((d) => ({ ...d, correctIndex: Number(e.target.value) }))}
                      className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <option key={i} value={i}>
                          Correct: {String.fromCharCode(65 + i)}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={editDraft.explanation ?? ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, explanation: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="rounded-lg bg-atomic-orange px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                      className="text-left text-sm font-medium text-slate-900 hover:text-atomic-orange dark:text-white"
                    >
                      {q.text}
                    </button>

                    {expandedId === q.id && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                        {q.options.map((opt, i) => (
                          <p
                            key={i}
                            className={`rounded-lg px-2.5 py-1 text-xs ${
                              i === q.correctIndex
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                                : "text-slate-500"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}. {opt}
                          </p>
                        ))}
                        <p className="pt-2 text-xs text-slate-600 dark:text-slate-300">{q.explanation}</p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => startEdit(q)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteQuestion(q.id)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 dark:border-red-900"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setReportingId(reportingId === q.id ? null : q.id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700"
                      >
                        Report Issue
                      </button>
                    </div>

                    {reportingId === q.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          placeholder="What's wrong with this question?"
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <button
                          onClick={() => submitReport(q.id)}
                          className="rounded-lg bg-atomic-orange px-3 py-1 text-xs font-semibold text-white"
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {data?.questions.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No questions found.</p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Previous
            </button>
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}