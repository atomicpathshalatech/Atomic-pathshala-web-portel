"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const DEFAULT_TEMPLATE = `EMPLOYMENT AGREEMENT

This agreement confirms your engagement as an Educator with Atomic Pathshala.

1. Role & Department: [fill in]
2. Compensation: [fill in]
3. Working hours & schedule: [fill in]
4. Confidentiality & code of conduct: You agree to maintain confidentiality of student data and institute materials.
5. Term & termination: [fill in]

By signing below, you acknowledge you have read and agree to the above terms.`;

export function ContractComposeForm({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("Educator Employment Agreement");
  const [bodyText, setBodyText] = useState(DEFAULT_TEMPLATE);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, title, bodyText }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not send contract");
        return;
      }
      toast.success("Contract sent for e-signature");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass-card p-stack-lg rounded-xl space-y-4">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface">Contract Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface">Terms</label>
        <textarea
          rows={10}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send for e-Signature"}
      </button>
    </form>
  );
}
