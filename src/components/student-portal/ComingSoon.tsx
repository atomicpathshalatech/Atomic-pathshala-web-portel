export function ComingSoon({
  icon,
  title,
  note,
}: {
  icon: string;
  title: string;
  note: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
        <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
          {icon}
        </span>
      </div>
      <h1 className="font-headline-lg text-headline-lg">{title} — Coming Soon</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        This module is planned as <strong>{note}</strong> and isn&apos;t built yet.
      </p>
    </div>
  );
}
