export type NotificationVisual = {
  icon: string;
  colorClass: string;
  bgClass: string;
};

/**
 * The schema doesn't have a "category" field on Notification (only
 * `channel`: IN_APP/EMAIL/WHATSAPP), so this derives a presentational
 * icon from the title text as a best-effort visual cue. It never invents
 * or alters the underlying data — purely cosmetic.
 */
export function getNotificationVisual(title: string): NotificationVisual {
  const t = title.toLowerCase();
  if (t.includes("test") || t.includes("result") || t.includes("rank")) {
    return { icon: "military_tech", colorClass: "text-tertiary", bgClass: "bg-tertiary/10" };
  }
  if (t.includes("class") || t.includes("live") || t.includes("lecture")) {
    return { icon: "videocam", colorClass: "text-primary", bgClass: "bg-primary/10" };
  }
  if (t.includes("note") || t.includes("dpp") || t.includes("document")) {
    return { icon: "description", colorClass: "text-secondary", bgClass: "bg-secondary/10" };
  }
  if (t.includes("payment") || t.includes("fee") || t.includes("invoice")) {
    return { icon: "receipt_long", colorClass: "text-error", bgClass: "bg-error/10" };
  }
  return { icon: "notifications", colorClass: "text-on-surface-variant", bgClass: "bg-outline-variant/20" };
}
