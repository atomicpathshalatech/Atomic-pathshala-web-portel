"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    setMessage(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("done");
        setMessage(data.message || "Subscribed successfully!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Could not subscribe. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again later.");
    }
  }

  return (
    <form onSubmit={handleSubscribe} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="bg-surface-variant/10 border-none rounded-lg flex-1 text-label-sm font-label-sm py-3 px-4 focus:ring-2 focus:ring-primary text-surface-container-lowest placeholder-surface-variant/50"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          aria-label="Subscribe"
          className="bg-primary text-on-primary p-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined">{status === "done" ? "check" : "send"}</span>
        </button>
      </div>
      {message && (
        <p className={`text-xs ${status === "done" ? "text-primary" : "text-error"}`}>{message}</p>
      )}
    </form>
  );
}
