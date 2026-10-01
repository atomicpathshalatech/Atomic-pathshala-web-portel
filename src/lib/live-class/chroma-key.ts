/**
 * GPU chroma key (green / blue screen) for the teacher's camera — the same
 * math OBS uses (chroma distance in CbCr, similarity + smoothness for soft
 * edges, spill reduction), plus two things cheap classroom setups need:
 *
 *   - low light: brightness / contrast / gamma applied BEFORE keying, so a
 *     dim, muddy green screen still separates from the teacher;
 *   - low-quality cameras: the key decision averages the chroma of nearby
 *     pixels (denoise radius), so webcam grain doesn't punch holes in the
 *     teacher or leave specks of green.
 *
 * Used by the stage compositor (what goes to YouTube) and by the teacher's
 * own camera preview, so both look identical.
 */

export interface ChromaSettings {
  enabled: boolean;
  /** Screen colour, "#rrggbb" (green by default). */
  keyColor: string;
  /** 0–1: how far from the key colour still counts as screen. */
  similarity: number;
  /** 0–1: soft edge width. */
  smoothness: number;
  /** 0–1: removes the green cast on the teacher's edges/skin. */
  spill: number;
  /** -0.5–0.5 */
  brightness: number;
  /** 0.5–2 */
  contrast: number;
  /** 0.5–2.5 (>1 lifts shadows — low light) */
  gamma: number;
  /** 0–3: chroma averaging radius in pixels (noisy / low-quality cameras). */
  denoise: number;
}

export const DEFAULT_CHROMA: ChromaSettings = {
  enabled: false,
  keyColor: "#00b140",
  similarity: 0.4,
  smoothness: 0.08,
  spill: 0.1,
  brightness: 0,
  contrast: 1,
  gamma: 1,
  denoise: 1,
};

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

/** Accepts anything (localStorage / IPC) and returns valid settings. */
export function sanitizeChroma(input: unknown): ChromaSettings {
  const v = (input && typeof input === "object" ? input : {}) as Partial<ChromaSettings>;
  return {
    enabled: Boolean(v.enabled),
    keyColor: typeof v.keyColor === "string" && /^#[0-9a-f]{6}$/i.test(v.keyColor) ? v.keyColor : DEFAULT_CHROMA.keyColor,
    similarity: clamp(Number(v.similarity ?? DEFAULT_CHROMA.similarity), 0, 1),
    smoothness: clamp(Number(v.smoothness ?? DEFAULT_CHROMA.smoothness), 0.001, 1),
    spill: clamp(Number(v.spill ?? DEFAULT_CHROMA.spill), 0.001, 1),
    brightness: clamp(Number(v.brightness ?? DEFAULT_CHROMA.brightness), -0.5, 0.5),
    contrast: clamp(Number(v.contrast ?? DEFAULT_CHROMA.contrast), 0.5, 2),
    gamma: clamp(Number(v.gamma ?? DEFAULT_CHROMA.gamma), 0.5, 2.5),
    denoise: clamp(Math.round(Number(v.denoise ?? DEFAULT_CHROMA.denoise)), 0, 3),
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** CbCr of an RGB colour (0–1), same transform as the shader. */
export function rgbToCbCr([r, g, b]: [number, number, number]): [number, number] {
  return [-0.1687 * r - 0.3313 * g + 0.5 * b + 0.5, 0.5 * r - 0.4187 * g - 0.0813 * b + 0.5];
}

/**
 * Suggests the key colour from a frame's border (where the screen is): the
 * average of edge pixels that are clearly saturated. Returns null if the
 * border doesn't look like a coloured screen.
 */
export function detectKeyColor(pixels: Uint8ClampedArray, w: number, h: number): string | null {
  let r = 0, g = 0, b = 0, n = 0;
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const pr = pixels[i]!, pg = pixels[i + 1]!, pb = pixels[i + 2]!;
    const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
    if (max < 25 || max - min < 25) return; // too dark / grey to be a screen
    r += pr; g += pg; b += pb; n++;
  };
  const step = Math.max(1, Math.floor(Math.min(w, h) / 40));
  for (let x = 0; x < w; x += step) { take(x, 0); take(x, Math.min(h - 1, 2)); }
  for (let y = 0; y < h; y += step) { take(0, y); take(w - 1, y); }
  if (n < 10) return null;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = vec2((p.x + 1.0) * 0.5, 1.0 - (p.y + 1.0) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D tex;
uniform vec2 texel;
uniform vec2 keyCbCr;
uniform float similarity, smoothness, spill, brightness, contrast, gamma;
uniform int radius;

vec3 grade(vec3 c) {
  c = (c - 0.5) * contrast + 0.5 + brightness;
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / gamma));
}
vec2 cbcr(vec3 c) {
  return vec2(-0.1687 * c.r - 0.3313 * c.g + 0.5 * c.b + 0.5, 0.5 * c.r - 0.4187 * c.g - 0.0813 * c.b + 0.5);
}
void main() {
  vec3 rgb = grade(texture2D(tex, uv).rgb);
  // Denoise: average chroma around the pixel before deciding (grainy webcams).
  vec2 acc = vec2(0.0);
  float n = 0.0;
  for (int dy = -3; dy <= 3; dy++) {
    for (int dx = -3; dx <= 3; dx++) {
      if (dx >= -radius && dx <= radius && dy >= -radius && dy <= radius) {
        acc += cbcr(grade(texture2D(tex, uv + vec2(float(dx), float(dy)) * texel).rgb));
        n += 1.0;
      }
    }
  }
  vec2 v = acc / n - 0.5;
  vec2 k = keyCbCr - 0.5;
  // Measured against the screen's own colour:
  //  - hue:    how far the pixel's hue is off the screen's (in units of the
  //            screen's saturation, so a dull olive wall gets a tight band);
  //  - colour: how close to colourless it is (along the screen's hue).
  // A dim / shadowed screen keeps the screen's hue and some colour, so it
  // still keys; skin is another hue and hair / white / grey clothes are
  // nearly colourless, so they never key — even with the similarity slider
  // turned all the way up.
  float kmag = max(length(k), 0.02);
  vec2 kh = k / kmag;
  float along = dot(v, kh);
  float perp = abs(v.x * kh.y - v.y * kh.x);
  float dist = max(perp / kmag, clamp((0.06 - along) / 0.06, 0.0, 2.0));
  float baseMask = dist - similarity * 0.5;
  float alpha = pow(clamp(baseMask / smoothness, 0.0, 1.0), 1.5);
  // Spill: pull the key colour's cast out of what remains (desaturate toward luma).
  float spillVal = pow(clamp(baseMask / spill, 0.0, 1.0), 1.5);
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(luma), rgb, spillVal);
  gl_FragColor = vec4(rgb * alpha, alpha); // premultiplied for 2D drawImage
}`;

export class ChromaKeyer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  private prog: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private settings: ChromaSettings = DEFAULT_CHROMA;
  /** False when WebGL isn't available — callers then draw the camera unkeyed. */
  readonly supported: boolean;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
    this.supported = Boolean(this.gl && this.init());
  }

  setSettings(s: ChromaSettings) {
    this.settings = s;
  }

  private init(): boolean {
    const gl = this.gl!;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    this.prog = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const name of ["texel", "keyCbCr", "similarity", "smoothness", "spill", "brightness", "contrast", "gamma", "radius"]) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    return true;
  }

  /** Keys one frame of `source` (w×h) and returns the keyed canvas (transparent where the screen was). */
  process(source: TexImageSource, w: number, h: number): HTMLCanvasElement | null {
    const gl = this.gl;
    if (!gl || !this.prog || w <= 0 || h <= 0) return null;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      return null;
    }
    const s = this.settings;
    const [cb, cr] = rgbToCbCr(hexToRgb(s.keyColor));
    gl.uniform2f(this.u.texel!, 1 / w, 1 / h);
    gl.uniform2f(this.u.keyCbCr!, cb, cr);
    gl.uniform1f(this.u.similarity!, s.similarity);
    gl.uniform1f(this.u.smoothness!, Math.max(0.02, s.smoothness * 0.6));
    gl.uniform1f(this.u.spill!, Math.max(0.001, s.spill * 0.6));
    gl.uniform1f(this.u.brightness!, s.brightness);
    gl.uniform1f(this.u.contrast!, s.contrast);
    gl.uniform1f(this.u.gamma!, s.gamma);
    gl.uniform1i(this.u.radius!, s.denoise);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
