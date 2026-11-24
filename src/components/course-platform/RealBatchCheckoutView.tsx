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
  const [orderId, setOrderId] = useState<string | null>(null);

  // Coupon State
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    finalPayable: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Verify real server state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/batches/${batch.id}/order-status`);
        const body = await res.json();
        if (cancelled || !res.ok) return;
        if (body.data?.status === "SUCCESS") {
          setAmountPaid(body.data.amount ?? null);
          setResult("success");
        } else if (body.data?.status === "PENDING") {
          setResult("pending");
        }
      } catch {
        // Non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batch.id]);

  const payableAmount = appliedCoupon ? appliedCoupon.finalPayable : batch.price;
  const isFreeEnrollment = payableAmount === 0;

  const standardDiscount =
    batch.originalPrice && batch.originalPrice > batch.price
      ? batch.originalPrice - batch.price
      : 0;

  const discountPercent =
    batch.originalPrice && batch.originalPrice > batch.price
      ? Math.round((standardDiscount / batch.originalPrice) * 100)
      : null;

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponInput.trim(),
          batchId: batch.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setCouponError(json.error || "Invalid coupon code.");
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          code: json.data.code,
          discountAmount: json.data.discountAmount,
          finalPayable: json.data.finalPayable,
        });
        setCouponError(null);
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.");
    } finally {
      setIsValidatingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  async function handlePay() {
    setResult("processing");
    setErrorMessage(null);

    try {
      // 1. Create Order on Server
      const checkoutRes = await fetch(`/api/batches/${batch.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: appliedCoupon?.code || undefined,
        }),
      });
      const checkoutBody = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutBody.success) {
        throw new Error(checkoutBody.error ?? "Could not initiate checkout.");
      }

      const { razorpayOrderId, amount, isFree, batchOrderId } = checkoutBody.data;
      setOrderId(batchOrderId);

      // 2. Free Batch Enrollment (₹0) - Auto verify & activate
      if (isFree || amount === 0) {
        const verifyRes = await fetch(`/api/batches/${batch.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: "FREE_CLAIM",
            razorpay_signature: "FREE",
          }),
        });
        const verifyBody = await verifyRes.json();
        if (!verifyRes.ok || verifyBody.data?.status !== "SUCCESS") {
          throw new Error(verifyBody.error ?? "Failed to activate free enrollment.");
        }
        setAmountPaid(0);
        setResult("success");
        router.refresh();
        return;
      }

      // 3. Paid Online Gateway Flow
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Could not load payment gateway securely. Check your network connection.");
      }

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
            setErrorMessage("Payment verification failed — please contact support with your payment ID.");
          }
        },
        modal: {
          ondismiss: () => setResult("idle"),
        },
      });

      razorpay.on?.("payment.failed", (res: any) => {
        setResult("failed");
        setErrorMessage(res?.error?.description || "Payment failed or was declined by your bank.");
      });

      razorpay.open();
    } catch (err: any) {
      setResult("failed");
      setErrorMessage(err?.message || "Something went wrong during checkout.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#121c2c] py-6 sm:py-10 px-4 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation */}
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
            <span>256-Bit SSL Encrypted Checkout</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6 shadow-sm">
          {/* Product Header */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            {batch.thumbnailUrl ? (
              <img
                src={batch.thumbnailUrl}
                alt={batch.name}
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
            )}
            <div className="min-w-0">
              <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                Live Cohort Batch
              </span>
              <h4 className="font-black text-base text-[#031635] leading-snug mt-1">{batch.name}</h4>
              {batch.description && (
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{batch.description}</p>
              )}
            </div>
          </div>

          {/* Coupon Code Section */}
          <div className="pt-2">
            {!appliedCoupon ? (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter discount coupon code..."
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <button
                  type="submit"
                  disabled={isValidatingCoupon || !couponInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50 shrink-0"
                >
                  {isValidatingCoupon ? "Checking..." : "Apply"}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {appliedCoupon.code} (-₹{appliedCoupon.discountAmount.toLocaleString("en-IN")})
                  </span>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="text-slate-400 hover:text-rose-600 font-bold text-xs"
                >
                  Remove
                </button>
              </div>
            )}
            {couponError && (
              <p className="text-[11px] text-rose-600 font-medium mt-1.5 pl-1">{couponError}</p>
            )}
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-2 pt-4 border-t border-slate-100 text-xs">
            {batch.originalPrice && batch.originalPrice > batch.price && (
              <div className="flex justify-between text-slate-500">
                <span>Original Price</span>
                <span className="line-through font-mono">₹{batch.originalPrice.toLocaleString("en-IN")}</span>
              </div>
            )}
            {discountPercent && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Catalog Discount ({discountPercent}%)</span>
                <span className="font-mono">-₹{standardDiscount.toLocaleString("en-IN")}</span>
              </div>
            )}
            {appliedCoupon && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Coupon ({appliedCoupon.code})</span>
                <span className="font-mono">-₹{appliedCoupon.discountAmount.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-[#031635] pt-3 border-t border-slate-200">
              <span>Final Payable</span>
              <span className="font-mono">₹{payableAmount.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Alerts */}
          {result === "failed" && errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-rose-500 text-base shrink-0">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {result === "pending" && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-base shrink-0">pending</span>
              <span>A payment attempt is currently pending verification. You can retry safely below.</span>
            </div>
          )}

          {/* Pay Button */}
          <button
            type="button"
            onClick={handlePay}
            disabled={result === "processing" || result === "success"}
            className="w-full py-4 rounded-2xl bg-[#6b46c1] hover:bg-[#5b3da5] disabled:opacity-60 text-white font-black text-sm shadow-lg shadow-purple-500/25 transition flex items-center justify-center gap-2"
          >
            {result === "processing" ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>Confirming Enrollment...</span>
              </>
            ) : result === "success" ? (
              <span>Enrollment Activated</span>
            ) : isFreeEnrollment ? (
              <>
                <span>Enroll in Batch for Free</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </>
            ) : (
              <>
                <span>Pay ₹{payableAmount.toLocaleString("en-IN")} Securely</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </>
            )}
          </button>

          {/* Mandatory Compliance Policy Links */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400">
              By proceeding with this enrollment, you agree to our{" "}
              <Link href="/terms" target="_blank" className="text-slate-600 underline hover:text-primary">
                Terms of Service
              </Link>
              ,{" "}
              <Link href="/privacy" target="_blank" className="text-slate-600 underline hover:text-primary">
                Privacy Policy
              </Link>
              , and{" "}
              <Link href="/refund-policy" target="_blank" className="text-slate-600 underline hover:text-primary">
                Refund &amp; Cancellation Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {result === "success" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h3 className="text-xl font-black text-[#031635]">Enrollment Activated!</h3>
            <p className="text-xs text-slate-500">
              Welcome to <span className="font-bold text-purple-700">{batch.name}</span>. Your cohort access is now fully active.
            </p>
            {amountPaid != null && (
              <div className="p-4 rounded-2xl bg-slate-50 text-left text-xs space-y-1.5 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-[#031635]">₹{amountPaid.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Course Cohort:</span>
                  <span className="font-bold text-[#031635]">{batch.name}</span>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href={`/courses/${batch.id}`}
                className="w-full py-3.5 rounded-2xl bg-[#031635] text-white font-bold text-xs block transition shadow"
              >
                Go to Batch Classroom
              </Link>
              {orderId && (
                <Link
                  href={`/orders/${orderId}/receipt`}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs block hover:bg-slate-50 transition"
                >
                  View Tax Invoice &amp; Receipt
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
