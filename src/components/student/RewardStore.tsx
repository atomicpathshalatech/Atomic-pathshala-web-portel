"use client";

import { useState } from "react";
import { toast } from "sonner";

type StoreItem = {
  id: string;
  title: string;
  description: string;
  costXp: number;
  icon: string;
  category: string;
};

type Badge = {
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: string;
};

export function RewardStore({
  initialXp,
  level,
  streak,
  items,
}: {
  initialXp: number;
  level: number;
  streak: number;
  items: StoreItem[];
}) {
  const [xp, setXp] = useState(initialXp);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"store" | "badges">("store");

  const badges: Badge[] = [
    {
      title: "Streak Master",
      description: "Maintain a study streak of 7+ continuous days.",
      icon: "local_fire_department",
      unlocked: streak >= 7,
      progress: `${streak}/7 Days`,
    },
    {
      title: "Rising Scholar",
      description: "Reach Gamification Level 5 by earning XP.",
      icon: "school",
      unlocked: level >= 5,
      progress: `Level ${level}/5`,
    },
    {
      title: "Century Club",
      description: "Accumulate more than 500 lifetime XP.",
      icon: "military_tech",
      unlocked: xp >= 500,
      progress: `${xp}/500 XP`,
    },
    {
      title: "Doubt Terminator",
      description: "Resolve and master 5 academic doubts.",
      icon: "live_help",
      unlocked: true,
      progress: "5/5 Doubts",
    },
  ];

  async function handleRedeem(item: StoreItem) {
    if (xp < item.costXp) {
      toast.error(`You need ${item.costXp - xp} more XP to unlock this reward.`);
      return;
    }

    setRedeemingId(item.id);
    try {
      const res = await fetch("/api/student/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not redeem reward.");
        return;
      }
      setXp(json.data.remainingXp);
      toast.success(json.message || `Unlocked ${item.title}!`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <div className="space-y-stack-lg">
      {/* Wallet Balance Hero Card */}
      <section className="glass-card rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden bg-gradient-to-r from-amber-500/15 via-primary/10 to-surface border border-amber-500/20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-3xl shadow-lg shrink-0">
            <span className="material-symbols-outlined text-4xl">savings</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Available Rewards Balance</p>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface flex items-center gap-2">
              <span className="font-mono text-3xl md:text-4xl text-primary">{xp}</span>
              <span className="text-sm font-normal text-on-surface-variant">XP Points</span>
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Level {level} Scholar &middot; {streak} Day Streak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-surface-container-lowest p-1.5 rounded-2xl border border-outline-variant/20 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "store"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">storefront</span>
            Rewards Store
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("badges")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "badges"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">military_tech</span>
            My Badges
          </button>
        </div>
      </section>

      {/* Tab 1: Reward Store */}
      {activeTab === "store" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const canAfford = xp >= item.costXp;
            const isPending = redeemingId === item.id;

            return (
              <div
                key={item.id}
                className="glass-card rounded-2xl p-6 flex flex-col justify-between hover:shadow-lg transition-all border border-outline-variant/30 relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                    </div>
                    <span className="font-mono text-sm font-bold px-3 py-1 rounded-full bg-amber-400/10 text-amber-500 border border-amber-400/30">
                      {item.costXp} XP
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-on-surface mb-1">{item.title}</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{item.description}</p>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    disabled={!canAfford || isPending}
                    onClick={() => handleRedeem(item)}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      canAfford
                        ? "bg-primary text-on-primary hover:opacity-90 active:scale-95 shadow-md"
                        : "bg-surface-container-high text-on-surface-variant opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isPending ? "progress_activity" : canAfford ? "lock_open" : "lock"}
                    </span>
                    {isPending ? "Redeeming..." : canAfford ? "Redeem Reward" : `Need ${item.costXp - xp} more XP`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Badges & Achievements */}
      {activeTab === "badges" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {badges.map((badge) => (
            <div
              key={badge.title}
              className={`glass-card rounded-2xl p-6 text-center space-y-3 border transition-all ${
                badge.unlocked
                  ? "border-amber-400/40 bg-gradient-to-b from-amber-400/10 to-surface shadow-md"
                  : "border-outline-variant/30 opacity-60"
              }`}
            >
              <div
                className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                  badge.unlocked
                    ? "bg-amber-400 text-amber-950 shadow-lg"
                    : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-3xl">{badge.icon}</span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-on-surface">{badge.title}</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{badge.description}</p>
              </div>

              <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs">
                <span className={badge.unlocked ? "text-amber-500 font-bold" : "text-on-surface-variant"}>
                  {badge.unlocked ? "Unlocked 🏆" : "Locked"}
                </span>
                <span className="text-[11px] font-mono text-on-surface-variant">{badge.progress}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
