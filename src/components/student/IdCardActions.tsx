"use client";

export function IdCardActions() {
  return (
    <div className="mt-8 flex gap-4 no-print">
      <button
        onClick={() => window.print()}
        className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-label-md hover:bg-primary-container transition-all active:scale-95 shadow-lg shadow-primary/20"
      >
        <span className="material-symbols-outlined">download</span>
        Download ID Card
      </button>
      <button
        onClick={() => window.print()}
        className="w-14 flex items-center justify-center border border-outline-variant text-on-surface-variant py-3 rounded-xl hover:bg-surface-container transition-all active:scale-95"
      >
        <span className="material-symbols-outlined">print</span>
      </button>
    </div>
  );
}
