"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { OutreachLead, OutreachUser } from "@/lib/integrations/outreach-leads";

const STATUS_OPTIONS = ["HOT", "WARM", "COLD", "QUALIFIED", "CONVERTED", "CLOSED_LOST"] as const;

const STATUS_TONE: Record<string, string> = {
  HOT: "bg-error/10 text-error",
  WARM: "bg-tertiary/10 text-tertiary",
  COLD: "bg-surface-container-high text-on-surface-variant",
  QUALIFIED: "bg-secondary/10 text-secondary",
  CONVERTED: "bg-green-500/10 text-green-700",
  CLOSED_LOST: "bg-surface-container-high text-on-surface-variant",
};

async function patchLead(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/team/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Could not update this lead.");
  return json.data.lead as OutreachLead;
}

export function LeadsManager({
  initialLeads,
  counselors,
  canUpdate,
  canAssign,
}: {
  initialLeads: OutreachLead[];
  counselors: OutreachUser[];
  canUpdate: boolean;
  canAssign: boolean;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  async function updateStatus(id: string, status: string) {
    try {
      const updated = await patchLead(id, { status });
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      toast.success("Status updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status.");
    }
  }

  async function updateAssignee(id: string, assignedUserId: string) {
    try {
      const updated = await patchLead(id, { assignedUserId: assignedUserId || null });
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      toast.success("Lead reassigned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reassign lead.");
    }
  }

  const visible = statusFilter === "ALL" ? leads : leads.filter((l) => l.status === statusFilter);

  return (
    <div className="space-y-stack-md">
      <div className="flex flex-wrap gap-2">
        {["ALL", ...STATUS_OPTIONS].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-label-sm px-3 py-1.5 rounded-lg ${statusFilter === s ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-primary/10"}`}
          >
            {s} {s !== "ALL" && `(${leads.filter((l) => l.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
        {visible.length === 0 && <p className="p-8 text-center text-on-surface-variant font-body-md">No leads in this view.</p>}
        {visible.map((lead) => (
          <div key={lead.id} className="p-4 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-label-lg text-label-lg text-on-surface">{lead.contact.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_TONE[lead.status] ?? "bg-surface-container-high text-on-surface-variant"}`}>
                  {lead.status}
                </span>
                <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded-full text-on-surface-variant">
                  Score {lead.score}
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant">
                {lead.contact.phone}
                {lead.contact.email ? ` · ${lead.contact.email}` : ""}
                {lead.targetCourse ? ` · ${lead.targetCourse}` : ""}
              </p>
            </div>

            {canUpdate ? (
              <select
                value={lead.status}
                onChange={(e) => updateStatus(lead.id, e.target.value)}
                className="text-label-sm rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : null}

            {canAssign ? (
              <select
                value={lead.assignedUser?.id ?? ""}
                onChange={(e) => updateAssignee(lead.id, e.target.value)}
                className="text-label-sm rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5"
              >
                <option value="">Unassigned</option>
                {counselors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                ))}
              </select>
            ) : (
              <span className="text-label-sm text-on-surface-variant">
                {lead.assignedUser ? lead.assignedUser.name : "Unassigned"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
