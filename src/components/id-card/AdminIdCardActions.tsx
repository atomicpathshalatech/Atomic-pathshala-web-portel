"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SendIndividualDocumentModal, RecipientProfile } from "./SendIndividualDocumentModal";

/** Row actions on the admin ID-card list. Every action is re-checked on the server. */
export function AdminIdCardActions({
  userId,
  kind,
  status,
  printable,
  canAssignEmployeeId,
  recipientDetails,
}: {
  userId: string;
  kind: "STUDENT" | "TEAM";
  status: "ACTIVE" | "REVOKED" | null;
  printable: boolean;
  canAssignEmployeeId: boolean;
  recipientDetails?: {
    name: string;
    email: string;
    phone?: string | null;
    photoUrl?: string | null;
    employeeCode?: string | null;
    designation?: string | null;
    department?: string | null;
    joiningDate?: string | null;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendDocOpen, setSendDocOpen] = useState(false);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/id-cards/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Action failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const btn = "px-2 py-1 rounded-lg text-[11px] font-bold border transition disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {printable && status !== "REVOKED" && (
        <a href={`/api/team/id-cards/${userId}/pdf?kind=${kind === "TEAM" ? "team" : "student"}`} className={`${btn} border-[#1d4ed8]/40 text-[#1d4ed8] hover:bg-[#1d4ed8]/5`}>
          PDF
        </a>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => setSendDocOpen(true)}
        className={`${btn} border-[#0f3a9e]/40 text-[#0f3a9e] hover:bg-[#0f3a9e]/5 flex items-center gap-1`}
        title="Send ID card, Joining letter, Contract or Experience certificate"
      >
        <span className="material-symbols-outlined text-[12px]">send</span>
        Send
      </button>
      {canAssignEmployeeId && (
        <button type="button" disabled={busy} onClick={() => act({ action: "assignEmployeeId" })} className={`${btn} border-outline-variant hover:bg-surface-container`}>
          Assign employee ID
        </button>
      )}
      {status === "REVOKED" ? (
        <button type="button" disabled={busy} onClick={() => act({ action: "reinstate" })} className={`${btn} border-emerald-400 text-emerald-700 hover:bg-emerald-50`}>
          Reinstate
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const reason = window.prompt("Why is this ID card being revoked? (saved in the audit log)");
            if (reason && reason.trim().length >= 3) act({ action: "revoke", reason: reason.trim() });
          }}
          className={`${btn} border-rose-300 text-rose-700 hover:bg-rose-50`}
        >
          Revoke
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Reissue this card with a new QR code? Every printed copy of the current card will stop verifying.")) act({ action: "reissue" });
        }}
        className={`${btn} border-outline-variant hover:bg-surface-container`}
      >
        Reissue
      </button>
      {error && <span className="text-[11px] text-error w-full">{error}</span>}

      {sendDocOpen && (
        <SendIndividualDocumentModal
          isOpen={sendDocOpen}
          onClose={() => setSendDocOpen(false)}
          defaultKind={kind}
          initialRecipient={
            recipientDetails
              ? {
                  id: userId,
                  kind,
                  name: recipientDetails.name,
                  email: recipientDetails.email,
                  phone: recipientDetails.phone,
                  photoUrl: recipientDetails.photoUrl,
                  employeeCode: recipientDetails.employeeCode,
                  designation: recipientDetails.designation,
                  department: recipientDetails.department,
                  joiningDate: recipientDetails.joiningDate,
                }
              : null
          }
        />
      )}
    </div>
  );
}
