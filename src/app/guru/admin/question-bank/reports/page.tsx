"use client";

import { useEffect, useState } from "react";
import { useAiChatUser } from "@/components/ai-chat/AiChatUserContext";

interface Report {
  id: string;
  reason: string | null;
  status: string;
  createdAt: string;
  user: { name: string | null; email: string } | null;
  question: { id: string; text: string; subject: string } | null;
}

export default function GuruQuestionReportsPage() {
  const { user } = useAiChatUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.isAdmin) {
      setLoading(false);
      return;
    }
    fetch("/api/ai-chat/admin/question-bank/report")
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, [user.isAdmin]);

  if (!user.isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-slate-500">Question error reports are limited to Admins.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
        Question Error Reports
      </h1>
      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-400">No open reports.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-1 text-xs text-slate-400">
                Reported by {r.user?.name || r.user?.email} on {new Date(r.createdAt).toLocaleString()}
              </p>
              <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">
                {r.question?.text}
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">Issue: {r.reason}</p>
                {r.question && (
                <a
                  href={`/guru/admin/question-bank?search=${encodeURIComponent(r.question.text.slice(0, 30))}`}
                  className="mt-2 inline-block text-xs font-semibold text-atomic-orange"
                >
                  Open question →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
