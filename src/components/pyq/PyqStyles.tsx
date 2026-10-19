"use client";

/** Shared control styles for the PYQ Library / import / module screens. */
export function PyqStyles() {
  return (
    <style jsx global>{`
      .pyq-input { padding: 0.4rem 0.5rem; border-radius: 0.6rem; border: 1px solid rgb(226 232 240); background: white; font-size: 12px; min-width: 0; }
      .dark .pyq-input { background: rgb(15 23 42); border-color: rgb(51 65 85); color: white; }
      .pyq-input:disabled { opacity: 0.55; }
      .pyq-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.4rem 0.75rem; border-radius: 0.6rem; border: 1px solid rgb(203 213 225); font-weight: 700; font-size: 12px; }
      .pyq-btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; padding: 0.4rem 0.75rem; border-radius: 0.6rem; background: rgb(37 99 235); color: white; font-weight: 700; font-size: 12px; }
      .pyq-btn-danger { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.4rem 0.75rem; border-radius: 0.6rem; border: 1px solid rgb(254 202 202); color: rgb(185 28 28); font-weight: 700; font-size: 12px; }
      .pyq-btn:disabled, .pyq-btn-primary:disabled, .pyq-btn-danger:disabled { opacity: 0.45; cursor: not-allowed; }
    `}</style>
  );
}
