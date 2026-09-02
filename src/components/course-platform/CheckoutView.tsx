"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CourseData } from "./CourseCard";

export function CheckoutView({ course }: { course: CourseData }) {
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const basePrice = course.originalPrice;
  const standardDiscount = course.originalPrice - course.price;
  const couponDiscount = couponApplied ? Math.round(course.price * 0.1) : 0;
  const finalPayable = course.price - couponDiscount;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim().toUpperCase() === "ATOMIC10" || couponCode.trim().toUpperCase() === "TOPPER") {
      setCouponApplied(true);
    }
  };

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#121c2c] py-6 sm:py-10 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href={`/courses/${course.slug}`}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#031635] transition"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Back to Course</span>
          </Link>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span>256-Bit SSL Encrypted Checkout</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Payment Methods & Details (7 cols) */}
          <div className="md:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-extrabold text-[#031635]">Select Payment Method</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Instant course unlock upon successful transaction.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: "upi",
                  title: "UPI (Google Pay, PhonePe, Paytm, BHIM)",
                  desc: "Zero transaction charges • Fast 1-click verification",
                  icon: "qr_code_scanner",
                },
                {
                  id: "card",
                  title: "Credit / Debit Card",
                  desc: "Visa, Mastercard, RuPay, Maestro",
                  icon: "credit_card",
                },
                {
                  id: "netbanking",
                  title: "Net Banking",
                  desc: "All major Indian banks supported (SBI, HDFC, ICICI, Axis)",
                  icon: "account_balance",
                },
              ].map((m) => {
                const isSelected = selectedMethod === m.id;
                return (
                  <label
                    key={m.id}
                    className={`p-4 rounded-2xl border cursor-pointer flex items-start gap-3.5 transition ${
                      isSelected
                        ? "bg-purple-50/70 border-purple-600 shadow-sm"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={isSelected}
                      onChange={() => setSelectedMethod(m.id)}
                      className="mt-1 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-[#031635]">
                          {m.icon}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-[#031635]">
                          {m.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Security Guarantee Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">verified_user</span>
              </div>
              <div className="text-xs">
                <span className="font-bold text-[#031635] block">
                  100% Secure & Trusted by 805+ Learners
                </span>
                <span className="text-slate-500 text-[11px]">
                  Immediate enrollment activation & invoice sent to your email.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Coupon (5 cols) */}
          <div className="md:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-5 shadow-sm">
            <h3 className="font-extrabold text-sm text-[#031635]">Order Summary</h3>

            {/* Course Card Preview */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">school</span>
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-[#031635] line-clamp-2 leading-snug">
                  {course.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">{course.duration} Validity</p>
              </div>
            </div>

            {/* Coupon Code Entry */}
            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 block">Apply Discount Coupon</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ATOMIC10 / TOPPER"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 uppercase font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#031635] outline-none focus:border-purple-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#031635] hover:bg-[#1a2b4b] text-white font-bold text-xs rounded-xl shadow transition"
                >
                  Apply
                </button>
              </div>
              {couponApplied && (
                <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  <span>Coupon &quot;{couponCode.toUpperCase()}&quot; applied! Extra 10% saved.</span>
                </p>
              )}
            </form>

            {/* Price Calculations */}
            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Original Course Fee</span>
                <span>₹{basePrice.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Batch Launch Discount (15%)</span>
                <span>-₹{standardDiscount.toLocaleString("en-IN")}</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between text-purple-600 font-bold">
                  <span>Special Promo Code</span>
                  <span>-₹{couponDiscount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>18% GST / Taxes</span>
                <span>Included</span>
              </div>
              <div className="flex justify-between text-base font-black text-[#031635] pt-3 border-t border-slate-200">
                <span>Total Amount</span>
                <span>₹{finalPayable.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Pay Button */}
            <button
              type="button"
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3.5 rounded-2xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-black text-sm shadow-lg shadow-purple-500/25 transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <span>Pay ₹{finalPayable.toLocaleString("en-IN")} Securely</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Success Modal */}
      {isSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h3 className="text-xl font-black text-[#031635]">Payment Successful!</h3>
            <p className="text-xs text-slate-500">
              Welcome to <span className="font-bold text-purple-600">{course.title}</span>. Your enrollment is active and ready to start learning.
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 text-left text-xs space-y-1 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono font-bold text-[#031635]">TXN-{Date.now().toString().slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-[#031635]">₹{finalPayable.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <Link
              href="/courses"
              className="w-full py-3.5 rounded-2xl bg-[#031635] text-white font-bold text-xs block transition shadow"
            >
              Go to Course Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}