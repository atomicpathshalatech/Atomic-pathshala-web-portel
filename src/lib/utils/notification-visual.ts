export type NotificationVariant =
  | "live"
  | "rescheduled"
  | "scheduled"
  | "test"
  | "material"
  | "offer"
  | "system";

export type NotificationVisual = {
  variant: NotificationVariant;
  icon: string;
  colorClass: string;
  bgClass: string;
  iconGradient: string;
  iconShadow: string;
  cardBorder: string;
  cardBg: string;
  cardHoverBorder: string;
  accentBar: string;
  badgeLabel?: string;
  badgeClass: string;
  actionBgClass: string;
  isLive?: boolean;
  isRescheduled?: boolean;
};

/**
 * Derives rich presentational visual configuration with unique color gradients,
 * icons, borders, and badges for different notification types across the platform:
 * - Live Now: Vibrant red/rose/amber gradient with live pulse
 * - Rescheduled: Amber/orange gradient with update icon
 * - Scheduled: Signature royal blue/indigo gradient
 * - Tests: Violet/purple gradient with quiz icon
 * - Study Material / DPP: Emerald/teal gradient
 * - Offers: Pink/rose gradient
 * - System/General: Sleek slate/navy gradient
 */
export function getNotificationVisual(
  typeOrTitle?: string | null,
  titleText?: string,
  bodyText?: string,
  category?: string
): NotificationVisual {
  const combined = `${typeOrTitle ?? ""} ${titleText ?? ""} ${bodyText ?? ""} ${category ?? ""}`.toLowerCase();
  const t = (typeOrTitle ?? "").toUpperCase();

  // 1. Live Class (Highest priority)
  if (
    t.includes("LIVE") ||
    t === "CLASS_LIVE" ||
    t === "CLASS_STARTED" ||
    t === "LIVE_CLASS_STARTED" ||
    combined.includes("live now") ||
    combined.includes("live class has started") ||
    combined.includes("class has started") ||
    combined.includes("tap to join now")
  ) {
    return {
      variant: "live",
      icon: "sensors",
      colorClass: "text-rose-600",
      bgClass: "bg-rose-500/10",
      iconGradient: "from-rose-500 via-red-500 to-amber-500",
      iconShadow: "shadow-rose-500/30",
      cardBorder: "border-rose-200/90 dark:border-rose-900/40",
      cardBg: "bg-gradient-to-r from-rose-50/50 via-white to-white dark:from-rose-950/20 dark:via-slate-900 dark:to-slate-900",
      cardHoverBorder: "hover:border-rose-400 dark:hover:border-rose-600",
      accentBar: "from-rose-500 to-amber-500",
      badgeLabel: "LIVE NOW",
      badgeClass: "bg-rose-600 text-white shadow-xs",
      actionBgClass: "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-xs shadow-rose-600/20",
      isLive: true,
    };
  }

  // 2. Rescheduled / Timing Change / Cancelled
  if (
    t.includes("RESCHEDULED") ||
    t.includes("CANCELLED") ||
    t.includes("DELETED") ||
    combined.includes("reschedul") ||
    combined.includes("postponed") ||
    combined.includes("timing change") ||
    combined.includes("time change") ||
    combined.includes("cancelled")
  ) {
    return {
      variant: "rescheduled",
      icon: "update",
      colorClass: "text-amber-600",
      bgClass: "bg-amber-500/10",
      iconGradient: "from-amber-500 via-orange-500 to-yellow-500",
      iconShadow: "shadow-amber-500/30",
      cardBorder: "border-amber-200/90 dark:border-amber-900/40",
      cardBg: "bg-gradient-to-r from-amber-50/40 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900",
      cardHoverBorder: "hover:border-amber-400 dark:hover:border-amber-600",
      accentBar: "from-amber-500 to-orange-500",
      badgeLabel: "RESCHEDULED",
      badgeClass: "bg-amber-500 text-white shadow-xs",
      actionBgClass: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800",
      isRescheduled: true,
    };
  }

  // 3. Test / Exam / Quiz / Result
  if (
    category === "TESTS" ||
    t.startsWith("TEST") ||
    combined.includes("test") ||
    combined.includes("exam") ||
    combined.includes("quiz") ||
    combined.includes("rank") ||
    combined.includes("result") ||
    combined.includes("mock")
  ) {
    return {
      variant: "test",
      icon: "quiz",
      colorClass: "text-purple-600",
      bgClass: "bg-purple-500/10",
      iconGradient: "from-violet-600 via-purple-600 to-indigo-600",
      iconShadow: "shadow-purple-500/30",
      cardBorder: "border-purple-200/90 dark:border-purple-900/40",
      cardBg: "bg-gradient-to-r from-purple-50/40 via-white to-white dark:from-purple-950/20 dark:via-slate-900 dark:to-slate-900",
      cardHoverBorder: "hover:border-purple-400 dark:hover:border-purple-600",
      accentBar: "from-violet-600 to-purple-600",
      badgeLabel: "TEST",
      badgeClass: "bg-purple-600 text-white shadow-xs",
      actionBgClass: "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-xs shadow-purple-600/20",
    };
  }

  // 4. Study Material / DPP / Notes / PDF
  if (
    category === "STUDY_MATERIAL" ||
    t.includes("DPP") ||
    t.includes("PDF") ||
    t.includes("PPT") ||
    t.includes("MATERIAL") ||
    t.includes("MODULE") ||
    combined.includes("dpp") ||
    combined.includes("pdf") ||
    combined.includes("notes") ||
    combined.includes("material") ||
    combined.includes("document") ||
    combined.includes("homework")
  ) {
    return {
      variant: "material",
      icon: "description",
      colorClass: "text-emerald-600",
      bgClass: "bg-emerald-500/10",
      iconGradient: "from-emerald-600 via-teal-600 to-cyan-600",
      iconShadow: "shadow-emerald-500/30",
      cardBorder: "border-emerald-200/90 dark:border-emerald-900/40",
      cardBg: "bg-gradient-to-r from-emerald-50/40 via-white to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900",
      cardHoverBorder: "hover:border-emerald-400 dark:hover:border-emerald-600",
      accentBar: "from-emerald-600 to-teal-600",
      badgeLabel: "MATERIAL",
      badgeClass: "bg-emerald-600 text-white shadow-xs",
      actionBgClass: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
    };
  }

  // 5. Offers / Discounts / Promotional
  if (
    category === "OFFERS" ||
    t.includes("OFFER") ||
    t.includes("PROMOTION") ||
    combined.includes("offer") ||
    combined.includes("discount") ||
    combined.includes("coupon")
  ) {
    return {
      variant: "offer",
      icon: "local_offer",
      colorClass: "text-pink-600",
      bgClass: "bg-pink-500/10",
      iconGradient: "from-pink-500 via-rose-500 to-red-500",
      iconShadow: "shadow-pink-500/30",
      cardBorder: "border-pink-200/90 dark:border-pink-900/40",
      cardBg: "bg-gradient-to-r from-pink-50/40 via-white to-white dark:from-pink-950/20 dark:via-slate-900 dark:to-slate-900",
      cardHoverBorder: "hover:border-pink-400 dark:hover:border-pink-600",
      accentBar: "from-pink-500 to-rose-600",
      badgeLabel: "OFFER",
      badgeClass: "bg-pink-600 text-white shadow-xs",
      actionBgClass: "bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800",
    };
  }

  // 6. Scheduled Class / Upcoming Lecture
  if (
    category === "CLASSES" ||
    t.includes("SCHEDULED") ||
    t.includes("REMINDER") ||
    combined.includes("class scheduled") ||
    combined.includes("scheduled for") ||
    combined.includes("new class") ||
    combined.includes("lecture")
  ) {
    return {
      variant: "scheduled",
      icon: "videocam",
      colorClass: "text-blue-600",
      bgClass: "bg-blue-500/10",
      iconGradient: "from-blue-600 via-indigo-600 to-cyan-500",
      iconShadow: "shadow-blue-500/30",
      cardBorder: "border-blue-200/90 dark:border-blue-900/40",
      cardBg: "bg-gradient-to-r from-blue-50/40 via-white to-white dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900",
      cardHoverBorder: "hover:border-blue-400 dark:hover:border-blue-600",
      accentBar: "from-blue-600 to-cyan-500",
      badgeLabel: "CLASS",
      badgeClass: "bg-blue-600 text-white shadow-xs",
      actionBgClass: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
    };
  }

  // 7. General / System Announcements
  return {
    variant: "system",
    icon: "notifications",
    colorClass: "text-slate-600",
    bgClass: "bg-slate-500/10",
    iconGradient: "from-slate-700 via-slate-800 to-blue-900",
    iconShadow: "shadow-slate-500/25",
    cardBorder: "border-slate-200 dark:border-slate-800",
    cardBg: "bg-white dark:bg-slate-900",
    cardHoverBorder: "hover:border-slate-300 dark:hover:border-slate-700",
    accentBar: "from-slate-600 to-blue-700",
    badgeLabel: "NOTICE",
    badgeClass: "bg-slate-700 text-white shadow-xs",
    actionBgClass: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  };
}
