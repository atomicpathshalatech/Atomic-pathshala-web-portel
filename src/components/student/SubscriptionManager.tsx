"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";
type Plan = "BASIC" | "PRO";

type SubscriptionData = {
  id: string;
  plan: Plan;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  billingCycle: BillingCycle;
  pendingPlan: Plan | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
} | null;

const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: "Monthly (auto-renews)",
  QUARTERLY: "3 months",
  HALF_YEARLY: "6 months",
  ANNUAL: "1 year",
};

const PLAN_LABELS: Record<Plan, string> = { BASIC: "Basic", PRO: "Pro" };

const PRO_ONLY_FEATURES = [
  "1:1 Mentorship",
  "NEET UG Assure*",
  "Dedicated Batch WhatsApp Community",
  "SRG NCERT Weekly + Revision Test Series",
];

const CORE_FEATURES = [
  "All Past, Ongoing & Upcoming Batches",
  "Crash Courses",
  "All Test Series (PYQ, Educator, Batch)",
  "Doubt Solving Sessions & Ask a Doubt",
  "Full Syllabus Digital Notes & Practice Modules",
  "15K+ Question Bank with Detailed Solutions",
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function SubscriptionManager({
  initialSubscription,
  studentName,
  studentEmail,
}: {
  initialSubscription: SubscriptionData;
  studentName: string;
  studentEmail: string;
}) {
  const router = useRouter();
  const [subscription, setSubscription] = useState(initialSubscription);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  // Coupons only apply to one-time (non-MONTHLY) checkouts — see the
  // Coupon model's doc comment in schema.prisma for why. The field is
  // simply hidden for MONTHLY rather than shown-but-disabled, so there's
  // nothing to explain until it's actually usable.
  const [couponCode, setCouponCode] = useState("");

  const isEntitled = Boolean(
    subscription &&
      (subscription.status === "TRIAL" ||
        subscription.status === "ACTIVE" ||
        subscription.status === "PAST_DUE")
  );

  async function startTrial(plan: Plan) {
    setLoadingAction(`trial-${plan}`);
    try {
      const res = await fetch("/api/subscriptions/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start trial");

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Could not load the payment widget. Check your connection.");

      const { razorpaySubscriptionId, trialEndsAt } = body.data;

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: razorpaySubscriptionId,
        name: "Atomic Pathshala",
        description: `${PLAN_LABELS[plan]} plan — 7-day free trial, then auto-renews monthly`,
        prefill: { name: studentName, email: studentEmail },
        theme: { color: "#4f46e5" },
        handler: async (response: any) => {
          const confirmRes = await fetch("/api/subscriptions/trial/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const confirmBody = await confirmRes.json();
          if (!confirmRes.ok) {
            toast.error(confirmBody.error ?? "Could not confirm trial");
            return;
          }
          setSubscription(confirmBody.data.subscription);
          const trialEndDate = new Date(trialEndsAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          });
          toast.success(`Card verified — your free trial runs till ${trialEndDate}`);
          router.refresh();
        },
        modal: {
          // Nothing was persisted yet at this point, so closing the modal
          // without completing just resets the UI — no cleanup needed.
          ondismiss: () => setLoadingAction(null),
        },
      });

      razorpay.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setLoadingAction(null);
    }
  }

  async function subscribeToPlan(plan: Plan, cycle: BillingCycle) {
    setLoadingAction(`checkout-${plan}-${cycle}`);
    try {
      const trimmedCoupon = cycle !== "MONTHLY" ? couponCode.trim() : "";
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingCycle: cycle,
          ...(trimmedCoupon ? { couponCode: trimmedCoupon } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start checkout");

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Could not load the payment widget. Check your connection.");

      const { type, razorpaySubscriptionId, razorpayOrderId, amount } = body.data;

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        name: "Atomic Pathshala",
        description: `${PLAN_LABELS[plan]} plan — ${CYCLE_LABELS[cycle]}`,
        ...(type === "subscription"
          ? { subscription_id: razorpaySubscriptionId }
          : { order_id: razorpayOrderId, amount: Math.round(amount * 100), currency: "INR" }),
        prefill: { name: studentName, email: studentEmail },
        theme: { color: "#4f46e5" },
        handler: async (response: any) => {
          if (type === "order") {
            // Recurring subscriptions are confirmed by the webhook instead —
            // only fixed-duration orders need this client-side verify step.
            const verifyRes = await fetch("/api/subscriptions/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyBody = await verifyRes.json();
            if (!verifyRes.ok) {
              toast.error(verifyBody.error ?? "Payment verification failed");
              return;
            }
            setSubscription(verifyBody.data.subscription);
          }
          toast.success("Payment received — your plan is now active");
          router.refresh();
        },
        modal: {
          ondismiss: () => setLoadingAction(null),
        },
      });

      razorpay.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setLoadingAction(null);
    }
  }

  async function changePlan(plan: Plan) {
    setLoadingAction(`change-${plan}`);
    try {
      const res = await fetch("/api/subscriptions/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not change plan");
      setSubscription(body.data.subscription);
      toast.success(body.data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingAction(null);
    }
  }

  async function cancel() {
    setLoadingAction("cancel");
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not cancel");
      setSubscription(body.data.subscription);
      toast.success("Your subscription will end at the close of the current period.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-stack-lg">
      {/* Current status */}
      {isEntitled && subscription && (
        <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">
              Current plan
            </p>
            <p className="font-headline-md text-headline-md text-primary">
              {PLAN_LABELS[subscription.plan]}{" "}
              <span className="text-label-sm font-label-sm text-on-surface-variant">
                ({subscription.status === "TRIAL" ? "Free trial" : subscription.status})
              </span>
            </p>
            {subscription.pendingPlan && (
              <p className="text-label-sm font-label-sm text-tertiary mt-1">
                Switching to {PLAN_LABELS[subscription.pendingPlan]} next billing cycle
              </p>
            )}
            <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">
              {subscription.status === "TRIAL" ? "Trial ends" : "Renews / expires"}{" "}
              {new Date(
                subscription.status === "TRIAL" && subscription.trialEndsAt
                  ? subscription.trialEndsAt
                  : subscription.currentPeriodEnd
              ).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {subscription.cancelAtPeriodEnd && " — cancels then"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/subscription/billing"
              className="font-label-md text-label-md text-primary hover:underline"
            >
              Billing history
            </Link>
            {!subscription.cancelAtPeriodEnd && subscription.status !== "TRIAL" && (
              <button
                onClick={cancel}
                disabled={loadingAction === "cancel"}
                className="font-label-md text-label-md text-error hover:underline disabled:opacity-50"
              >
                {loadingAction === "cancel" ? "Cancelling…" : "Cancel subscription"}
              </button>
            )}
          </div>
        </div>
      )}

      {!isEntitled && (
        <div className="flex justify-end">
          <Link
            href="/subscription/billing"
            className="font-label-md text-label-md text-primary hover:underline"
          >
            Billing history
          </Link>
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CYCLE_LABELS) as BillingCycle[]).map((cycle) => (
          <button
            key={cycle}
            onClick={() => setBillingCycle(cycle)}
            className={`px-4 py-2 rounded-full font-label-md text-label-md transition-colors ${
              billingCycle === cycle
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-primary/5"
            }`}
          >
            {CYCLE_LABELS[cycle]}
          </button>
        ))}
      </div>

      {/* Coupon code — one-time (non-MONTHLY) checkouts only */}
      {billingCycle !== "MONTHLY" && !isEntitled && (
        <div className="flex items-center gap-2 max-w-sm">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Have a coupon code?"
            className="flex-1 rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary uppercase placeholder:normal-case"
          />
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <PlanCard
          plan="BASIC"
          features={CORE_FEATURES}
          isCurrent={isEntitled && subscription?.plan === "BASIC"}
          billingCycle={billingCycle}
          hasSubscription={!!isEntitled}
          loadingAction={loadingAction}
          onStartTrial={() => startTrial("BASIC")}
          onSubscribe={() => subscribeToPlan("BASIC", billingCycle)}
          onSwitch={() => changePlan("BASIC")}
        />
        <PlanCard
          plan="PRO"
          features={[...CORE_FEATURES, ...PRO_ONLY_FEATURES]}
          isCurrent={isEntitled && subscription?.plan === "PRO"}
          billingCycle={billingCycle}
          hasSubscription={!!isEntitled}
          loadingAction={loadingAction}
          onStartTrial={() => startTrial("PRO")}
          onSubscribe={() => subscribeToPlan("PRO", billingCycle)}
          onSwitch={() => changePlan("PRO")}
          highlight
        />
      </div>

      <p className="text-label-sm font-label-sm text-on-surface-variant">
        *NEET UG Assure terms apply. Prices shown are placeholders and may change.
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  features,
  isCurrent,
  billingCycle,
  hasSubscription,
  loadingAction,
  onStartTrial,
  onSubscribe,
  onSwitch,
  highlight,
}: {
  plan: Plan;
  features: string[];
  isCurrent?: boolean;
  billingCycle: BillingCycle;
  hasSubscription: boolean;
  loadingAction: string | null;
  onStartTrial: () => void;
  onSubscribe: () => void;
  onSwitch: () => void;
  highlight?: boolean;
}) {
  const trialBusy = loadingAction === `trial-${plan}`;
  const checkoutBusy = loadingAction === `checkout-${plan}-${billingCycle}`;
  const switchBusy = loadingAction === `change-${plan}`;

  return (
    <div
      className={`glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-4 ${
        highlight ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-headline-lg text-headline-lg">{PLAN_LABELS[plan]}</h3>
        {isCurrent && (
          <span className="text-label-sm font-label-sm px-2.5 py-1 rounded-full bg-tertiary-container/10 text-tertiary">
            Current plan
          </span>
        )}
      </div>

      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 font-body-md text-body-md">
            <span className="material-symbols-outlined text-primary text-lg shrink-0">check_circle</span>
            {f}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="text-center text-label-md font-label-md text-on-surface-variant">
          You&apos;re on this plan
        </div>
      ) : hasSubscription ? (
        <button
          onClick={onSwitch}
          disabled={switchBusy}
          className="w-full py-3 rounded-full font-label-lg text-label-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {switchBusy ? "Scheduling…" : `Switch to ${PLAN_LABELS[plan]} next cycle`}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={onSubscribe}
            disabled={checkoutBusy}
            className={`w-full py-3 rounded-full font-label-lg text-label-lg transition-colors disabled:opacity-50 ${
              highlight
                ? "bg-primary text-on-primary hover:opacity-90"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {checkoutBusy ? "Opening checkout…" : `Subscribe to ${PLAN_LABELS[plan]}`}
          </button>
          <button
            onClick={onStartTrial}
            disabled={trialBusy}
            className="w-full py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
          >
            {trialBusy ? "Opening checkout…" : "or start 7-day free trial (card required)"}
          </button>
        </div>
      )}
    </div>
  );
}
