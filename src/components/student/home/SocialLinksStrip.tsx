import { prisma } from "@/lib/db";

const PLATFORMS = ["youtube", "instagram", "telegram", "facebook", "whatsapp"] as const;
type Platform = (typeof PLATFORMS)[number];

const LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  telegram: "Telegram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
};

/** Small brand marks (simplified), one colour each. */
function Logo({ platform }: { platform: Platform }) {
  switch (platform) {
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path fill="#FF0000" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-3.2.5-4.8s-.1-3.2-.5-4.8Z" />
          <path fill="#fff" d="m9.8 15.1 5.8-3.1-5.8-3.1v6.2Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <defs>
            <linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEDA75" />
              <stop offset=".4" stopColor="#D62976" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-g)" />
          <circle cx="12" cy="12" r="4.3" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="17.3" cy="6.7" r="1.2" fill="#fff" />
        </svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <circle cx="12" cy="12" r="11" fill="#229ED9" />
          <path fill="#fff" d="M5.5 11.6 17 7.2c.5-.2 1 .1.8.9l-2 9.3c-.1.6-.5.8-1 .5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.4-.1l-6.9 4.3-3-.9c-.6-.2-.6-.6.2-1Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <circle cx="12" cy="12" r="11" fill="#1877F2" />
          <path fill="#fff" d="M13.2 23v-7.7h2.6l.4-3h-3V10.4c0-.9.3-1.5 1.5-1.5h1.6V6.2a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.6v3h2.5V23h3.1Z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <circle cx="12" cy="12" r="11" fill="#25D366" />
          <path fill="#fff" d="M12 5.5a6.5 6.5 0 0 0-5.6 9.8L5.5 18.5l3.3-.9A6.5 6.5 0 1 0 12 5.5Zm3.8 9.2c-.2.5-.9.9-1.4 1-.4 0-.9.2-2.8-.6-2.4-1-3.9-3.4-4-3.6-.1-.2-1-1.3-1-2.5s.6-1.8.8-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.8.9c.2.1.4.2.5.3.1.2.1.8-.1 1.3Z" />
        </svg>
      );
  }
}

/** The links set in Team → Website → Footer (stored as a { platform: url } map or as [{ platform|label, url }]). */
async function socialLinks(): Promise<{ platform: Platform; url: string }[]> {
  const row = await prisma.footerSettings.findFirst({ select: { socialLinks: true } }).catch(() => null);
  const raw = row?.socialLinks;
  const map: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const key = String(o.platform ?? o.label ?? "").trim().toLowerCase();
      if (key && typeof o.url === "string" && o.url) map[key] = o.url;
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string" && v) map[k.toLowerCase()] = v;
  }
  return PLATFORMS.filter((p) => /^https?:\/\//i.test(map[p] ?? "")).map((p) => ({ platform: p, url: map[p]! }));
}

/** "Follow us": small logos of Atomic Pathshala's social pages at the bottom of the students' home. */
export async function SocialLinksStrip() {
  const links = await socialLinks();
  if (links.length === 0) return null;
  return (
    <section className="flex flex-col items-center gap-2 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Follow Atomic Pathshala</p>
      <div className="flex items-center gap-3">
        {links.map((l) => (
          <a
            key={l.platform}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={LABEL[l.platform]}
            title={LABEL[l.platform]}
            className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition active:scale-95 hover:shadow"
          >
            <Logo platform={l.platform} />
          </a>
        ))}
      </div>
    </section>
  );
}
