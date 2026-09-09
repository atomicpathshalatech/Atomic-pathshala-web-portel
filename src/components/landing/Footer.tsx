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
                  <span className="material-symbols-outlined text-surface-container-lowest">
                    {s.icon || "link"}
                  </span>
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
