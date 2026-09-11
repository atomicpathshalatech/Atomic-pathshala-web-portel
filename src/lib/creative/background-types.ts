/** A CreativeBackground row's `value` JSON, shaped per `kind`. */
export type BackgroundValue =
  | { kind: "SOLID"; color: string }
  | { kind: "GRADIENT"; angleDeg: number; stops: string[] }
  | { kind: "IMAGE"; url: string; overlayColor?: string; overlayOpacity?: number };

/** Seeded default themes (spec section 5's named examples). Admins can add
 * more (custom solid/gradient/uploaded image) via the Backgrounds admin
 * page — these are just the starting set so the system is usable on day one. */
export const DEFAULT_THEMES: Array<{ key: string; name: string; value: BackgroundValue }> = [
  { key: "dark", name: "Dark", value: { kind: "GRADIENT", angleDeg: 135, stops: ["#0f172a", "#1e293b"] } },
  { key: "light", name: "Light", value: { kind: "GRADIENT", angleDeg: 135, stops: ["#f8fafc", "#e2e8f0"] } },
  { key: "blue", name: "Blue", value: { kind: "GRADIENT", angleDeg: 135, stops: ["#1e3a8a", "#2563eb"] } },
  { key: "purple", name: "Purple", value: { kind: "GRADIENT", angleDeg: 135, stops: ["#4c1d95", "#7c3aed"] } },
  { key: "red", name: "Red", value: { kind: "GRADIENT", angleDeg: 135, stops: ["#7f1d1d", "#dc2626"] } },
  { key: "green", name: "Green", value: { kind: "GRADIENT", angleDeg: 135, stops: ["#064e3b", "#059669"] } },
  { key: "black-gold", name: "Black / Gold", value: { kind: "GRADIENT", angleDeg: 135, stops: ["#000000", "#3f2d05"] } },
];

export function backgroundCss(v: BackgroundValue): string {
  if (v.kind === "SOLID") return v.color;
  if (v.kind === "GRADIENT") return `linear-gradient(${v.angleDeg}deg, ${v.stops.join(", ")})`;
  return "#0f172a"; // IMAGE kind renders as an <img> layer instead; this is only a fallback fill colour
}
