/**
 * Poll answers typed in the class's YouTube live chat — for viewers watching
 * on YouTube itself, who can't tap the in-app poll. Pure functions (unit
 * tested); the server side that reads the chat is in
 * src/lib/whiteboard/youtube-votes.ts.
 */

export interface PollOption {
  key: string;
  label: string;
}

export interface ChatMessageForVote {
  id: string;
  authorChannelId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  messageText: string;
  publishedAt: string;
}

export interface ChatVote {
  chatMessageId: string;
  authorChannelId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  selectedOption: string;
  responseTimeMs: number;
  submittedAt: Date;
}

// Words people actually type before the letter: "ans B", "answer: c", "option d", "jawab a".
const PREFIX = /^(?:my\s+)?(?:ans(?:wer)?|option|opt|jawab|jwb|uttar)\s*(?:is\s*)?[:\-=]?\s*/;
const YES_WORDS = new Set(["yes", "y", "haan", "han", "ha", "haa", "ji", "sahi", "true"]);
const NO_WORDS = new Set(["no", "n", "nahi", "nahin", "nhi", "na", "galat", "false"]);

/**
 * The option key a chat message votes for, or null if it isn't a vote.
 * Deliberately strict: only a message that IS an answer counts ("B", "(b)",
 * "ans B", "yes"), never a sentence that merely contains a letter.
 */
export function parseChatVote(text: string, options: PollOption[]): string | null {
  let t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t || t.length > 40) return null;
  t = t.replace(PREFIX, "");
  t = t.replace(/^[([{]\s*/, "").replace(/[.!?,;:)\]}]+$/, "").replace(/\s*[)\]}]$/, "").trim();
  if (!t) return null;

  const byKey = options.find((o) => o.key.toLowerCase() === t);
  if (byKey) return byKey.key;

  const byLabel = options.find((o) => o.label.trim().length <= 24 && o.label.trim().toLowerCase() === t);
  if (byLabel) return byLabel.key;

  // Yes/No polls: common Hindi/English ways of saying it.
  const yes = options.find((o) => o.label.trim().toLowerCase() === "yes");
  const no = options.find((o) => o.label.trim().toLowerCase() === "no");
  if (yes && YES_WORDS.has(t)) return yes.key;
  if (no && NO_WORDS.has(t)) return no.key;
  return null;
}

/**
 * Votes from a batch of chat messages: only messages typed while the poll was
 * open (plus a small grace for chat delay), and only each account's FIRST
 * valid answer — same rule as the app, where an answer can't be changed.
 */
export function collectChatVotes(
  messages: ChatMessageForVote[],
  poll: { options: PollOption[]; startedAt: Date; timeLimitSec: number },
  graceMs = 3000
): ChatVote[] {
  const start = poll.startedAt.getTime();
  const end = start + poll.timeLimitSec * 1000 + graceMs;
  const seen = new Set<string>();
  const out: ChatVote[] = [];
  const sorted = [...messages].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  for (const m of sorted) {
    if (!m.authorChannelId || seen.has(m.authorChannelId)) continue;
    const at = Date.parse(m.publishedAt);
    if (!Number.isFinite(at) || at < start || at > end) continue;
    const key = parseChatVote(m.messageText, poll.options);
    if (!key) continue;
    seen.add(m.authorChannelId);
    out.push({
      chatMessageId: m.id,
      authorChannelId: m.authorChannelId,
      authorName: m.authorName,
      authorPhotoUrl: m.authorPhotoUrl,
      selectedOption: key,
      responseTimeMs: Math.max(0, at - start),
      submittedAt: new Date(at),
    });
  }
  return out;
}

/** "Type A, B, C or D in the YouTube chat" — the hint shown in the class video. */
export function chatVoteHint(options: PollOption[]): string {
  const yesNo = options.length === 2 && options.every((o) => /^(yes|no)$/i.test(o.label.trim()));
  if (yesNo) return "Type YES or NO in the YouTube chat";
  const keys = options.map((o) => o.key);
  const list = keys.length > 1 ? `${keys.slice(0, -1).join(", ")} or ${keys[keys.length - 1]}` : keys[0] ?? "";
  return `Type ${list} in the YouTube chat`;
}
