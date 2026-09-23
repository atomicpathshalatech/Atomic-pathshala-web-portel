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
  const [activeTab, setActiveTab] = useState<"store" | "badges" | "rules">("store");

  const xpRules = [
    {
      emoji: "📅",
      icon: "calendar_today",
      activity: "Daily App Login / Active Day",
      hindiDesc: "प्रतिदिन ऐप में लॉगिन या एक्टिव रहकर पढ़ाई करने पर",
      reward: "+10 XP",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    },
    {
      emoji: "📝",
      icon: "quiz",
      activity: "Question Practice / Quiz",
      hindiDesc: "प्रति सही उत्तर (+100% एक्यूरेसी पर एक्स्ट्रा बोनस XP)",
      reward: "+5 XP",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    {
      emoji: "📑",
      icon: "assignment",
      activity: "Daily Practice Paper (DPP)",
      hindiDesc: "प्रति सबमिट और कम्प्लीट की गई DPP शीट",
      reward: "+25 XP",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    {
      emoji: "🏆",
      icon: "emoji_events",
      activity: "Full Mock Test / Chapter Test",
      hindiDesc: "टेस्ट की अवधि, कठिनाई और स्कोर के अनुसार",
      reward: "+50 से +100 XP",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
    {
      emoji: "🔴",
      icon: "videocam",
      activity: "Live Class Attendance",
      hindiDesc: "पूरी लाइव क्लास समय पर अटेंड करने पर",
      reward: "+20 XP",
      badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
    {
      emoji: "🎥",
      icon: "smart_display",
      activity: "Recorded Lecture Video",
      hindiDesc: "रिकॉर्डेड वीडियो लेक्चर पूरा देखने पर",
      reward: "+15 XP",
      badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    },
    {
      emoji: "🛡️",
      icon: "shield",
      activity: "Streak Repair & Freeze",
      hindiDesc: "Reward Store से छूटी हुई स्ट्रीक रीस्टोर करने हेतु",
      reward: "150 XP Cost",
      badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    },
  ];

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

        <div className="flex flex-wrap items-center gap-2 bg-surface-container-lowest p-1.5 rounded-2xl border border-outline-variant/20 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
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
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "badges"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">military_tech</span>
            My Badges
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "rules"
                ? "bg-amber-400 text-amber-950 shadow-sm font-bold"
                : "text-amber-400/90 hover:text-amber-300"
            }`}
          >
            <span className="material-symbols-outlined text-sm">bolt</span>
            XP Guide
          </button>
        </div>
      </section>

      {/* Tab 1: Reward Store */}
      {activeTab === "store" && (
        <div className="space-y-6">
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

          {/* Quick inline trigger to view how XP is earned */}
          <div className="p-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-400 text-2xl">info</span>
              <div>
                <p className="text-xs font-bold text-on-surface">XP Points Kaise Milte Hain?</p>
                <p className="text-[11px] text-on-surface-variant">Daily login, tests, DPP, aur question practice se XP earn karein.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 shrink-0"
            >
              View XP Distribution Breakdown &rarr;
            </button>
          </div>
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

      {/* Tab 3: XP Distribution Breakdown Guide (प्लेटफ़ॉर्म पर XP Points कैसे मिलते हैं) */}
      {activeTab === "rules" && (
        <div className="glass-card rounded-2xl p-5 md:p-7 border border-outline-variant/30 space-y-5 bg-surface-container-lowest/70 backdrop-blur-md shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h2 className="font-headline-md text-base md:text-lg font-bold text-on-surface">
                  प्लेटफ़ॉर्म पर XP Points कैसे मिलते हैं (XP Distribution Breakdown)
                </h2>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                नीचे दी गई एक्टिविटीज़ को पूरा करके आप रोज़ाना अधिक से अधिक XP कमा सकते हैं और रिवॉर्ड्स अनलॉक कर सकते हैं:
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("store")}
              className="px-3 py-1.5 rounded-lg bg-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-container-highest transition-all self-start sm:self-auto"
            >
              Back to Store
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-high/80 text-on-surface font-semibold uppercase tracking-wider text-[11px] border-b border-outline-variant/20">
                <tr>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4">विवरण / Details</th>
                  <th className="py-3 px-4 text-right">XP Points Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {xpRules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-high/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{rule.emoji}</span>
                        <span className="font-semibold text-on-surface">{rule.activity}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {rule.hindiDesc}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-block font-mono font-bold px-2.5 py-1 rounded-full text-xs border ${rule.badgeColor}`}>
                        {rule.reward}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                Level Up System
              </h4>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                जैसे-जैसे आप XP कमाते हैं, आपका लेवल (Level 1 से Level 10+) बढ़ता जाता है और लीडरबोर्ड पर आपकी रैंक ऊपर होती है।
              </p>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-sm">local_fire_department</span>
                Streak Freeze & Repair
              </h4>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                अगर किसी दिन पढ़ाई छूट जाए, तो 150 XP खर्च करके आप अपनी पुरानी स्ट्रीक वापस रीस्टोर कर सकते हैं।
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
