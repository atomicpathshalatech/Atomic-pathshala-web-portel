"use client";

import React, { useState } from "react";
import { Plus, CheckCircle, XCircle, DollarSign, Receipt, Filter } from "lucide-react";

interface ExpensesManagerProps {
  initialExpenses: any[];
  bankAccounts: any[];
  canApprove: boolean;
}

export function ExpensesManager({
  initialExpenses,
  bankAccounts,
  canApprove,
}: ExpensesManagerProps) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Expense form state
  const [formData, setFormData] = useState({
    title: "",
    vendorName: "",
    category: "OFFICE",
    amount: "",
    gstAmount: "",
    tdsAmount: "",
    invoiceNumber: "",
    description: "",
    bankAccountId: bankAccounts[0]?.id || "",
  });

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/team/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create expense");

      setExpenses([data.data.expense, ...expenses]);
      setShowAddModal(false);
      setFormData({
        title: "",
        vendorName: "",
        category: "OFFICE",
        amount: "",
        gstAmount: "",
        tdsAmount: "",
        invoiceNumber: "",
        description: "",
        bankAccountId: bankAccounts[0]?.id || "",
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: "APPROVE" | "REJECT" | "RECORD_PAYMENT") => {
    try {
      const res = await fetch(`/api/team/finance/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Action failed");

      setExpenses(
        expenses.map((exp) => (exp.id === id ? { ...exp, ...data.data.expense } : exp))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredExpenses = expenses.filter((e) =>
    filterCategory === "ALL" ? true : e.category === filterCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expense Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track operational bills, vendor invoices, approvals, and payout records
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Record New Expense
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {["ALL", "SALARIES", "FACULTY_PAYMENTS", "MARKETING", "HOSTING", "OFFICE", "MODULES", "EQUIPMENT", "TRAVEL", "OTHER"].map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filterCategory === cat
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          )
        )}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Ref Number</th>
                <th className="py-3 px-4">Title & Vendor</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Base (₹)</th>
                <th className="py-3 px-4 text-right">GST (₹)</th>
                <th className="py-3 px-4 text-right">Total (₹)</th>
                <th className="py-3 px-4">Approval</th>
                <th className="py-3 px-4">Payment</th>
                {canApprove && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {exp.expenseNumber}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{exp.title}</p>
                    <p className="text-slate-500">{exp.vendorName}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    ₹{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    ₹{Number(exp.gstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{Number(exp.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        exp.approvalStatus === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : exp.approvalStatus === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {exp.approvalStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        exp.paymentStatus === "PAID"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {exp.paymentStatus}
                    </span>
                  </td>
                  {canApprove && (
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      {exp.approvalStatus === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleAction(exp.id, "APPROVE")}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(exp.id, "REJECT")}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {exp.approvalStatus === "APPROVED" && exp.paymentStatus === "PENDING" && (
                        <button
                          onClick={() => handleAction(exp.id, "RECORD_PAYMENT")}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                        >
                          Mark Paid & Ledger
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No expenses found in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Record New Expense</h2>
            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. AWS Cloud Server Hosting Nov 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Vendor Name</label>
                  <input
                    type="text"
                    required
                    value={formData.vendorName}
                    onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. Amazon Web Services"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="HOSTING">Hosting & Infrastructure</option>
                    <option value="MARKETING">Marketing & Ads</option>
                    <option value="OFFICE">Office & Utilities</option>
                    <option value="FACULTY_PAYMENTS">Faculty Payments</option>
                    <option value="MODULES">Study Material & Modules</option>
                    <option value="EQUIPMENT">Equipment & Hardware</option>
                    <option value="TRAVEL">Travel & Logistics</option>
                    <option value="OTHER">Other Operational</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Base Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">GST Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.gstAmount}
                    onChange={(e) => setFormData({ ...formData, gstAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">TDS Deducted (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tdsAmount}
                    onChange={(e) => setFormData({ ...formData, tdsAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Vendor Invoice Ref</label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. INV-98452-2026"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  {isSubmitting ? "Submitting..." : "Submit Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
