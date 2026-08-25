"use client";

import { useEffect, useState } from "react";

function formatDiff(ms: number) {
  if (ms <= 0) return "Starting now";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Ticking "starts in HH:MM:SS" countdown. Takes the target time as an ISO
 * string prop and only reads the clock inside useEffect (client-only, after
 * mount) — never during render — so the server-rendered markup and the
 * first client render agree, avoiding a hydration mismatch.
 */
export function NextClassCountdown({ startsAtIso }: { startsAtIso: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const target = new Date(startsAtIso).getTime();
    const tick = () => setLabel(formatDiff(target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startsAtIso]);

  return (
    <div className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface tracking-tight tabular-nums">
      {label ?? "--:--:--"}
    </div>
  );
}
