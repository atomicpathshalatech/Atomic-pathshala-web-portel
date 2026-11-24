"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Users,
  CreditCard,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

interface FinanceOverviewProps {
  initialSummary: any;
  initialLedger: any[];
}

export function FinanceOverviewDashboard({
  initialSummary,
  initialLedger,
}: FinanceOverviewProps) {
  const [summary] = useState(initialSummary);
  const [ledger] = useState(initialLedger);

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Finance & Accounting Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time financial overview, double-entry ledger, expenses, and payroll burn
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/team/finance/expenses"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Manage Expenses
          </Link>
          <Link
            href="/team/hr/payroll"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Payroll Management
          </Link>
          <Link
            href="/team/finance/settings"
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Business & GST Settings
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Collections</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₹{Number(summary.grossCollections || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            From {summary.totalPaidOrders || 0} student orders (Discounts: ₹{Number(summary.totalDiscounts || 0).toLocaleString("en-IN")})
          </p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Operating Expenses</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₹{Number(summary.totalExpenses || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Input GST Claimable: ₹{Number(summary.totalInputGst || 0).toLocaleString("en-IN")}
          </p>
        </div>

        {/* Total Payroll */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Payroll Disbursed</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₹{Number(summary.totalPayrollDisbursed || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Gross Payroll: ₹{Number(summary.totalPayrollGross || 0).toLocaleString("en-IN")}
          </p>
        </div>

        {/* Net Estimated Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Operating Profit</span>
            <span className={`p-2 rounded-lg ${summary.netEstimatedProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
              {summary.netEstimatedProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </span>
          </div>
          <p className={`text-2xl font-black mt-2 font-mono ${summary.netEstimatedProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            ₹{Number(summary.netEstimatedProfit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Revenue minus (Refunds + Expenses + Payroll)
          </p>
        </div>
      </div>

      {/* Bank Balances & Fund Allocation */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" /> Business Bank Accounts
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.bankAccounts?.map((b: any) => (
            <div key={b.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{b.accountName}</p>
                  <p className="text-xs text-slate-500">{b.bankName}</p>
                </div>
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-semibold">
                  {b.purpose}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-600 mt-2">
                A/C: {b.accountNumberMasked}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs text-slate-500">Current Balance:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ₹{Number(b.currentBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
          {(!summary.bankAccounts || summary.bankAccounts.length === 0) && (
            <div className="col-span-3 text-center py-6 text-slate-500 text-sm">
              No bank accounts configured yet. Add accounts under Business & GST Settings.
            </div>
          )}
        </div>
      </div>

      {/* Double-Entry Ledger Stream */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Double-Entry Ledger Transactions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Formal internal accounting ledger</p>
          </div>
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
            {ledger.length} entries shown
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Entry Number</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {entry.entryNumber}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(entry.entryDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {entry.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-md truncate">
                    {entry.description}
                  </td>
                  <td className="py-3 px-4">
                    {entry.type === "CREDIT" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> INFLOW
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                        <ArrowUpRight className="w-3.5 h-3.5" /> OUTFLOW
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {entry.type === "CREDIT" ? "+" : "-"}₹
                    {Number(entry.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No ledger transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
