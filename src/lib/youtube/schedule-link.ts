import { canonicalYouTubeUrl, checkYouTubeEmbeddable, parseYouTubeVideoId, type EmbedCheck } from "./video-link";

/**
 * A YouTube link typed into a class (schedule create / edit). Accepts every
 * common form (watch?v=, youtu.be, /live/, /shorts/, m.youtube.com, links
 * without https://, a bare 11-character id) and refuses — before anything is
 * saved — a video that YouTube will not play inside the app: private,
 * deleted, or with "Allow embedding" turned off. A network hiccup while
 * checking never blocks saving.
 */
export type ScheduleLinkResult =
  | { ok: true; videoId: string; url: string; embed: EmbedCheck }
  | { ok: false; error: string };

export async function checkScheduleYouTubeLink(
  raw: string,
  checkEmbed: (id: string) => Promise<EmbedCheck> = checkYouTubeEmbeddable
): Promise<ScheduleLinkResult> {
  const videoId = parseYouTubeVideoId(raw);
  if (!videoId) {
    return {
      ok: false,
      error: "यह YouTube वीडियो का link नहीं है। YouTube पर वीडियो खोलकर Share → Copy link करके डालें। (That is not a YouTube video link.)",
    };
  }
  const embed = await checkEmbed(videoId);
  if (embed === "not_found") {
    return {
      ok: false,
      error:
        "यह वीडियो YouTube पर Private है या हटा दी गई है — ऐप में नहीं चलेगी। YouTube Studio में इसे Unlisted या Public करें, फिर link डालें। (Video is private or deleted on YouTube.)",
    };
  }
  if (embed === "not_embeddable") {
    return {
      ok: false,
      error:
        "इस वीडियो में 'Allow embedding' बंद है — ऐप में नहीं चलेगी। YouTube Studio → वीडियो → Details → Show more → Allow embedding चालू करें। (Embedding is off for this video.)",
    };
  }
  return { ok: true, videoId, url: canonicalYouTubeUrl(videoId), embed };
}
