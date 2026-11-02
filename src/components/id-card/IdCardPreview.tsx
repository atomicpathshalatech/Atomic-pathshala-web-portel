"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CARD_W = 324;
const CARD_H = 514;

/**
 * The card exactly as it prints: the same HTML document the PDF is made
 * from, in an isolated iframe, scaled to the available width.
 */
export function IdCardPreview({
  html,
  pdfHref,
  verifyUrl,
  canDownload,
}: {
  html: string;
  pdfHref: string;
  verifyUrl: string;
  canDownload: boolean;
}) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1.2, el.clientWidth / CARD_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setRefreshing(false), [html]);

  return (
    <div className="space-y-4">
      <div ref={boxRef} className="w-full max-w-[389px] mx-auto">
        <div
          className="mx-auto rounded-[22px] shadow-[0_18px_40px_-12px_rgba(10,36,99,0.45)]"
          style={{ width: CARD_W * scale, height: CARD_H * scale }}
        >
          <iframe
            title="Atomic Pathshala ID card"
            srcDoc={html}
            sandbox=""
            scrolling="no"
            className="border-0 block rounded-[18px] origin-top-left"
            style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {canDownload ? (
          <>
            <a
              href={pdfHref}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#0f3a9e] hover:bg-[#0a2463] text-white shadow-sm transition active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download PDF
            </a>
            <a
              href={`${pdfHref}&inline=1`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border border-outline-variant text-on-surface hover:bg-surface-container transition active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print
            </a>
          </>
        ) : null}
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border border-outline-variant text-on-surface hover:bg-surface-container transition active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          Verification page
        </a>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            router.refresh();
            setTimeout(() => setRefreshing(false), 4000);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border border-outline-variant text-on-surface hover:bg-surface-container transition active:scale-95"
        >
          <span className={`material-symbols-outlined text-[18px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
          Refresh
        </button>
      </div>
      {canDownload && (
        <p className="text-center text-xs text-on-surface-variant">
          Print at 100% / &quot;Actual size&quot; — the PDF is the standard ID-card size (54 × 85.6 mm).
        </p>
      )}
    </div>
  );
}
