"use client";

import { useState } from "react";
import { toast } from "sonner";

type Category = { id: string; name: string };
type Faq = { id: string; categoryId: string | null; question: string; answer: string; isPublished: boolean };

export function FaqManager({ initialCategories, initialFaqs }: { initialCategories: Category[]; initialFaqs: Faq[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [faqs, setFaqs] = useState(initialFaqs);
  const [newCategory, setNewCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      const res = await fetch("/api/admin/faq-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not create category.");
      setCategories((prev) => [...prev, json.data.category]);
      setNewCategory("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create category.");
    }
  }

  async function addFaq(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, categoryId: categoryId || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not create FAQ.");
      setFaqs((prev) => [...prev, json.data.faq]);
      toast.success("FAQ added");
      setQuestion(""); setAnswer("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create FAQ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePublished(id: string, isPublished: boolean) {
    try {
      const res = await fetch(`/api/admin/faqs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setFaqs((prev) => prev.map((f) => (f.id === id ? json.data.faq : f)));
    } catch {
      toast.error("Could not update FAQ.");
    }
  }

  async function removeFaq(id: string) {
    try {
      await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch {
      toast.error("Could not delete FAQ.");
    }
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  return (
    <div className="space-y-stack-md">
      <form onSubmit={addCategory} className="flex gap-2">
        <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        <button type="submit" className="px-4 py-2 rounded-lg text-label-md bg-surface-container-high text-on-surface hover:bg-primary/10 hover:text-primary">
          Add Category
        </button>
      </form>

      <form onSubmit={addFaq} className="glass-card rounded-2xl p-6 space-y-3">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md">
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        <textarea required value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="Answer" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        <button type="submit" disabled={submitting} className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md disabled:opacity-60">
          {submitting ? "Saving…" : "Add FAQ"}
        </button>
      </form>

      <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
        {faqs.length === 0 && <p className="p-8 text-center text-on-surface-variant font-body-md">No FAQs yet.</p>}
        {faqs.map((f) => (
          <div key={f.id} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-label-sm text-primary">{categoryName(f.categoryId)}</p>
              <p className="font-label-lg text-label-lg text-on-surface">{f.question}</p>
              <p className="text-label-sm text-on-surface-variant truncate">{f.answer}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => togglePublished(f.id, f.isPublished)}
                className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ${f.isPublished ? "bg-green-500/10 text-green-700" : "bg-surface-container-high text-on-surface-variant"}`}
              >
                {f.isPublished ? "Published" : "Hidden"}
              </button>
              <button onClick={() => removeFaq(f.id)} className="text-label-sm text-error hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
