/**
 * Professional chroma key (green / blue screen) for the teacher's camera.
 *
 * A multi-pass WebGL pipeline, built so the person is preserved first and the
 * screen removed second:
 *
 *   1. KEY (working resolution ≤ 640 px): a *normalized copy* of the frame —
 *      exposure, shadow lift, white balance, mild denoise — is used only to
 *      decide what is screen. In YCbCr, each pixel's chroma is measured as a
 *      fraction of the screen's own chroma ("unmixing"), so a hair strand that
 *      is half screen gets alpha ≈ 0.5 instead of being deleted; shadow
 *      tolerance compares chroma relative to brightness so a shadowed screen
 *      still keys; a skin-confidence layer keeps faces and hands solid.
 *   2. REFINE: edge-aware (colour-guided) smoothing of the alpha, feathering,
 *      gentle clean-up of specks/holes (never large erosion), and an
 *      "edge proximity" map for spill removal.
 *   3. TEMPORAL: motion-aware blending with the previous frame's alpha —
 *      steady when still (no flicker), immediate when the teacher moves.
 *   4. COMPOSITE (camera resolution): the ORIGINAL camera colours, never the
 *      normalized copy; green spill removed only from the screen-ward edge
 *      pixels (the key-colour component of their chroma, brightness kept);
 *      optional subtle shadow lift ("natural face") for low light; output is
 *      premultiplied alpha, drawn straight over the whiteboard.
 *
 * Lighting is sampled about once a second and classified (bright / normal /
 * low / very low) with hysteresis, so AUTO mode adapts without flicker.
 *
 * Used by the stage compositor (what goes to YouTube), the teacher's camera
 * preview and the settings panel, so all three look identical.
 */

export type ChromaMode = "PRO" | "FAST";
export type ChromaPreset = "AUTO" | "BRIGHT" | "NORMAL" | "LOW" | "VERY_LOW";
export type LightClass = Exclude<ChromaPreset, "AUTO">;
export type ChromaDebugView = "none" | "raw" | "alpha" | "edge" | "skin" | "work";

export interface ChromaSettings {
  enabled: boolean;
  /** PRO = full pipeline; FAST = key + composite only (very slow machines). */
  mode: ChromaMode;
  /** Lighting preset; AUTO follows the room. */
  preset: ChromaPreset;
  /** Screen colour, "#rrggbb". */
  keyColor: string;
  // CHROMA
  /** 0–1: how much of the screen colour must be present to remove a pixel (higher = removes more). */
  threshold: number;
  /** 0–1: width of the soft transition (hair, beard, shoulders). */
  softness: number;
  /** 0–1: green-spill removal on edges. */
  spill: number;
  /** 0–1: how well shadowed / darker parts of the screen are still removed. */
  shadowTolerance: number;
  // EDGE
  /** 0–1: edge feather (edge-aware). */
  feather: number;
  /** 0–1: removes specks of screen and fills pin-holes in the person. */
  cleanup: number;
  /** 0–1: keeps semi-transparent hair strands. */
  hairDetail: number;
  /** 0–3: denoise for grainy cameras (key decision only). */
  denoise: number;
  /** 0–1: steadiness between frames (anti-flicker). */
  stability: number;
  // FACE
  /** 0–1: protects skin from being keyed. */
  skinProtect: number;
  /** 0–1: subtle shadow lift on the person (no beauty filter). */
  faceEnhance: number;
  // LIGHTING (working copy for keying only — never the visible colours)
  /** 0.5–2.5 */
  exposure: number;
  /** 0.5–2.5 (>1 lifts shadows) */
  shadows: number;
  /** 0.5–2 */
  contrast: number;
  // COLOR (visible, subtle)
  /** -1–1 warm/cool */
  temperature: number;
  /** -1–1 magenta/green */
  tint: number;
  /** 0–2 */
  saturation: number;
  /** A very soft shadow of the teacher on the board. */
  naturalShadow: boolean;
}

export const DEFAULT_CHROMA: ChromaSettings = {
  enabled: false,
  mode: "PRO",
  preset: "AUTO",
  keyColor: "#00b140",
  threshold: 0.5,
  softness: 0.45,
  spill: 0.6,
  shadowTolerance: 0.5,
  feather: 0.35,
  cleanup: 0.5,
  hairDetail: 0.6,
  denoise: 1,
  stability: 0.5,
  skinProtect: 0.7,
  faceEnhance: 0.25,
  exposure: 1,
  shadows: 1,
  contrast: 1,
  temperature: 0,
  tint: 0,
  saturation: 1,
  naturalShadow: false,
};

/** Values each lighting preset starts from (AUTO picks one from the room). */
export const PRESET_LIGHTING: Record<LightClass, { exposure: number; shadows: number; faceLift: number; denoise: number; soft: number }> = {
  BRIGHT: { exposure: 1, shadows: 1, faceLift: 0, denoise: 1, soft: 0 },
  NORMAL: { exposure: 1.05, shadows: 1.1, faceLift: 0.1, denoise: 1, soft: 0.03 },
  LOW: { exposure: 1.3, shadows: 1.4, faceLift: 0.3, denoise: 2, soft: 0.08 },
  VERY_LOW: { exposure: 1.6, shadows: 1.7, faceLift: 0.4, denoise: 3, soft: 0.14 },
};

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

/** Accepts anything (localStorage / IPC / older builds) and returns valid settings. */
export function sanitizeChroma(input: unknown): ChromaSettings {
  const v = (input && typeof input === "object" ? input : {}) as Partial<ChromaSettings> & {
    similarity?: number;
    smoothness?: number;
    brightness?: number;
    gamma?: number;
  };
  const num = (x: unknown, d: number, lo: number, hi: number) => clamp(Number(x ?? d), lo, hi);
  // Older builds: similarity/smoothness/brightness/gamma.
  const legacyThreshold = v.threshold === undefined && v.similarity !== undefined ? clamp(Number(v.similarity) + 0.1, 0, 1) : undefined;
  const legacySoft = v.softness === undefined && v.smoothness !== undefined ? clamp(Number(v.smoothness) * 2 + 0.3, 0, 1) : undefined;
  const legacyShadows = v.shadows === undefined && v.gamma !== undefined ? Number(v.gamma) : undefined;
  const legacyExposure = v.exposure === undefined && v.brightness !== undefined ? 1 + Number(v.brightness) : undefined;
  return {
    enabled: Boolean(v.enabled),
    mode: v.mode === "FAST" ? "FAST" : "PRO",
    preset: (["AUTO", "BRIGHT", "NORMAL", "LOW", "VERY_LOW"] as const).includes(v.preset as ChromaPreset) ? (v.preset as ChromaPreset) : "AUTO",
    keyColor: typeof v.keyColor === "string" && /^#[0-9a-f]{6}$/i.test(v.keyColor) ? v.keyColor : DEFAULT_CHROMA.keyColor,
    threshold: num(legacyThreshold ?? v.threshold, DEFAULT_CHROMA.threshold, 0, 1),
    softness: num(legacySoft ?? v.softness, DEFAULT_CHROMA.softness, 0, 1),
    spill: num(v.spill, DEFAULT_CHROMA.spill, 0, 1),
    shadowTolerance: num(v.shadowTolerance, DEFAULT_CHROMA.shadowTolerance, 0, 1),
    feather: num(v.feather, DEFAULT_CHROMA.feather, 0, 1),
    cleanup: num(v.cleanup, DEFAULT_CHROMA.cleanup, 0, 1),
    hairDetail: num(v.hairDetail, DEFAULT_CHROMA.hairDetail, 0, 1),
    denoise: Math.round(num(v.denoise, DEFAULT_CHROMA.denoise, 0, 3)),
    stability: num(v.stability, DEFAULT_CHROMA.stability, 0, 0.95),
    skinProtect: num(v.skinProtect, DEFAULT_CHROMA.skinProtect, 0, 1),
    faceEnhance: num(v.faceEnhance, DEFAULT_CHROMA.faceEnhance, 0, 1),
    exposure: num(legacyExposure ?? v.exposure, DEFAULT_CHROMA.exposure, 0.5, 2.5),
    shadows: num(legacyShadows ?? v.shadows, DEFAULT_CHROMA.shadows, 0.5, 2.5),
    contrast: num(v.contrast, DEFAULT_CHROMA.contrast, 0.5, 2),
    temperature: num(v.temperature, DEFAULT_CHROMA.temperature, -1, 1),
    tint: num(v.tint, DEFAULT_CHROMA.tint, -1, 1),
    saturation: num(v.saturation, DEFAULT_CHROMA.saturation, 0, 2),
    naturalShadow: Boolean(v.naturalShadow),
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** CbCr of an RGB colour (0–1), same transform as the shaders. */
export function rgbToCbCr([r, g, b]: [number, number, number]): [number, number] {
  return [-0.1687 * r - 0.3313 * g + 0.5 * b + 0.5, 0.5 * r - 0.4187 * g - 0.0813 * b + 0.5];
}

const lumaOf = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ---------------------------------------------------------------------------
// Frame analysis (CPU, on a small copy): Auto Chroma + Check Camera.
// ---------------------------------------------------------------------------

export type ChromaAnalysis = {
  screenFound: boolean;
  keyColor: string | null;
  /** 0–1 mean brightness of the whole frame. */
  brightness: number;
  light: LightClass;
  /** Coefficient of variation of the screen's brightness (unevenness). */
  screenUnevenness: number;
  /** Rough sensor noise (screen pixel-to-pixel luma differences). */
  noise: number;
  /** Fraction of clipped pixels (pure black / white). */
  clipping: number;
  /** How clearly the screen differs from the centre (person) — 0–1. */
  separation: number;
  verdict: {
    camera: "Good" | "Fair" | "Poor";
    lighting: "Good" | "Low" | "Very Low";
    screen: "Good" | "Uneven" | "Not detected";
    recommended: string;
  };
  /** Settings to apply (Auto Chroma). */
  suggested: Partial<ChromaSettings>;
  message: string | null;
};

function classifyLight(mean: number): LightClass {
  if (mean >= 0.55) return "BRIGHT";
  if (mean >= 0.32) return "NORMAL";
  if (mean >= 0.17) return "LOW";
  return "VERY_LOW";
}

/**
 * Looks at one camera frame (RGBA pixels) and works out the screen colour,
 * lighting, screen evenness, noise and a starting chroma setup. The screen is
 * sampled where it nearly always is — the top band and the upper side
 * columns — never the bottom edge (shoulders / shirt).
 */
export function analyzeChromaFrame(px: Uint8ClampedArray, w: number, h: number): ChromaAnalysis {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [px[i]! / 255, px[i + 1]! / 255, px[i + 2]! / 255] as [number, number, number];
  };
  // Whole-frame light statistics.
  let sumY = 0;
  let clipped = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 90));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const [r, g, b] = at(x, y);
      const Y = lumaOf(r, g, b);
      sumY += Y;
      if (Y < 0.02 || Y > 0.98) clipped++;
      count++;
    }
  }
  const brightness = count ? sumY / count : 0;

  // Candidate screen pixels: top 18 % band + upper 60 % of the side 12 % columns.
  const cand: [number, number, number][] = [];
  for (let y = 0; y < h * 0.6; y += step) {
    for (let x = 0; x < w; x += step) {
      const inTop = y < h * 0.18;
      const inSide = x < w * 0.12 || x > w * 0.88;
      if (!inTop && !inSide) continue;
      const c = at(x, y);
      const max = Math.max(...c);
      const min = Math.min(...c);
      if (max < 0.06 || max - min < 0.05) continue; // grey / black — not a coloured screen
      cand.push(c);
    }
  }
  // Dominant chroma: median Cb / Cr of the candidates, then keep those close to it.
  const median = (a: number[]) => {
    const s = [...a].sort((p, q) => p - q);
    return s.length ? s[Math.floor(s.length / 2)]! : 0;
  };
  const cbcrs = cand.map((c) => rgbToCbCr(c));
  const mcb = median(cbcrs.map((v) => v[0]));
  const mcr = median(cbcrs.map((v) => v[1]));
  const kmag = Math.hypot(mcb - 0.5, mcr - 0.5);
  // Chroma relative to brightness, so a dark room's dim screen is still found.
  const candY = median(cand.map((c) => lumaOf(...c)));
  const close = cand.filter((_, i) => Math.hypot(cbcrs[i]![0] - mcb, cbcrs[i]![1] - mcr) < Math.max(0.02, kmag * 0.45));
  // A painted / pastel green wall is far less saturated than a studio
  // screen but still keys well. Accept low chroma as long as the hue is a
  // screen hue (green: Cb and Cr both below neutral; blue: Cb well above) —
  // a beige / grey / skin-coloured wall is never taken for a screen.
  const gcb = mcb - 0.5;
  const gcr = mcr - 0.5;
  const screenHue = (gcr < -0.015 && gcb < 0.03) || (gcb > 0.05 && gcr < 0.02);
  const screenFound = close.length >= Math.max(12, cand.length * 0.35) && screenHue && kmag > 0.025 && kmag / (candY + 0.06) > 0.06;

  let keyColor: string | null = null;
  let screenUnevenness = 0;
  let noise = 0;
  let separation = 0;
  if (screenFound) {
    const avg = [0, 1, 2].map((k) => close.reduce((s, c) => s + c[k]!, 0) / close.length) as [number, number, number];
    keyColor = `#${avg.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("")}`;
    const ys = close.map((c) => lumaOf(...c));
    const my = ys.reduce((s, y) => s + y, 0) / ys.length;
    const sd = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0) / ys.length);
    screenUnevenness = my > 0 ? sd / my : 0;
    // Noise: neighbour differences along the top band.
    let nd = 0;
    let nn = 0;
    for (let x = 1; x < w - 1; x += step) {
      const y = Math.floor(h * 0.06);
      nd += Math.abs(lumaOf(...at(x, y)) - lumaOf(...at(x + 1, y)));
      nn++;
    }
    noise = nn ? nd / nn : 0;
    // Separation: how many centre pixels (where the person usually is) are clearly NOT the screen.
    const kh = [(mcb - 0.5) / kmag, (mcr - 0.5) / kmag];
    let fg = 0;
    let all = 0;
    for (let y = Math.floor(h * 0.35); y < h * 0.95; y += step) {
      for (let x = Math.floor(w * 0.3); x < w * 0.7; x += step) {
        const [cb, cr] = rgbToCbCr(at(x, y));
        const along = ((cb - 0.5) * kh[0]! + (cr - 0.5) * kh[1]!) / kmag;
        if (along < 0.35) fg++;
        all++;
      }
    }
    separation = all ? fg / all : 0;
  }

  const light = classifyLight(brightness);
  const clipping = count ? clipped / count : 0;
  const lighting = light === "VERY_LOW" ? "Very Low" : light === "LOW" ? "Low" : "Good";
  const screen = !screenFound ? "Not detected" : screenUnevenness > 0.18 ? "Uneven" : "Good";
  const camScore = (noise < 0.02 ? 2 : noise < 0.045 ? 1 : 0) + (clipping < 0.05 ? 1 : 0) + (light === "VERY_LOW" ? -1 : 0);
  const camera = camScore >= 3 ? "Good" : camScore >= 1 ? "Fair" : "Poor";
  const recommended = !screenFound
    ? "Improve the lighting on the green screen (Hybrid mode is coming in the next phase)"
    : light === "VERY_LOW"
    ? "Professional · Very Low Light"
    : light === "LOW"
    ? "Professional · Low Light"
    : "Professional · Auto";

  const p = PRESET_LIGHTING[light];
  const suggested: Partial<ChromaSettings> = screenFound
    ? {
        enabled: true,
        mode: "PRO",
        keyColor: keyColor!,
        // Duller / darker screens get a slightly higher threshold; uneven ones more shadow tolerance.
        threshold: clamp(0.5 + (kmag < 0.12 ? 0.08 : 0) + (screenUnevenness > 0.15 ? 0.05 : 0), 0.3, 0.75),
        softness: clamp(0.4 + p.soft + (noise > 0.03 ? 0.08 : 0), 0.2, 0.8),
        shadowTolerance: clamp(0.4 + screenUnevenness * 2, 0.3, 0.9),
        spill: 0.6,
        denoise: Math.max(p.denoise, noise > 0.04 ? 2 : 1),
        cleanup: noise > 0.04 ? 0.6 : 0.5,
        hairDetail: 0.6,
        skinProtect: 0.7,
        faceEnhance: clamp(0.15 + p.faceLift * 0.5, 0, 0.6),
      }
    : {};
  const message = !screenFound
    ? "Green screen not detected clearly. Try improving the lighting on the screen, or move so the screen fills the top and sides of the picture."
    : light === "VERY_LOW" || light === "LOW"
    ? `${light === "LOW" ? "Low" : "Very low"} light detected — low-light processing enabled.`
    : null;
  return {
    screenFound,
    keyColor,
    brightness,
    light,
    screenUnevenness,
    noise,
    clipping,
    separation,
    verdict: { camera, lighting, screen, recommended },
    suggested,
    message,
  };
}

/** Kept for older callers: the screen colour from a frame, or null. */
export function detectKeyColor(pixels: Uint8ClampedArray, w: number, h: number): string | null {
  return analyzeChromaFrame(pixels, w, h).keyColor;
}

// ---------------------------------------------------------------------------
// Shaders (WebGL 1)
// ---------------------------------------------------------------------------

const VERT = `
attribute vec2 p;
varying vec2 uv;
uniform float flipY;
void main() {
  uv = vec2((p.x + 1.0) * 0.5, (p.y + 1.0) * 0.5);
  if (flipY > 0.5) uv.y = 1.0 - uv.y;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 cbcr(vec3 c) { return vec2(-0.1687 * c.r - 0.3313 * c.g + 0.5 * c.b, 0.5 * c.r - 0.4187 * c.g - 0.0813 * c.b); }
`;

// 1. KEY — normalized working copy → soft alpha + skin + working luma.
const KEY_FRAG = `${COMMON}
uniform sampler2D src;
uniform vec2 srcTexel;
uniform vec2 keyC;      // key chroma (centered) in the working space
uniform float keyY;     // key luma in the working space
uniform float t0, t1, shadowTol, skinProtect, exposure, shadows, contrast, hairDetail;
uniform vec3 wb;
uniform int radius;

vec3 work(vec3 c) {
  c = c * wb * exposure;
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / shadows));          // shadow lift, highlights protected
  c = (c - 0.5) * contrast + 0.5;
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec3 acc = vec3(0.0);
  float n = 0.0;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      if (dx >= -radius && dx <= radius && dy >= -radius && dy <= radius) {
        acc += work(texture2D(src, uv + vec2(float(dx), float(dy)) * srcTexel).rgb);
        n += 1.0;
      }
    }
  }
  // Hair-aware: a thin strand is darker than its 3×3 surroundings. There the
  // pixel's own colour is used (not the denoise average, which would blend it
  // into the screen) and shadow tolerance is reduced (a strand over the screen
  // looks like a "shadowed screen" pixel otherwise).
  vec3 c0 = work(texture2D(src, uv).rgb);
  float Y0 = luma(c0);
  float ym = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ym += luma(work(texture2D(src, uv + vec2(float(dx), float(dy)) * srcTexel).rgb));
    }
  }
  ym /= 9.0;
  float detail = clamp((ym - Y0) / (ym + 0.05) * 3.0, 0.0, 1.0) * hairDetail;
  vec3 c = mix(acc / n, c0, detail);
  float Y = luma(c);
  vec2 v = cbcr(c);
  // Shadow tolerance: compare chroma relative to brightness, so a shadowed
  // part of the screen (same hue, less light) still reads as screen. Damped
  // for very dark pixels so camera noise in black hair isn't amplified.
  // The boost is capped, and pixels far darker than the screen (black hair,
  // beard, a dark shirt) get no shadow tolerance at all — with a bright,
  // pale screen their faint colour cast would otherwise read as "screen".
  vec2 vRel = v * min((keyY + 0.12) / (Y + 0.12), 2.2);
  float shadowOk = smoothstep(0.18 * keyY, 0.45 * keyY, Y);
  vec2 vv = mix(v, vRel, shadowTol * shadowOk * (1.0 - detail));
  float kmag = max(length(keyC), 0.02);
  vec2 kh = keyC / kmag;
  float along = dot(vv, kh) / kmag;                            // 1 = fully screen, 0 = no screen colour
  float perp = abs(vv.x * kh.y - vv.y * kh.x) / kmag;          // off the screen's hue
  float score = along - perp * 0.9;
  float alpha = 1.0 - smoothstep(t0, t1, score);
  // On a strand, alpha follows how much of the pixel is NOT screen colour
  // (linear unmixing): a pixel that is 45 % hair keeps ~45 % — visible hair.
  float alongRaw = dot(v, kh) / kmag;
  alpha = mix(alpha, max(alpha, clamp(1.0 - alongRaw, 0.0, 1.0)), detail);
  // Skin confidence (normalized YCbCr, no fixed person colour).
  vec2 sc = v + 0.5;
  float skin = (1.0 - smoothstep(0.06, 0.10, abs(sc.y - 0.6))) * (1.0 - smoothstep(0.085, 0.12, abs(sc.x - 0.41))) * smoothstep(0.06, 0.14, Y);
  alpha = max(alpha, skin * skinProtect * (1.0 - smoothstep(0.75, 1.0, along)));
  gl_FragColor = vec4(alpha, skin, Y, detail);   // a = "fine detail here" for the refine pass
}`;

// 2. REFINE — edge-aware smoothing guided by the camera colour, clean-up, edge proximity.
const REFINE_FRAG = `${COMMON}
uniform sampler2D mask;
uniform sampler2D src;
uniform vec2 maskTexel;
uniform float spread, clipLo, clipHi, colorSigma, holeFill;

void main() {
  vec3 g0 = texture2D(src, uv).rgb;
  float sum = 0.0, wsum = 0.0, mn = 1.0;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      vec2 o = vec2(float(dx), float(dy)) * maskTexel * spread;
      float a = texture2D(mask, uv + o).r;
      vec3 g = texture2D(src, uv + o).rgb;
      vec3 d = g - g0;
      float w = exp(-dot(d, d) * colorSigma) * exp(-float(dx * dx + dy * dy) * 0.18);
      sum += a * w;
      wsum += w;
      mn = min(mn, a);
    }
  }
  vec4 raw = texture2D(mask, uv);
  float a = sum / max(wsum, 1e-4);
  a = smoothstep(clipLo, clipHi, a);
  // Fine detail (hair strands) keeps its own unmixed alpha — smoothing or
  // clean-up would dissolve a 1-pixel strand into the screen around it.
  a = mix(a, max(a, raw.r), smoothstep(0.1, 0.5, raw.a));
  // Hole fill: a pixel enclosed by the person on (nearly) all sides — a
  // reflection of the screen on glossy hair, a green shirt print — is part of
  // the person. Outer edges and hair strands have screen on one side, so
  // they are never filled.
  float enclosed = 0.0;
  float thin = 0.0;
  for (int k = 0; k < 4; k++) {
    float ang = float(k) * 0.785398;
    vec2 dir = vec2(cos(ang), sin(ang)) * maskTexel;
    float nearA = max(step(0.85, texture2D(mask, uv + dir * 6.0).r), step(0.85, texture2D(mask, uv + dir * 11.0).r));
    float nearB = max(step(0.85, texture2D(mask, uv - dir * 6.0).r), step(0.85, texture2D(mask, uv - dir * 11.0).r));
    float farA = max(nearA, step(0.85, texture2D(mask, uv + dir * 18.0).r));
    float farB = max(nearB, step(0.85, texture2D(mask, uv - dir * 18.0).r));
    enclosed += farA + farB;
    thin = max(thin, nearA * nearB);   // person close on both sides of one axis
  }
  // Only where the key saw some of the person (a reflection) — a gap that is
  // pure screen colour (between fingers, under an arm) stays open.
  a = max(a, holeFill * thin * smoothstep(5.5, 6.5, enclosed) * smoothstep(0.1, 0.22, raw.r));
  float edge = clamp((1.0 - mn) * 1.4, 0.0, 1.0);
  gl_FragColor = vec4(a, edge, raw.b, 1.0);
}`;

// 3. TEMPORAL — motion-aware blend with the previous frame.
const TEMPORAL_FRAG = `${COMMON}
uniform sampler2D cur;
uniform sampler2D prev;
uniform float stability, hasPrev;

void main() {
  vec4 c = texture2D(cur, uv);
  vec4 p = texture2D(prev, uv);
  float motion = abs(c.b - p.b);
  float w = hasPrev > 0.5 ? mix(1.0 - stability, 1.0, smoothstep(0.015, 0.08, motion)) : 1.0;
  gl_FragColor = vec4(mix(p.r, c.r, w), mix(p.g, c.g, w), c.b, 1.0);
}`;

// 4. COMPOSITE — original colours, selective spill, subtle natural lift, premultiplied output.
const COMP_FRAG = `${COMMON}
uniform sampler2D src;
uniform sampler2D mask;
uniform vec2 keyDir;       // unit key chroma direction in camera space
uniform float keyMag;      // key chroma magnitude in camera space
uniform float spill, faceLift, temperature, tint, saturation, debugView;
uniform vec3 keyRgb;       // the screen colour in camera space

void main() {
  vec3 rgb = texture2D(src, uv).rgb;
  vec4 m = texture2D(mask, uv);
  float a = m.r;
  float edge = m.g;
  if (debugView > 0.5) {
    float v = debugView < 1.5 ? a : debugView < 2.5 ? edge : m.b;
    gl_FragColor = vec4(vec3(v), 1.0);
    return;
  }
  // Background unmix: an edge pixel is part person, part screen. Taking the
  // screen's share out (C = a*F + (1-a)*B, solved for F) leaves the person's
  // own colour on the edge: no light / green rim on a dark board and no dark
  // rim on a white one. Fully solid pixels are untouched.
  if (a > 0.02 && a < 0.985) {
    vec3 f = (rgb - (1.0 - a) * keyRgb) / max(a, 0.05);
    rgb = mix(rgb, clamp(f, 0.0, 1.0), 1.0 - smoothstep(0.6, 0.985, a));
  }
  // Spill: remove the screen-colour component of the chroma, strongest on
  // edge pixels facing the screen, light inside (natural green clothes stay).
  float Y = luma(rgb);
  vec2 v = cbcr(rgb);
  float along = dot(v, keyDir);
  // Inside the person only a *cast* is removed (a weak pull toward the
  // screen's hue on skin / hair / white clothes); a genuinely green object
  // (strong screen-like chroma) is left alone.
  float rel = along / max(keyMag, 0.02);
  float tintCast = 0.6 * (1.0 - smoothstep(0.3, 0.6, rel));
  float amount = spill * clamp(max(edge * 1.3 + (1.0 - a) * 1.2, tintCast), 0.0, 1.0);
  v -= keyDir * max(along, 0.0) * amount;
  // Back to RGB with the same brightness.
  vec3 outc = vec3(Y + 1.402 * v.y, Y - 0.344136 * v.x - 0.714136 * v.y, Y + 1.772 * v.x);
  // Subtle natural lift of shadows on the person (no whitening, no smoothing).
  float lifted = faceLift * 0.22 * (1.0 - smoothstep(0.0, 0.75, Y));
  outc = outc + (1.0 - outc) * lifted;
  // Colour: temperature / tint / saturation (subtle).
  outc *= vec3(1.0 + temperature * 0.06, 1.0 - tint * 0.05, 1.0 - temperature * 0.06);
  outc = mix(vec3(luma(outc)), outc, saturation);
  outc = clamp(outc, 0.0, 1.0);
  gl_FragColor = vec4(outc * a, a);   // premultiplied (WebGL canvas is premultiplied)
}`;

const RAW_FRAG = `${COMMON}
uniform sampler2D src;
void main() { gl_FragColor = vec4(texture2D(src, uv).rgb, 1.0); }`;

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };

const WORK_MAX = 1280;

export class ChromaKeyer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  private progs: Record<string, Prog> = {};
  private srcTex: WebGLTexture | null = null;
  private keyT: Target | null = null;
  private refT: Target | null = null;
  private hist: [Target | null, Target | null] = [null, null];
  private histIdx = 0;
  private hasPrev = false;
  private lightT: Target | null = null;
  private settings: ChromaSettings = DEFAULT_CHROMA;
  private debug: ChromaDebugView = "none";
  // AUTO lighting state (smoothed, with hysteresis).
  private frame = 0;
  private lightClass: LightClass = "NORMAL";
  private pending: { cls: LightClass; n: number } | null = null;
  private live = { ...PRESET_LIGHTING.NORMAL };
  private lastMs = 0;
  /** False when WebGL isn't available — callers then draw the camera unkeyed. */
  readonly supported: boolean;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false });
    this.supported = Boolean(this.gl && this.init());
  }

  setSettings(s: ChromaSettings) {
    if (s.keyColor !== this.settings.keyColor || s.mode !== this.settings.mode) this.hasPrev = false;
    this.settings = s;
  }

  setDebugView(view: ChromaDebugView) {
    this.debug = view;
  }

  /** What AUTO mode currently thinks of the room, and the last frame's processing time. */
  status() {
    return { light: this.lightClass, ms: this.lastMs };
  }

  private compile(frag: string, uniforms: string[]): Prog | null {
    const gl = this.gl!;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("[chroma] shader:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const name of ["flipY", ...uniforms]) u[name] = gl.getUniformLocation(p, name);
    return { p, u };
  }

  private init(): boolean {
    const gl = this.gl!;
    const key = this.compile(KEY_FRAG, ["src", "srcTexel", "keyC", "keyY", "t0", "t1", "shadowTol", "skinProtect", "exposure", "shadows", "contrast", "wb", "radius", "hairDetail"]);
    const refine = this.compile(REFINE_FRAG, ["mask", "src", "maskTexel", "spread", "clipLo", "clipHi", "colorSigma", "holeFill"]);
    const temporal = this.compile(TEMPORAL_FRAG, ["cur", "prev", "stability", "hasPrev"]);
    const comp = this.compile(COMP_FRAG, ["src", "mask", "keyDir", "keyMag", "keyRgb", "spill", "faceLift", "temperature", "tint", "saturation", "debugView"]);
    const raw = this.compile(RAW_FRAG, ["src"]);
    if (!key || !refine || !temporal || !comp || !raw) return false;
    this.progs = { key, refine, temporal, comp, raw };
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.srcTex = this.makeTex();
    return true;
  }

  private makeTex(): WebGLTexture {
    const gl = this.gl!;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  private target(t: Target | null, w: number, h: number): Target {
    const gl = this.gl!;
    if (t && t.w === w && t.h === h) return t;
    if (t) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    }
    const tex = this.makeTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }

  private bindTex(unit: number, tex: WebGLTexture) {
    const gl = this.gl!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  private draw(prog: Prog, to: Target | null, w: number, h: number, flip: boolean) {
    const gl = this.gl!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fb : null);
    gl.viewport(0, 0, w, h);
    gl.uniform1f(prog.u.flipY!, flip ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Samples the room brightness about once a second (AUTO) with hysteresis. */
  private updateLight(ww: number, wh: number) {
    const gl = this.gl!;
    this.lightT = this.target(this.lightT, 32, 18);
    const raw = this.progs.raw!;
    gl.useProgram(raw.p);
    this.bindTex(0, this.srcTex!);
    gl.uniform1i(raw.u.src!, 0);
    this.draw(raw, this.lightT, 32, 18, false);
    const px = new Uint8Array(32 * 18 * 4);
    gl.readPixels(0, 0, 32, 18, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = 0;
    for (let i = 0; i < px.length; i += 4) s += lumaOf(px[i]! / 255, px[i + 1]! / 255, px[i + 2]! / 255);
    const mean = s / (32 * 18);
    // Hysteresis: a class must win 3 samples in a row, and borders have a margin.
    const margin = 0.025;
    const order: LightClass[] = ["VERY_LOW", "LOW", "NORMAL", "BRIGHT"];
    const cur = order.indexOf(this.lightClass);
    let next = classifyLight(mean);
    const ni = order.indexOf(next);
    if (ni > cur && classifyLight(mean - margin) === this.lightClass) next = this.lightClass;
    if (ni < cur && classifyLight(mean + margin) === this.lightClass) next = this.lightClass;
    if (next === this.lightClass) this.pending = null;
    else if (this.pending?.cls === next) {
      if (++this.pending.n >= 3) {
        this.lightClass = next;
        this.pending = null;
      }
    } else this.pending = { cls: next, n: 1 };
    void ww;
    void wh;
  }

  /** Keys one frame of `source` (w×h) and returns the keyed canvas (transparent where the screen was). */
  process(source: TexImageSource, w: number, h: number): HTMLCanvasElement | null {
    const gl = this.gl;
    if (!gl || !this.progs.key || w <= 0 || h <= 0) return null;
    const t = typeof performance !== "undefined" ? performance.now() : 0;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      return null;
    }

    const s = this.settings;
    const ws = Math.min(1, WORK_MAX / Math.max(w, h));
    const ww = Math.max(16, Math.round(w * ws));
    const wh = Math.max(16, Math.round(h * ws));

    // Lighting: AUTO follows the room (sampled ~1/s), presets are fixed.
    if (s.preset === "AUTO") {
      if (this.frame++ % 30 === 0) this.updateLight(ww, wh);
    } else this.lightClass = s.preset;
    const target = PRESET_LIGHTING[this.lightClass];
    const k = 0.06; // smooth parameter changes (no visible jumps)
    this.live.exposure += (target.exposure - this.live.exposure) * k;
    this.live.shadows += (target.shadows - this.live.shadows) * k;
    this.live.faceLift += (target.faceLift - this.live.faceLift) * k;
    this.live.soft += (target.soft - this.live.soft) * k;
    const exposure = s.exposure * this.live.exposure;
    const shadows = s.shadows * this.live.shadows;
    // Denoise radius (key decision only): AUTO raises it in low light.
    const denoise = clamp(s.preset === "AUTO" ? Math.max(s.denoise, target.denoise) : s.denoise, 0, 2);

    // Key colour in the same working space the shader uses.
    const key = hexToRgb(s.keyColor);
    const workPx = (c: number) => {
      const lifted = Math.pow(clamp(c * exposure, 0, 1), 1 / shadows);
      return clamp((lifted - 0.5) * s.contrast + 0.5, 0, 1);
    };
    const kw = key.map(workPx) as [number, number, number];
    const [kcb, kcr] = rgbToCbCr(kw);
    const keyY = lumaOf(...kw);
    const [ocb, ocr] = rgbToCbCr(key);
    const kd = Math.hypot(ocb - 0.5, ocr - 0.5) || 1;

    const t1 = clamp(0.95 - s.threshold * 0.55, 0.3, 0.95);
    const t0 = clamp(t1 - (0.12 + (s.softness + this.live.soft) * 0.4), 0.02, t1 - 0.02);

    // 1. KEY
    this.keyT = this.target(this.keyT, ww, wh);
    const kp = this.progs.key!;
    gl.useProgram(kp.p);
    this.bindTex(0, this.srcTex!);
    gl.uniform1i(kp.u.src!, 0);
    gl.uniform2f(kp.u.srcTexel!, 1 / ww, 1 / wh);
    gl.uniform2f(kp.u.keyC!, kcb - 0.5, kcr - 0.5);
    gl.uniform1f(kp.u.keyY!, keyY);
    gl.uniform1f(kp.u.t0!, t0);
    gl.uniform1f(kp.u.t1!, t1);
    gl.uniform1f(kp.u.shadowTol!, s.shadowTolerance);
    gl.uniform1f(kp.u.skinProtect!, s.skinProtect);
    gl.uniform1f(kp.u.exposure!, exposure);
    gl.uniform1f(kp.u.shadows!, shadows);
    gl.uniform1f(kp.u.contrast!, s.contrast);
    gl.uniform3f(kp.u.wb!, 1, 1, 1);
    gl.uniform1i(kp.u.radius!, Math.round(denoise));
    gl.uniform1f(kp.u.hairDetail!, s.hairDetail);
    this.draw(kp, this.keyT, ww, wh, false);

    let maskTex = this.keyT.tex;
    if (s.mode === "PRO") {
      // 2. REFINE
      this.refT = this.target(this.refT, ww, wh);
      const rp = this.progs.refine!;
      gl.useProgram(rp.p);
      this.bindTex(0, this.keyT.tex);
      this.bindTex(1, this.srcTex!);
      gl.uniform1i(rp.u.mask!, 0);
      gl.uniform1i(rp.u.src!, 1);
      gl.uniform2f(rp.u.maskTexel!, 1 / ww, 1 / wh);
      gl.uniform1f(rp.u.spread!, 0.6 + s.feather * 1.6);
      const clipLo = (0.04 + s.cleanup * 0.22) * (1 - s.hairDetail * 0.75);
      gl.uniform1f(rp.u.clipLo!, clipLo);
      gl.uniform1f(rp.u.clipHi!, clamp(0.97 - s.cleanup * 0.22, clipLo + 0.1, 1));
      gl.uniform1f(rp.u.colorSigma!, 40 - s.feather * 25);
      gl.uniform1f(rp.u.holeFill!, clamp(s.cleanup * 2, 0, 1));
      this.draw(rp, this.refT, ww, wh, false);

      // 3. TEMPORAL
      const prev = this.hist[this.histIdx];
      this.histIdx = 1 - this.histIdx;
      this.hist[this.histIdx] = this.target(this.hist[this.histIdx] ?? null, ww, wh);
      const cur = this.hist[this.histIdx]!;
      const tp = this.progs.temporal!;
      gl.useProgram(tp.p);
      this.bindTex(0, this.refT.tex);
      this.bindTex(1, prev && prev.w === ww && prev.h === wh ? prev.tex : this.refT.tex);
      gl.uniform1i(tp.u.cur!, 0);
      gl.uniform1i(tp.u.prev!, 1);
      gl.uniform1f(tp.u.stability!, s.stability);
      gl.uniform1f(tp.u.hasPrev!, this.hasPrev && prev && prev.w === ww ? 1 : 0);
      this.draw(tp, cur, ww, wh, false);
      this.hasPrev = true;
      maskTex = cur.tex;
    }

    // 4. COMPOSITE (camera resolution, original colours)
    const cp = this.progs.comp!;
    gl.useProgram(cp.p);
    this.bindTex(0, this.srcTex!);
    this.bindTex(1, maskTex);
    gl.uniform1i(cp.u.src!, 0);
    gl.uniform1i(cp.u.mask!, 1);
    gl.uniform2f(cp.u.keyDir!, (ocb - 0.5) / kd, (ocr - 0.5) / kd);
    gl.uniform1f(cp.u.keyMag!, kd);
    gl.uniform3f(cp.u.keyRgb!, key[0], key[1], key[2]);
    gl.uniform1f(cp.u.spill!, s.spill);
    gl.uniform1f(cp.u.faceLift!, clamp(s.faceEnhance + (s.preset === "AUTO" ? this.live.faceLift * 0.6 : 0), 0, 1));
    gl.uniform1f(cp.u.temperature!, s.temperature);
    gl.uniform1f(cp.u.tint!, s.tint);
    gl.uniform1f(cp.u.saturation!, s.saturation);
    const dv = { none: 0, alpha: 1, edge: 2, skin: 3, work: 3, raw: 1 }[this.debug] ?? 0;
    gl.uniform1f(cp.u.debugView!, dv);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.debug === "raw") {
      const rp = this.progs.raw!;
      gl.useProgram(rp.p);
      this.bindTex(0, this.srcTex!);
      gl.uniform1i(rp.u.src!, 0);
      this.draw(rp, null, w, h, true);
    } else if (this.debug === "skin") {
      // Skin layer of the raw key pass.
      gl.useProgram(cp.p);
      this.bindTex(1, this.keyT!.tex);
      gl.uniform1f(cp.u.debugView!, 2);
      this.draw(cp, null, w, h, true);
    } else {
      this.draw(cp, null, w, h, true);
    }
    this.lastMs = t ? performance.now() - t : 0;
    return this.canvas;
  }
}

// ---- Teacher's saved settings (this device) --------------------------------
const STORAGE_KEY = "atomic_chroma_settings";
const CHANGE_EVENT = "atomic-chroma-change";

export function loadSavedChroma(): ChromaSettings {
  if (typeof window === "undefined") return DEFAULT_CHROMA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeChroma(JSON.parse(raw));
    // Older builds only stored an on/off switch.
    if (localStorage.getItem("atomic_teacher_chroma_key") === "true") return { ...DEFAULT_CHROMA, enabled: true };
  } catch {
    // ignore
  }
  return DEFAULT_CHROMA;
}

export function saveChroma(settings: ChromaSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem("atomic_teacher_chroma_key", String(settings.enabled));
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
}

export function onChromaChange(listener: (s: ChromaSettings) => void): () => void {
  const h = (e: Event) => listener(sanitizeChroma((e as CustomEvent).detail));
  window.addEventListener(CHANGE_EVENT, h);
  return () => window.removeEventListener(CHANGE_EVENT, h);
}

/**
 * Draws the keyed teacher onto a 2D canvas (board already drawn), optionally
 * with a very soft natural shadow behind/below so they sit "on" the board.
 */
export function drawKeyedTeacher(
  ctx: CanvasRenderingContext2D,
  keyed: CanvasImageSource,
  src: { x: number; y: number; w: number; h: number },
  dst: { x: number; y: number; w: number; h: number },
  naturalShadow: boolean
) {
  if (naturalShadow && "filter" in ctx) {
    ctx.save();
    const blur = Math.max(4, Math.round(dst.w * 0.025));
    ctx.filter = `blur(${blur}px) brightness(0) opacity(0.22)`;
    ctx.drawImage(keyed, src.x, src.y, src.w, src.h, dst.x + dst.w * 0.012, dst.y + dst.h * 0.02, dst.w, dst.h);
    ctx.restore();
  }
  ctx.drawImage(keyed, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
}
