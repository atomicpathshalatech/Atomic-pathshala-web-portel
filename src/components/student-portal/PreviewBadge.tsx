export function PreviewBadge({ note }: { note: string }) {
  return (
    <div className="inline-flex items-center gap-2 bg-secondary-container/10 text-secondary border border-secondary/20 px-3 py-1.5 rounded-full text-label-sm font-label-sm">
      <span className="material-symbols-outlined text-[16px]">visibility</span>
      Preview layout — {note}
    </div>
  );
}
