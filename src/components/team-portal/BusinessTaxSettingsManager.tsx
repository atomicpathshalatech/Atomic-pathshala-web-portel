"use client";

import React, { useState } from "react";
import { Building, ShieldCheck, AlertTriangle, Lock, FileText, Check } from "lucide-react";

interface BusinessTaxSettingsProps {
  initialProfile: any;
  initialGst: any;
  taxRules: any[];
  bankAccounts: any[];
  canEdit: boolean;
}

export function BusinessTaxSettingsManager({
  initialProfile,
  initialGst,
  taxRules: initialRules,
  bankAccounts: initialAccounts,
  canEdit,
}: BusinessTaxSettingsProps) {
  const [profile, setProfile] = useState(initialProfile || {});
  const [gst, setGst] = useState(initialGst || {});
  const [rules, setRules] = useState(initialRules || []);
  const [accounts, setAccounts] = useState(initialAccounts || []);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/finance/settings/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to save profile");
      setMessage("Business profile saved successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGst = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/finance/settings/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gst),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to save GST configuration");
      setMessage("GST & Tax configuration updated!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Business & GST Tax Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure legal entity details, registration status, SAC tax rules, and safety locks
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4" /> {message}
        </div>
      )}

      {/* Critical GST Safety Alert */}
      <div
        className={`p-5 rounded-xl border flex items-start gap-3 ${
          gst.registrationStatus === "ACTIVE"
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-amber-50 border-amber-200 text-amber-900"
        }`}
      >
        {gst.registrationStatus === "ACTIVE" ? (
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm">
            GST Safety Status: {gst.registrationStatus || "PENDING"}
          </p>
          {gst.registrationStatus === "ACTIVE" ? (
            <p>
              GST collection is ACTIVE. Student orders generate formal GST Tax Invoices using GSTIN {gst.gstin}.
            </p>
          ) : (
            <p>
              SAFETY LOCK ACTIVE: Under Indian GST Law, GST cannot be collected while status is {gst.registrationStatus || "PENDING"}. The platform automatically generates Bill of Supply with 0% GST. Activation requires valid GSTIN and approved effective date.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Profile Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-600" /> Business Profile
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Legal Entity Name</label>
              <input
                type="text"
                disabled={!canEdit}
                value={profile.legalName || ""}
                onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Trade Name / Brand</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.tradeName || ""}
                  onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Entity Type</label>
                <select
                  disabled={!canEdit}
                  value={profile.businessType || "PROPRIETORSHIP"}
                  onChange={(e) => setProfile({ ...profile, businessType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="PROPRIETORSHIP">Proprietorship</option>
                  <option value="PARTNERSHIP">Partnership</option>
                  <option value="LLP">Limited Liability Partnership (LLP)</option>
                  <option value="PRIVATE_LIMITED">Private Limited Company</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Registered Address</label>
              <textarea
                rows={2}
                disabled={!canEdit}
                value={profile.registeredAddress || ""}
                onChange={(e) => setProfile({ ...profile, registeredAddress: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">State</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.state || "Uttar Pradesh"}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">State Code</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.stateCode || "09"}
                  onChange={(e) => setProfile({ ...profile, stateCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">PIN Code</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.pincode || ""}
                  onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Contact Email</label>
                <input
                  type="email"
                  disabled={!canEdit}
                  value={profile.contactEmail || ""}
                  onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">PAN (Masked)</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={profile.businessPanMasked || "•••••1234A"}
                  onChange={(e) => setProfile({ ...profile, businessPan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  placeholder="Enter 10-digit PAN"
                />
              </div>
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={isSaving}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
              >
                {isSaving ? "Saving..." : "Save Business Profile"}
              </button>
            )}
          </form>
        </div>

        {/* GST Configuration Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" /> GST Configuration & Sequences
          </h2>

          <form onSubmit={handleSaveGst} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Registration Status</label>
                <select
                  disabled={!canEdit}
                  value={gst.registrationStatus || "PENDING"}
                  onChange={(e) => setGst({ ...gst, registrationStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                >
                  <option value="PENDING">PENDING (Tax Collection Locked)</option>
                  <option value="NOT_REGISTERED">NOT_REGISTERED (0% Tax)</option>
                  <option value="ACTIVE">ACTIVE (Collect CGST/SGST/IGST)</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">GSTIN (15 characters)</label>
                <input
                  type="text"
                  maxLength={15}
                  disabled={!canEdit}
                  value={gst.gstin || ""}
                  onChange={(e) => setGst({ ...gst, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
                  placeholder="09AAAAA0000A1Z5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Effective Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={gst.effectiveDate ? new Date(gst.effectiveDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => setGst({ ...gst, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Financial Year</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={gst.currentFinancialYear || "2026-27"}
                  onChange={(e) => setGst({ ...gst, currentFinancialYear: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="2026-27"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={gst.invoicePrefix || "INV"}
                  onChange={(e) => setGst({ ...gst, invoicePrefix: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Credit Note Prefix</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={gst.creditNotePrefix || "CN"}
                  onChange={(e) => setGst({ ...gst, creditNotePrefix: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Tax Calculation Mode</label>
              <select
                disabled={!canEdit}
                value={gst.taxCalculationMode || "EXCLUSIVE"}
                onChange={(e) => setGst({ ...gst, taxCalculationMode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="EXCLUSIVE">Exclusive (Base + GST added on checkout)</option>
                <option value="INCLUSIVE">Inclusive (Course price includes GST)</option>
              </select>
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={isSaving}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
              >
                {isSaving ? "Saving..." : "Save GST Configuration"}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
