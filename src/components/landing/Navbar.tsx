import Link from "next/link";

const NAV_LINKS = [
  { label: "Explore Courses", href: "#courses", active: true },
  { label: "Batches", href: "#batches" },
  { label: "Faculty", href: "#faculty" },
  { label: "Results", href: "#results" },
];

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
        <div className="font-headline-md text-headline-md font-bold tracking-tight text-primary">
          Atomic Pathshala
        </div>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={
                link.active
                  ? "font-label-md text-label-md text-primary font-bold border-b-2 border-primary pb-1"
                  : "font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden md:block font-label-md text-label-md text-primary px-4 py-2 hover:opacity-80 transition-all"
          >
            Login/Sign Up
          </Link>
          <Link
            href="/register"
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            Start Learning
          </Link>
        </div>
      </div>
    </nav>
  );
}
