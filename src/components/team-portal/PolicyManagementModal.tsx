"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MASTER_POLICIES, MasterPolicyDefinition } from "@/lib/agreements/policies";

export function PolicyManagementModal() {
  const [open, setOpen] = useState(false);
  const [policies, setPolicies] = useState<MasterPolicyDefinition[]>(MASTER_POLICIES);
  const [selectedPolicy, setSelectedPolicy] = useState<MasterPolicyDefinition>(MASTER_POLICIES[0]);
  const [editingRules, setEditingRules] = useState(selectedPolicy.detailedRules);
  const [editingTitle, setEditingTitle] = useState(selectedPolicy.title);
  const [editingDesc, setEditingDesc] = useState(selectedPolicy.description);
  const [saving, setSaving] = useState(false);

  function handleSelect(pol: MasterPolicyDefinition) {
    setSelectedPolicy(pol);
    setEditingRules(pol.detailedRules);
    setEditingTitle(pol.title);
    setEditingDesc(pol.description);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/team/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyCode: selectedPolicy.policyCode,
          title: editingTitle,
          description: editingDesc,
          detailedRules: editingRules,
          version: "1.1",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to update policy.");
        return;
      }
      toast.success(`${selectedPolicy.policyCode} updated successfully!`);
      // Update local state
      setPolicies((prev) =>
        prev.map((p) =>
          p.policyCode === selectedPolicy.policyCode
            ? { ...p, title: editingTitle, description: editingDesc, detailedRules: editingRules }
            : p
        )
      );
    } catch {
      toast.error("Error saving policy rules.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3.5 py-2 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-xs font-semibold hover:bg-surface-container transition-all flex items-center gap-2 shadow-sm"
      >
        <span className="text-sm">⚖️</span>
        <span>Institutional Policies</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-outline-variant/30 shadow-2xl overflow-hidden bg-surface">
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
                  <span>⚖️</span>
                  <span>Atomic Pathshala — 10 Master Organizational Policies</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Centralized policy governance applicable to all faculty appointment letters and service agreements.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant text-sm"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
              {/* Policy List Sidebar */}
              <div className="border-r border-outline-variant/20 p-3 space-y-1 overflow-y-auto max-h-[60vh]">
                {policies.map((p) => (
                  <button
                    key={p.policyCode}
                    onClick={() => handleSelect(p)}
                    className={`w-full text-left p-3 rounded-xl transition-all text-xs ${
                      selectedPolicy.policyCode === p.policyCode
                        ? "bg-primary text-on-primary font-bold shadow-sm"
                        : "text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase opacity-80">{p.policyCode}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20">v{p.version}</span>
                    </div>
                    <div className="truncate mt-0.5 font-medium">{p.title.replace(/^Policy [A-J] — /, "")}</div>
                  </button>
                ))}
              </div>

              {/* Policy Detail & Editor */}
              <div className="md:col-span-2 p-6 overflow-y-auto max-h-[60vh] space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface uppercase">Policy Title</label>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface uppercase">Short Description</label>
                  <input
                    type="text"
                    value={editingDesc}
                    onChange={(e) => setEditingDesc(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface uppercase">
                    Detailed Statutory Rules &amp; Covenants
                  </label>
                  <textarea
                    rows={12}
                    value={editingRules}
                    onChange={(e) => setEditingRules(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface p-3 text-xs text-on-surface font-mono leading-relaxed outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    Mandatory acknowledgement in joining letters
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {saving ? "Saving Policy..." : "Save Policy Updates"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
