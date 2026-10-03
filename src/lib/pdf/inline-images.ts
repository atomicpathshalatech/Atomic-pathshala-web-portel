import "server-only";
import { keyFromPublicUrl } from "@/lib/storage";
import { getR2ObjectBuffer } from "@/lib/storage/r2-client";

/**
 * Embeds every <img src> of a booklet as a data: URL before it is printed,
 * so headless Chrome never has to fetch an image itself. Left to the
 * browser, a question figure on the public storage host could load late,
 * be rate-limited or fail outright — and print as a broken "Diagram" icon.
 * Our own storage objects are read straight from the bucket; anything else
 * is fetched once here. An image that cannot be loaded keeps its URL.
 */
export async function inlineBookletImages(html: string, opts: { origin: string; cookie?: string | null }): Promise<string> {
  const SRC = /(<img\b[^>]*?\ssrc=")([^"]+)(")/g;
  const urls = new Set<string>();
  for (const m of html.matchAll(SRC)) if (!m[2]!.startsWith("data:")) urls.add(m[2]!);
  if (!urls.size) return html;

  const data = new Map<string, string>();
  const queue = [...urls];
  const worker = async () => {
    for (let src = queue.shift(); src !== undefined; src = queue.shift()) {
      const url = src.replace(/&amp;/g, "&");
      const uri = await loadImage(url, opts).catch(() => null);
      if (uri) data.set(src, uri);
      else console.warn("[booklet_pdf] image not embedded:", url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));

  return html.replace(SRC, (whole, open: string, src: string, close: string) => (data.has(src) ? `${open}${data.get(src)}${close}` : whole));
}

async function loadImage(url: string, opts: { origin: string; cookie?: string | null }): Promise<string | null> {
  // Our bucket: read the object directly (no public host involved).
  const key = storageKey(url);
  if (key) {
    const obj = await getR2ObjectBuffer(key);
    if (obj && obj.buffer.length) return `data:${imageType(obj.contentType, key)};base64,${obj.buffer.toString("base64")}`;
  }

  // Anything else: fetch it here (same-site URLs with the user's cookie).
  let abs: URL;
  try {
    abs = new URL(url, opts.origin);
  } catch {
    return null;
  }
  if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
  const sameSite = abs.origin === new URL(opts.origin).origin;
  const res = await fetch(abs, {
    headers: sameSite && opts.cookie ? { cookie: opts.cookie } : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length ? `data:${type.split(";")[0]};base64,${buf.toString("base64")}` : null;
}

/** The bucket key of a URL that points at our storage (public base URL or an r2.dev host), else null. */
function storageKey(url: string): string | null {
  const fromBase = keyFromPublicUrl(url);
  if (fromBase) return fromBase.split(/[?#]/)[0] || null;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".r2.dev")) return decodeURIComponent(u.pathname.replace(/^\/+/, "")) || null;
  } catch {
    // relative URL — not a storage object
  }
  return null;
}

function imageType(contentType: string, key: string): string {
  if (contentType.startsWith("image/")) return contentType.split(";")[0]!;
  if (/\.jpe?g$/i.test(key)) return "image/jpeg";
  if (/\.webp$/i.test(key)) return "image/webp";
  if (/\.svg$/i.test(key)) return "image/svg+xml";
  if (/\.gif$/i.test(key)) return "image/gif";
  return "image/png";
}
