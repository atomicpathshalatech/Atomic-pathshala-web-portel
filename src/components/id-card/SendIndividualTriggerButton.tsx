"use client";

import { useState } from "react";
import { SendIndividualDocumentModal } from "./SendIndividualDocumentModal";

export function SendIndividualTriggerButton({
  kind,
}: {
  kind: "TEAM" | "STUDENT";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#0f3a9e] text-white hover:bg-[#0f3a9e]/90 shadow-sm transition"
        title="Send Joining Letter, Contract, Experience Certificate, ID Card or Custom Email to a specific person"
      >
        <span className="material-symbols-outlined text-[18px]">outgoing_mail</span>
        <span>Send to Individual</span>
      </button>

      {open && (
        <SendIndividualDocumentModal
          isOpen={open}
          onClose={() => setOpen(false)}
          defaultKind={kind}
        />
      )}
    </>
  );
}
