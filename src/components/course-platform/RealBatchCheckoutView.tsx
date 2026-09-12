"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export type CheckoutBatch = {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  thumbnailUrl: string | null;
  description: string | null;
};

type ResultState = "idle" | "processing" | "success" | "pending" | "failed";

/**
 * Real, server-verified checkout for buying one specific batch — replaces
 * the old CheckoutView, which faked a "Payment Successful" state with a
 * setTimeout and never called any API. Every state shown here (success,
 * pending, failed) comes from the server's own response, never assumed
 * from the fact that the Razorpay widget's handler callback fired.
 */
export function RealBatchCheckoutView({
  batch,
  studentName,
  studentEmail,
}: {
  batch: CheckoutBatch;
  studentName: string;
  studentEmail: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ResultState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState<number | null>(null);

  // A student who lands here from a manually-typed/bookmarked success URL,
  // or after closing the tab mid-payment, should see the REAL current
  // state on load — never assume success just because this page rendered.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/batches/${batch.id}/order-status`);
        const body = await res.json();
        if (cancelled || !res.ok) return;
        if (body.data.status === "SUCCESS") {
          setAmountPaid(body.data.amount ?? null);
          setResult("success");
        } else if (body.data.status === "PENDING") {
          setResult("pending");
        }
      } catch {
        // Non-fatal — the page just shows the normal Buy Now state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batch.id]);

  const discountPercent =
    batch.originalPrice && batch.originalPrice > batch.price
      ? Math.round(((batch.originalPrice - batch.price) / batch.originalPrice) * 100)
      : null;

  async function handlePay() {
    setResult("processing");
    setErrorMessage(null);
    try {
      const checkoutRes = await fetch(`/api/batches/${batch.id}/checkout`, { method: "POST" });
      const checkoutBody = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutBody.error ?? "Could not start checkout");

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Could not load the payment widget. Check your connection.");

      const { razorpayOrderId, amount } = checkoutBody.data;

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: razorpayOrderId,
        amount: Math.round(amount * 100),
        currency: "INR",
        name: "Atomic Pathshala",
        description: batch.name,
        prefill: { name: studentName, email: studentEmail },
        theme: { color: "#6b46c1" },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(`/api/batches/${batch.id}/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyBody = await verifyRes.json();
            if (!verifyRes.ok || verifyBody.data?.status !== "SUCCESS") {
              setResult("failed");
              setErrorMessage(verifyBody.error ?? "Payment verification failed.");
              return;
            }
            setAmountPaid(amount);
            setResult("success");
            router.refresh();
          } catch {
            setResult("failed");
            setErrorMessage("Payment verification failed — please contact support with your payment details.");
          }
        },
        modal: {
          ondismiss: () => setResult("idle"),
        },
      });

      razorpay.on?.("payment.failed", () => {
        setResult("failed");
        setErrorMessage("Payment failed or was declined by your bank.");
      });

      razorpay.open();
    } catch (err) {
      setResult("failed");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#121c2c] py-6 sm:py-10 px-4 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/courses/${batch.id}`}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#031635] transition"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Back to Batch</span>
          </Link>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span>Secure Checkout via Razorpay</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6 shadow-sm">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            {batch.thumbnailUrl ? (
              <img
                src={batch.thumbnailUrl}
                alt={batch.name}
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
            )}
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-[#031635] leading-snug">{batch.name}</h4>
              {batch.description && (
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{batch.description}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
            {batch.originalPrice && batch.originalPrice > batch.price && (
              <div className="flex justify-between text-slate-500">
                <span>Original Price</span>
                <span className="line-through">₹{batch.originalPrice.toLocaleString("en-IN")}</span>
              </div>
            )}
            {discountPercent && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount ({discountPercent}%)</span>
                <span>-₹{(batch.originalPrice! - batch.price).toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-[#031635] pt-3 border-t border-slate-200">
              <span>Total Amount</span>
              <span>₹{batch.price.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {result === "failed" && errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {errorMessage}
            </div>
          )}

          {result === "pending" && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
              A previous payment for this batch is still pending verification. You can retry below.
            </div>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={result === "processing" || result === "success"}
            className="w-full py-3.5 rounded-2xl bg-[#6b46c1] hover:bg-[#5b3da5] disabled:opacity-60 text-white font-black text-sm shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2"
          >
            {result === "processing" ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>Processing Payment...</span>
              </>
            ) : result === "success" ? (
              <span>Payment Complete</span>
            ) : (
              <>
                <span>Pay ₹{batch.price.toLocaleString("en-IN")} Securely</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>

      {result === "success" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h3 className="text-xl font-black text-[#031635]">Payment Successful!</h3>
            <p className="text-xs text-slate-500">
              Welcome to <span className="font-bold text-blue-600">{batch.name}</span>. Your enrollment is
              now active.
            </p>
            {amountPaid != null && (
              <div className="p-4 rounded-2xl bg-slate-50 text-left text-xs space-y-1 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-[#031635]">₹{amountPaid.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}
            <Link
              href={`/courses/${batch.id}`}
              className="w-full py-3.5 rounded-2xl bg-[#031635] text-white font-bold text-xs block transition shadow"
            >
              Go to Batch
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
