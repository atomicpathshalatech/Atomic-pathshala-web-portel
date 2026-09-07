"use client";

import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CoachMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

export function CoachScreen() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai-chat/coach", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load your coach chat.");
        return res.json() as Promise<{ messages: CoachMessage[] }>;
      })
      .then((body) => setMessages(body.messages))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your coach chat."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setError(null);

    // Optimistic user bubble while waiting for the real (persisted) pair.
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: "USER", content: text, createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/ai-chat/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        body.userMessage,
        body.coachMessage,
      ]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col bg-gradient-to-b from-orange-50/40 to-white dark:from-slate-950 dark:to-atomic-navy">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 flex-1 flex flex-col">
        <div className="mb-4">
          <p className="text-sm font-medium text-atomic-orange">Atomic Pathshala</p>
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-atomic-orange" />
            Your Progress Coach
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Talk about how your prep is going — grounded in your real accuracy, streak and study plan.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Say hi, or ask something like &ldquo;how am I doing this week?&rdquo;
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "USER"
                      ? "bg-atomic-orange text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask your coach anything about your progress…"
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-atomic-orange/40"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-atomic-orange p-2.5 text-white hover:bg-atomic-orange-dark disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  );
}
