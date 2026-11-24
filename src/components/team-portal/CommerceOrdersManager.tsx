"use client";

import { useState } from "react";
import { toast } from "sonner";

export type CommerceOrder = {
  id: string;
  orderNumber: string;
  invoiceNumber: string | null;
  studentName: string;
  studentEmail: string;
  studentId: string;
  studentRoll: string;
  batchId: string;
  batchName: string;
  batchCode: string;
  originalAmount: number;
  discountAmount: number;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  gatewayProvider: string;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  couponCode: string | null;
  refundedAmount: number;
  refundable: boolean;
  createdAt: string;
};

export type CommerceSummary = {
  totalSuccessfulOrders: number;
  grossSales: number;
  totalDiscounts: number;
  netRevenue: number;
};

const STATUS_BADGE: Record<string, string> = {
  SUCCESS: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  FAILED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  REFUNDED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  PARTIALLY_REFUNDED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  CANCELLED: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

export function CommerceOrdersManager({
  initialOrders,
  initialSummary,
  canRefund,
}: {
  initialOrders: CommerceOrder[];
  initialSummary: CommerceSummary;
  canRefund: boolean;
}) {
  const [orders, setOrders] = useState<CommerceOrder[]>(initialOrders);
  const [summary, setSummary] = useState<CommerceSummary>(initialSummary);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  // Refund Modal State
  const [refundingOrder, setRefundingOrder] = useState<CommerceOrder | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [revokeAccess, setRevokeAccess] = useState(true);
  const [isRefunding, setIsRefunding] = useState(false);

  async function handleFilter() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/team/commerce/orders?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setOrders(json.data.orders);
        if (json.data.summary) setSummary(json.data.summary);
      }
    } catch {
      toast.error("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  function openRefund(order: CommerceOrder) {
    const maxRefundable = order.amount - order.refundedAmount;
    setRefundingOrder(order);
    setRefundAmount(String(maxRefundable));
    setRefundReason("");
    setRevokeAccess(true);
  }

  async function submitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refundingOrder) return;

    setIsRefunding(true);
    try {
      const res = await fetch(`/api/team/commerce/orders/${refundingOrder.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(refundAmount),
          reason: refundReason || undefined,
          revokeAccess,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to process refund");
        return;
      }

      toast.success("Refund recorded successfully!");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === refundingOrder.id
            ? {
                ...o,
                refundedAmount: o.refundedAmount + Number(refundAmount),
                status:
                  o.refundedAmount + Number(refundAmount) >= o.amount
                    ? ("REFUNDED" as const)
                    : ("PARTIALLY_REFUNDED" as const),
              }
            : o
        )
      );
      setRefundingOrder(null);
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsRefunding(false);
    }
  }

  function exportCSV() {
    if (orders.length === 0) {
      toast.error("No orders to export.");
      return;
    }
    const headers = [
      "Order Number",
      "Invoice Number",
      "Student Name",
      "Student Email",
      "Student Roll",
      "Batch Name",
      "Batch Code",
      "Original Price",
      "Discount",
      "Final Paid",
      "Currency",
      "Status",
      "Gateway",
      "Coupon",
      "Refunded Amount",
      "Created At",
    ];

    const rows = orders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.invoiceNumber || ""}"`,
      `"${o.studentName}"`,
      `"${o.studentEmail}"`,
      `"${o.studentRoll}"`,
      `"${o.batchName}"`,
      `"${o.batchCode}"`,
      o.originalAmount,
      o.discountAmount,
      o.amount,
      o.currency,
      o.status,
      o.gatewayProvider,
      `"${o.couponCode || ""}"`,
      o.refundedAmount,
      `"${o.createdAt}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `atomic_commerce_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gross Sales</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ₹{summary.grossSales.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Pre-discount catalog total</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Discounts</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            ₹{summary.totalDiscounts.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Coupons &amp; promo savings</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-primary uppercase tracking-wider">Net Batch Revenue</p>
          <p className="text-2xl font-black text-primary mt-1">
            ₹{summary.netRevenue.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Collected payment total</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Successful Orders</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {summary.totalSuccessfulOrders}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Enrolled &amp; confirmed cohorts</p>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search student, order #, invoice #, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilter()}
            className="w-full md:max-w-md px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success / Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
          </select>
          <button
            onClick={handleFilter}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shrink-0"
          >
            {loading ? "Searching..." : "Filter"}
          </button>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-black text-[10px] tracking-wider">
                <th className="py-3 px-4">Order / Invoice</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Batch Product</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-slate-900 dark:text-white">{o.orderNumber}</p>
                      {o.invoiceNumber && (
                        <p className="font-mono text-[11px] text-slate-400 mt-0.5">{o.invoiceNumber}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 dark:text-white">{o.studentName}</p>
                      <p className="text-[11px] text-slate-400">{o.studentEmail}</p>
                      <p className="text-[10px] font-mono text-slate-500">Roll: {o.studentRoll}</p>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{o.batchName}</p>
                      <p className="text-[10px] font-mono text-slate-400">{o.batchCode}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-black text-slate-900 dark:text-white">
                        ₹{o.amount.toLocaleString("en-IN")}
                      </p>
                      {o.discountAmount > 0 && (
                        <p className="text-[10px] text-emerald-600 font-semibold">
                          -₹{o.discountAmount} {o.couponCode ? `(${o.couponCode})` : ""}
                        </p>
                      )}
                      {o.refundedAmount > 0 && (
                        <p className="text-[10px] text-rose-600 font-bold">
                          ₹{o.refundedAmount} refunded
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {o.gatewayProvider}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          STATUS_BADGE[o.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(o.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canRefund && o.refundable && (
                        <button
                          onClick={() => openRefund(o)}
                          className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {refundingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Initiate Refund for Order
              </h3>
              <button
                onClick={() => setRefundingOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <p>
                <b>Student:</b> {refundingOrder.studentName} ({refundingOrder.studentEmail})
              </p>
              <p>
                <b>Batch:</b> {refundingOrder.batchName}
              </p>
              <p>
                <b>Order Paid:</b> ₹{refundingOrder.amount.toLocaleString("en-IN")}
              </p>
              <p>
                <b>Available Balance:</b> ₹{(refundingOrder.amount - refundingOrder.refundedAmount).toLocaleString("en-IN")}
              </p>
            </div>

            <form onSubmit={submitRefund} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max={refundingOrder.amount - refundingOrder.refundedAmount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Reason for Refund
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Student requested course cancellation within policy period"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="revoke"
                  checked={revokeAccess}
                  onChange={(e) => setRevokeAccess(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="revoke" className="text-slate-700 dark:text-slate-300 font-medium">
                  Revoke batch course access upon full refund
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setRefundingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRefunding}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50"
                >
                  {isRefunding ? "Processing..." : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
