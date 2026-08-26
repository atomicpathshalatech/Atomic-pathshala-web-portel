"use client";

import { useEffect, useState } from "react";

type LeaderboardEntry = {
  studentId: string;
  name: string;
  xp: number;
  level: number;
  rank: number;
  percentile: number;
};

type LeaderboardResponse = {
  window: "7d" | "all";
  topLearners: LeaderboardEntry[];
  me: LeaderboardEntry;
};

const VIEW_W = 320;
const VIEW_H = 110;
const BASE_Y = 96;
const CENTER_X = VIEW_W / 2;

// Static bell-shaped curve purely for visual framing (not a real fit to the
// student XP distribution — computing that live would need every student's
// XP client-side for no real benefit here). Only "me"'s marker position is
// real data: it's placed at my.percentile along the x-axis, on this curve.
function bellY(x: number) {
  return BASE_Y - 78 * Math.exp(-((x - CENTER_X) ** 2) / (2 * 55 ** 2));
}

function bellPath() {
  const points: string[] = [];
  for (let x = 6; x <= VIEW_W - 6; x += 4) {
    points.push(`${x},${bellY(x).toFixed(1)}`);
  }
  return `M ${points.join(" L ")}`;
}

const BELL_PATH = bellPath();

function percentileToX(percentile: number) {
  const clamped = Math.min(100, Math.max(0, percentile));
  return 6 + (clamped / 100) * (VIEW_W - 12);
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function LeaderboardBoard() {
  const [window_, setWindow] = useState<"all" | "7d">("all");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/student/leaderboard?window=${window_}`)
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't load the leaderboard.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json.data as LeaderboardResponse);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [window_]);

  const meInTop = data?.topLearners.some((l) => l.studentId === data.me.studentId) ?? false;

  return (
    <div className="space-y-stack-lg">
      {/* Window toggle */}
      <div className="flex gap-2">
        {(["all", "7d"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            className={`px-4 py-1.5 rounded-full text-label-md font-label-md transition-colors ${
              window_ === w
                ? "bg-primary text-on-primary"
                : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30"
            }`}
          >
            {w === "all" ? "All Time" : "This Week"}
          </button>
        ))}
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-6 text-center text-error font-body-sm">{error}</div>
      )}

      {!error && (loading || !data) && (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          Loading leaderboard…
        </div>
      )}

      {!error && data && (
        <>
          {/* Your position — bell curve with a marker at your real percentile */}
          <section className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                  Your Rank
                </p>
                <p className="font-headline-md text-headline-md text-on-surface mt-0.5">
                  #{data.me.rank} · Lvl {data.me.level} · {data.me.xp} XP
                </p>
              </div>
              <p className="text-body-sm text-on-surface-variant text-right">
                Better than <span className="font-bold text-primary">{data.me.percentile}%</span>
                <br />
                of learners
              </p>
            </div>
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-24 mt-2">
              <line x1={4} y1={BASE_Y} x2={VIEW_W - 4} y2={BASE_Y} className="stroke-outline-variant/40" strokeWidth={1} />
              <path d={BELL_PATH} fill="none" className="stroke-primary/40" strokeWidth={2} />
              <line
                x1={percentileToX(data.me.percentile)}
                y1={BASE_Y}
                x2={percentileToX(data.me.percentile)}
                y2={bellY(percentileToX(data.me.percentile))}
                className="stroke-primary"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <circle
                cx={percentileToX(data.me.percentile)}
                cy={bellY(percentileToX(data.me.percentile))}
                r={5}
                className="fill-primary"
              />
            </svg>
          </section>

          {/* Top 10 */}
          <section className="glass-card rounded-2xl p-2">
            <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide px-4 pt-3 pb-2">
              Top Learners · {data.window === "all" ? "All Time" : "This Week"}
            </h2>
            {data.topLearners.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant py-8 text-center">
                No XP earned yet — be the first on the board.
              </p>
            ) : (
              <div className="flex flex-col">
                {data.topLearners.map((entry) => {
                  const isMe = entry.studentId === data.me.studentId;
                  return (
                    <div
                      key={entry.studentId}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                        isMe ? "bg-primary-container/15" : ""
                      }`}
                    >
                      <span
                        className={`w-7 text-center font-label-md text-label-md shrink-0 ${
                          entry.rank <= 3 ? "text-primary font-bold" : "text-on-surface-variant"
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0">
                        {initials(entry.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-label-md text-label-md text-on-surface truncate">
                          {entry.name}
                          {isMe && <span className="text-primary"> (You)</span>}
                        </p>
                        <p className="text-label-sm text-on-surface-variant">Level {entry.level}</p>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface shrink-0">{entry.xp} XP</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pinned "me" row when I'm not already in the top 10 */}
            {!meInTop && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-container/15 border-t border-outline-variant/20 mt-1">
                <span className="w-7 text-center font-label-md text-label-md text-on-surface-variant shrink-0">
                  {data.me.rank}
                </span>
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0">
                  {initials(data.me.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface truncate">
                    {data.me.name} <span className="text-primary">(You)</span>
                  </p>
                  <p className="text-label-sm text-on-surface-variant">Level {data.me.level}</p>
                </div>
                <span className="font-label-md text-label-md text-on-surface shrink-0">{data.me.xp} XP</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
