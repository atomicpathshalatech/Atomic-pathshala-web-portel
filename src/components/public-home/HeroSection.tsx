import { ButtonLink, CONTAINER, Icon } from "./ui";

/** Lightweight SVG composition (atom, DNA, molecule, book, formulas) — no 3D library, no images to download. */
function HeroArt() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]" aria-hidden="true">
      <style>{`
        @keyframes ap-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes ap-spin { to { transform: rotate(360deg) } }
        .ap-float { animation: ap-float 6s ease-in-out infinite; }
        .ap-float-slow { animation: ap-float 8s ease-in-out infinite; }
        .ap-orbit { transform-origin: 220px 220px; animation: ap-spin 40s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ap-float, .ap-float-slow, .ap-orbit { animation: none } }
      `}</style>
      <div className="absolute inset-6 rounded-full bg-gradient-to-br from-blue-100 via-cyan-50 to-white" />
      <svg viewBox="0 0 440 440" className="relative h-full w-full">
        {/* atom */}
        <g className="ap-orbit" fill="none" stroke="#2563eb" strokeOpacity="0.35" strokeWidth="2">
          <ellipse cx="220" cy="220" rx="150" ry="52" />
          <ellipse cx="220" cy="220" rx="150" ry="52" transform="rotate(60 220 220)" />
          <ellipse cx="220" cy="220" rx="150" ry="52" transform="rotate(120 220 220)" />
          <circle cx="370" cy="220" r="7" fill="#06b6d4" stroke="none" />
          <circle cx="145" cy="90" r="6" fill="#2563eb" stroke="none" />
          <circle cx="145" cy="350" r="6" fill="#f97316" stroke="none" />
        </g>
        <circle cx="220" cy="220" r="26" fill="#1d4ed8" />
        <circle cx="212" cy="212" r="8" fill="#93c5fd" />
        {/* book */}
        <g className="ap-float" transform="translate(150 300)">
          <path d="M0 18 C30 4 60 4 70 14 C80 4 110 4 140 18 L140 70 C110 58 80 58 70 68 C60 58 30 58 0 70 Z" fill="#fff" stroke="#0b1736" strokeOpacity="0.15" strokeWidth="2" />
          <path d="M70 14 L70 68" stroke="#0b1736" strokeOpacity="0.2" strokeWidth="2" />
          <path d="M14 30 H56 M14 42 H50 M84 30 H126 M84 42 H118" stroke="#2563eb" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
        </g>
        {/* DNA */}
        <g className="ap-float-slow" transform="translate(52 120)" strokeWidth="3" strokeLinecap="round">
          <path d="M0 0 C30 25 30 55 0 80 C-30 105 -30 135 0 160" fill="none" stroke="#06b6d4" />
          <path d="M0 0 C-30 25 -30 55 0 80 C30 105 30 135 0 160" fill="none" stroke="#2563eb" />
          <path d="M-18 20 H18 M-22 40 H22 M-18 60 H18 M-18 100 H18 M-22 120 H22 M-18 140 H18" stroke="#0b1736" strokeOpacity="0.2" />
        </g>
        {/* molecule */}
        <g className="ap-float" transform="translate(320 70)">
          <path d="M0 30 L30 12 L60 30 L60 64 L30 82 L0 64 Z" fill="none" stroke="#0b1736" strokeOpacity="0.35" strokeWidth="2.5" />
          <circle cx="30" cy="12" r="6" fill="#2563eb" />
          <circle cx="60" cy="64" r="6" fill="#06b6d4" />
          <circle cx="0" cy="64" r="6" fill="#0b1736" fillOpacity="0.6" />
        </g>
        {/* formula chips */}
        <g fontFamily="ui-serif, Georgia, serif" fontStyle="italic" fill="#0b1736">
          <g className="ap-float-slow" transform="translate(300 330)">
            <rect x="-6" y="-24" width="116" height="36" rx="10" fill="#fff" stroke="#e2e8f0" />
            <text x="8" y="0" fontSize="19">E = mc²</text>
          </g>
          <g className="ap-float" transform="translate(36 340)">
            <rect x="-6" y="-24" width="92" height="36" rx="10" fill="#fff" stroke="#e2e8f0" />
            <text x="6" y="0" fontSize="18">∫ f(x)dx</text>
          </g>
          <g className="ap-float-slow" transform="translate(250 40)">
            <rect x="-6" y="-24" width="70" height="36" rx="10" fill="#fff" stroke="#e2e8f0" />
            <text x="6" y="0" fontSize="18">pH 7</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-white to-white">
      <div className={`${CONTAINER} grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20`}>
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
            <span>NEET</span>
            <span className="text-slate-300">•</span>
            <span>JEE</span>
            <span className="text-slate-300">•</span>
            <span>BOARDS</span>
          </p>
          <h1 className="mt-4 text-[34px] leading-[1.1] font-extrabold tracking-tight text-[#0b1736] sm:text-5xl lg:text-[56px]">
            Learn Better. <span className="text-blue-600">Practice More.</span> Score Higher.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
            Complete preparation for Class 10, 11, 12, NEET &amp; JEE with free classes, PYQs, notes, tests and expert guidance.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#free">
              Explore Free Resources <Icon name="arrow_forward" className="text-[18px]" />
            </ButtonLink>
            <ButtonLink href="#courses" variant="secondary">
              Explore Courses
            </ButtonLink>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-1.5">
              <Icon name="translate" className="text-[18px] text-blue-600" /> Hindi + English Medium
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="school" className="text-[18px] text-blue-600" /> Class 10, 11, 12
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="lock_open" className="text-[18px] text-blue-600" /> Free resources with a free account
            </li>
          </ul>
        </div>
        <HeroArt />
      </div>
    </section>
  );
}
