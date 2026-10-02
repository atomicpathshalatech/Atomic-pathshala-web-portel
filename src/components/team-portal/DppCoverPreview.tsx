"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDppCoverQrs,
  DEFAULT_DPP_BRAND,
  DPP_COVER_CSS,
  renderDppCoverHtml,
  type DppBrand,
  type DppCoverInfo,
  type DppCoverQrs,
} from "@/lib/dpp/cover-html";

const FONTS =
  "https://fonts.googleapis.com/css2?family=PT+Serif:wght@400;700&family=Noto+Serif+Devanagari:wght@400;700&family=Montserrat:wght@600;700;800;900&family=JetBrains+Mono:wght@700&display=swap";

/** A4 page is 794 × 1123 CSS px. */
const PAGE_W = 794;
const PAGE_H = 1123;

/**
 * Live preview of the DPP PDF front page — the exact markup the PDF prints
 * (same renderer), with the configured YouTube / Telegram / website links.
 */
export function DppCoverPreview({ info, width = 360 }: { info: DppCoverInfo; width?: number }) {
  const [brand, setBrand] = useState<DppBrand>(DEFAULT_DPP_BRAND);
  const [qrs, setQrs] = useState<DppCoverQrs>({});
  const [origin, setOrigin] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/team/dpp/brand")
      .then((r) => r.json())
      .then((b) => {
        if (b?.success && b.data?.brand) setBrand(b.data.brand);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    buildDppCoverQrs(brand).then((q) => alive && setQrs(q));
    return () => {
      alive = false;
    };
  }, [brand]);

  const srcDoc = useMemo(() => {
    if (!origin) return "";
    const page = renderDppCoverHtml(info, brand, qrs, `${origin}/brand/logo.png`);
    return `<!doctype html><html><head><meta charset="utf-8"><link href="${FONTS}" rel="stylesheet"><style>html,body{margin:0;background:#fff}${DPP_COVER_CSS}</style></head><body>${page}</body></html>`;
  }, [info, brand, qrs, origin]);

  const scale = width / PAGE_W;
  return (
    <div
      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white"
      style={{ width, height: Math.round(PAGE_H * scale) }}
    >
      {srcDoc && (
        <iframe
          title="DPP front page preview"
          srcDoc={srcDoc}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          style={{ width: PAGE_W, height: PAGE_H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        />
      )}
    </div>
  );
}
