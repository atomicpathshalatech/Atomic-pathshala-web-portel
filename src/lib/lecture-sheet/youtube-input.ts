/**
 * The video id from whatever a person types into the Sheet: a bare 11-character
 * id or a YouTube link (watch, youtu.be, live, shorts, embed, m./music.
 * subdomains, extra parameters such as ?si= or &t=). Anything else is null.
 */
const ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYoutubeVideoInput(raw: string | null | undefined): string | null {
  const input = (raw ?? "").trim();
  if (!input) return null;
  if (ID.test(input)) return input;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  const v = url.searchParams.get("v");
  if (v && ID.test(v)) return v;
  const [kind, id] = url.pathname.split("/").filter(Boolean);
  if (kind && id && ["live", "shorts", "embed", "v", "e"].includes(kind) && ID.test(id)) return id;
  return null;
}

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
