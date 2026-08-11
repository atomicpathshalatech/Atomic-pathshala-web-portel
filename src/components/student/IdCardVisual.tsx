"use client";

import { useRef, useState } from "react";

type IdCardVisualProps = {
  name: string;
  initials: string;
  photoUrl: string | null;
  studentIdCode: string;
  batch: string;
  sessionLabel: string;
  dob: string;
  validUntil: string;
  qrDataUrl: string;
  statusLabel: string;
};

export function IdCardVisual({
  name,
  initials,
  photoUrl,
  studentIdCode,
  batch,
  sessionLabel,
  dob,
  validUntil,
  qrDataUrl,
  statusLabel,
}: IdCardVisualProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showShimmer, setShowShimmer] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = (y - rect.height / 2) / 20;
    const rotateY = (rect.width / 2 - x) / 20;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }

  function handleMouseLeave() {
    const card = cardRef.current;
    if (card) card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)";
    setShowShimmer(false);
  }

  return (
    <div className="relative w-full max-w-md group">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary-container rounded-[2rem] blur opacity-15 group-hover:opacity-30 transition duration-1000" />

      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setShowShimmer(true)}
        onMouseLeave={handleMouseLeave}
        className="relative glass-card !transition-transform !duration-300 rounded-[1.5rem] overflow-hidden aspect-[1.58/1] flex flex-col shadow-2xl"
        style={{ transformStyle: "preserve-3d" }}
      >
        {showShimmer && (
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
              backgroundSize: "200% 100%",
              animation: "idcard-shimmer 1.4s ease-out",
            }}
          />
        )}

        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />

        {/* Header */}
        <div className="p-6 flex justify-between items-start relative z-10">
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md font-bold text-primary">
              Atomic Pathshala
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
              Official Student Identity
            </span>
          </div>
          <div className="bg-primary/10 px-3 py-1 rounded-full text-[10px] font-bold text-primary uppercase border border-primary/20">
            {statusLabel}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 flex gap-6 flex-1 relative z-10">
          <div className="w-28 h-36 rounded-xl overflow-hidden border-2 border-white shadow-inner bg-primary/10 shrink-0 flex items-center justify-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-headline-lg text-headline-lg text-primary">{initials}</span>
            )}
          </div>

          <div className="flex flex-col justify-center py-2 min-w-0">
            <h3 className="font-headline-md text-on-surface leading-tight mb-1 truncate">{name}</h3>
            <p className="font-label-md text-primary mb-3">{studentIdCode}</p>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <div>
                <p className="text-[9px] uppercase tracking-tighter text-on-surface-variant font-bold">
                  Batch
                </p>
                <p className="text-xs font-semibold text-on-surface">{batch}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-tighter text-on-surface-variant font-bold">
                  Session
                </p>
                <p className="text-xs font-semibold text-on-surface">{sessionLabel}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-tighter text-on-surface-variant font-bold">
                  DOB
                </p>
                <p className="text-xs font-semibold text-on-surface">{dob}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-tighter text-on-surface-variant font-bold">
                  Valid Until
                </p>
                <p className="text-xs font-semibold text-on-surface">{validUntil}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-6 py-4 border-t border-primary/10 flex justify-between items-center relative z-10 bg-primary/5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">verified</span>
            <span className="text-[10px] font-bold text-primary/80 uppercase">
              Verified Digitally
            </span>
          </div>
          <div className="w-11 h-11 bg-white p-1 rounded-sm shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Student verification QR code" className="w-full h-full" />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes idcard-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}
