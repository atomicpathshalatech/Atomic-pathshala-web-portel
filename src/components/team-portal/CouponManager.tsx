"use client";

import { useState } from "react";
import { toast } from "sonner";

type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  plan: "BASIC" | "PRO" | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export function CouponManager({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [value, setValue] = useState("");
  const [plan, setPlan] = useState<"" | "BASIC" | "PRO">("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          value: Number(value),
          ...(plan ? { plan } : {}),
          ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not create this coupon.");
        return;
      }
      setCoupons((prev) => [json.data.coupon, ...prev]);
      toast.success(`Coupon ${json.data.coupon.code} created`);
      setShowForm(false);
      setCode("");
      setValue("");
      setPlan("");
      setMaxRedemptions("");
      setExpiresAt("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    const res = await fetch(`/api/team/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Could not update this coupon.");
      return;
    }
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? json.data.coupon : c)));
  }

  return (
    <div className="space-y-stack-lg">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          New Coupon
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCoupon} className="glass-card rounded-2xl p-6 space-y-4">
          {error && <p className="text-label-sm text-error bg-error/10 rounded-lg py-2 px-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="NEET25"
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 uppercase font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "PERCENT" | "FLAT")}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="PERCENT">Percent off</option>
                <option value="FLAT">Flat amount off (₹)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">
                Value {type === "PERCENT" ? "(%)" : "(₹)"}
              </label>
              <input
                type="number"
                required
                min={1}
                max={type === "PERCENT" ? 100 : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Plan (optional)</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as "" | "BASIC" | "PRO")}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Either plan</option>
                <option value="BASIC">Basic only</option>
                <option value="PRO">Pro only</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Max redemptions (optional)</label>
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Expires (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <p className="text-label-sm text-on-surface-variant">
            Coupons only work on one-time checkouts (Quarterly / Half-Yearly / Annual) — not the
            auto-renewing Monthly plan.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create coupon"}
          </button>
        </form>
      )}

      {coupons.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No coupons created yet.
        </div>
      ) : (
        <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
          {coupons.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-label-lg text-label-lg text-on-surface">{c.code}</p>
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  {c.type === "PERCENT" ? `${c.value}% off` : `₹${c.value} off`}
                  {c.plan ? ` · ${c.plan} plan only` : " · either plan"}
                  {" · "}
                  {c.redeemedCount}
                  {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""} used
                  {c.expiresAt &&
                    ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    c.isActive ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {c.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleActive(c)}
                  className="text-label-md text-primary hover:underline"
                >
                  {c.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
