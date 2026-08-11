"use client";

import { useState } from "react";
import Link from "next/link";

const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Career", href: "/careers" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

const COURSE_LINKS = [
  { label: "NEET Preparation", href: "/courses/neet" },
  { label: "JEE Advanced", href: "/courses/jee" },
  { label: "Foundation (8-10)", href: "/courses/foundation" },
  { label: "Free Resources", href: "/resources" },
];

export function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    // TODO: wire to a real newsletter endpoint (e.g. /api/marketing/newsletter)
    // once the Marketing Portal is built in a later phase.
    await new Promise((r) => setTimeout(r, 600));
    setStatus("done");
    setEmail("");
  }

  return (
    <footer className="bg-inverse-surface text-surface-variant py-stack-lg border-t border-outline-variant/10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="col-span-2 md:col-span-1 space-y-4">
          <div className="font-headline-md text-headline-md font-bold text-surface-container-lowest">
            Atomic Pathshala
          </div>
          <p className="text-label-sm font-label-sm opacity-70">
            Empowering future doctors and engineers with high-performance learning
            strategies and premium educational tools.
          </p>
          <div className="flex gap-4">
            {["share", "mail", "call"].map((icon) => (
              <a
                key={icon}
                href="#"
                className="w-10 h-10 rounded-full bg-surface-variant/10 flex items-center justify-center hover:bg-primary transition-colors"
              >
                <span className="material-symbols-outlined text-surface-container-lowest">
                  {icon}
                </span>
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-surface-container-lowest font-headline-md text-headline-md mb-6">
            Company
          </h4>
          <ul className="space-y-3">
            {COMPANY_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-label-sm font-label-sm hover:text-surface-container-lowest hover:translate-x-1 transition-all inline-block"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-surface-container-lowest font-headline-md text-headline-md mb-6">
            Courses
          </h4>
          <ul className="space-y-3">
            {COURSE_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-label-sm font-label-sm hover:text-surface-container-lowest hover:translate-x-1 transition-all inline-block"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 md:col-span-1 space-y-6">
          <h4 className="text-surface-container-lowest font-headline-md text-headline-md">
            Newsletter
          </h4>
          <p className="text-label-sm font-label-sm opacity-70">
            Get the latest updates on exam strategies and batch announcements.
          </p>
          <form onSubmit={handleSubscribe} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="bg-surface-variant/10 border-none rounded-lg flex-1 text-label-sm font-label-sm py-3 px-4 focus:ring-2 focus:ring-primary text-surface-container-lowest placeholder-surface-variant/50"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              aria-label="Subscribe"
              className="bg-primary text-on-primary p-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined">
                {status === "done" ? "check" : "send"}
              </span>
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-stack-lg pt-stack-lg border-t border-outline-variant/10 text-center">
        <p className="text-label-sm font-label-sm opacity-50">
          © {new Date().getFullYear()} Atomic Pathshala. Accelerating Excellence.
        </p>
      </div>
    </footer>
  );
}
