import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";
import { getFooterData, type FooterColumnItem } from "@/lib/homepage";

// Used until an admin fills in Team → Website → Footer.
const DEFAULT_COLUMNS: FooterColumnItem[] = [
  {
    id: "company",
    title: "Company",
    links: [
      { label: "About Us", url: "/about", icon: null, openNewTab: false },
      { label: "Career", url: "/careers", icon: null, openNewTab: false },
      { label: "Privacy Policy", url: "/privacy", icon: null, openNewTab: false },
      { label: "Terms of Service", url: "/terms", icon: null, openNewTab: false },
    ],
  },
  {
    id: "courses",
    title: "Courses",
    links: [
      { label: "NEET Preparation", url: "/courses/neet", icon: null, openNewTab: false },
      { label: "JEE Advanced", url: "/courses/jee", icon: null, openNewTab: false },
      { label: "Foundation (8-10)", url: "/courses/foundation", icon: null, openNewTab: false },
      { label: "Free Resources", url: "/resources", icon: null, openNewTab: false },
    ],
  },
];

const DEFAULT_DESCRIPTION =
  "Empowering future doctors and engineers with high-performance learning strategies and premium educational tools.";

export async function Footer() {
  const data = await getFooterData();

  const columns = data && data.columns.length ? data.columns : DEFAULT_COLUMNS;
  const description = data?.description || DEFAULT_DESCRIPTION;
  const logoUrl = data?.logoUrl || "/brand/logo.png";
  const copyright =
    data?.copyrightText ||
    `© ${new Date().getFullYear()} Atomic Pathshala. Accelerating Excellence.`;
  const social = data?.social ?? [];

  return (
    <footer className="bg-inverse-surface text-surface-variant py-stack-lg border-t border-outline-variant/10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="col-span-2 md:col-span-1 space-y-4">
          <div className="flex items-center gap-2.5 font-headline-md text-headline-md font-bold text-surface-container-lowest">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Atomic Pathshala Logo"
              className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5"
            />
            <span>Atomic Pathshala</span>
          </div>
          <p className="text-label-sm font-label-sm opacity-70">{description}</p>
          {(social.length ? social : null) ? (
            <div className="flex gap-4">
              {social.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-10 h-10 rounded-full bg-surface-variant/10 flex items-center justify-center hover:bg-primary transition-colors"
                >
                  {/youtube/i.test(`${s.label} ${s.url}`) ? (
                    // YouTube's own logo (red play button), so the channel link is recognisable.
                    <svg viewBox="0 0 28 20" width="24" height="17" aria-hidden="true">
                      <path fill="#FF0000" d="M27.4 3.1A3.5 3.5 0 0 0 25 .6C22.8 0 14 0 14 0S5.2 0 3 .6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9A3.5 3.5 0 0 0 3 19.4c2.2.6 11 .6 11 .6s8.8 0 11-.6a3.5 3.5 0 0 0 2.4-2.5c.6-2.2.6-6.9.6-6.9s0-4.7-.6-6.9Z" />
                      <path fill="#FFFFFF" d="M11.2 14.3 18.5 10l-7.3-4.3v8.6Z" />
                    </svg>
                  ) : (
                    <span className="material-symbols-outlined text-surface-container-lowest">
                      {s.icon || "link"}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <div className="flex gap-4">
              {["share", "mail", "call"].map((icon) => (
                <span
                  key={icon}
                  className="w-10 h-10 rounded-full bg-surface-variant/10 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-surface-container-lowest">{icon}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {columns.slice(0, 2).map((col) => (
          <div key={col.id}>
            <h4 className="text-surface-container-lowest font-headline-md text-headline-md mb-6">
              {col.title}
            </h4>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <Link
                    href={link.url}
                    {...(link.openNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="text-label-sm font-label-sm hover:text-surface-container-lowest hover:translate-x-1 transition-all inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="col-span-2 md:col-span-1 space-y-6">
          <h4 className="text-surface-container-lowest font-headline-md text-headline-md">Newsletter</h4>
          <p className="text-label-sm font-label-sm opacity-70">
            Get the latest updates on exam strategies and batch announcements.
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-stack-lg pt-stack-lg border-t border-outline-variant/10 text-center">
        <p className="text-label-sm font-label-sm opacity-50">{copyright}</p>
      </div>
    </footer>
  );
}
