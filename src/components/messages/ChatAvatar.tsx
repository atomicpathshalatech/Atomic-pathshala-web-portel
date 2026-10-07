"use client";

import React from "react";

const TONES = [
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-violet-600",
  "from-teal-500 to-cyan-600",
  "from-violet-500 to-purple-700",
];

export const toneFor = (name: string) =>
  TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

export function ChatAvatar({
  name,
  photoUrl,
  size = 44,
  ring = false,
  isOnline = false,
  type = "DIRECT",
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  ring?: boolean;
  isOnline?: boolean;
  type?: string;
}) {
  const isGroup = type === "BATCH_GROUP" || type === "BATCH" || type === "ANNOUNCEMENT";
  const isDoubt = type === "DOUBT_EXPERT" || type === "DOUBT";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  const cls = `rounded-full shrink-0 relative select-none ${
    ring ? "ring-2 ring-white dark:ring-slate-900" : ""
  }`;

  return (
    <div className="relative shrink-0 inline-block" style={{ width: size, height: size }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          style={{ width: size, height: size }}
          className={`${cls} object-cover`}
        />
      ) : isGroup ? (
        <div
          style={{ width: size, height: size, fontSize: size * 0.44 }}
          className={`${cls} bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-inner`}
        >
          <span className="material-symbols-outlined text-inherit">groups</span>
        </div>
      ) : isDoubt ? (
        <div
          style={{ width: size, height: size, fontSize: size * 0.44 }}
          className={`${cls} bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-inner`}
        >
          <span className="material-symbols-outlined text-inherit">help_center</span>
        </div>
      ) : (
        <div
          style={{ width: size, height: size, fontSize: size * 0.38 }}
          className={`${cls} bg-gradient-to-br ${toneFor(
            name
          )} text-white font-bold flex items-center justify-center shadow-inner`}
        >
          {initials}
        </div>
      )}

      {isOnline && (
        <span
          className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 ring-1 ring-emerald-400/50 shadow-sm"
          title="Online"
        />
      )}
    </div>
  );
}
