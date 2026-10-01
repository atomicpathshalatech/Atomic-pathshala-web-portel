/** Shown on Website CMS pages to anyone but the Super Admin. */
export function SuperAdminOnlyNotice() {
  return (
    <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
      <span className="material-symbols-outlined text-4xl text-slate-400">lock</span>
      <p className="mt-2 font-semibold">Only the Super Admin can manage the website.</p>
    </div>
  );
}
