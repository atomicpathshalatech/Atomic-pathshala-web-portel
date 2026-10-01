"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * WhatsApp-style building blocks shared by the student and team inboxes:
 * avatar, conversation row, the message stream (day separators, grouped
 * bubbles with tails, time + ticks inside the bubble) and the composer.
 */

const IST = "Asia/Kolkata";
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
export const clock = (d: string | Date) =>
  new Date(d).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });

function dayLabel(d: string | Date) {
  const k = dayKey(d);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  const date = new Date(d);
  if (Date.now() - date.getTime() < 6 * 86_400_000) return date.toLocaleDateString("en-IN", { timeZone: IST, weekday: "long" });
  return date.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "long", year: "numeric" });
}

/** Chat-list time: "4:05 pm" today, "Yesterday", weekday this week, else a date. */
export function listTime(d: string | Date) {
  const l = dayLabel(d);
  if (l === "Today") return clock(d);
  if (l === "Yesterday" || !/\d/.test(l)) return l;
  return new Date(d).toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit", month: "2-digit", year: "2-digit" });
}

const TONES = [
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-violet-600",
];
const toneFor = (name: string) => TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

export function ChatAvatar({ name, photoUrl, size = 44, ring = false }: { name: string; photoUrl?: string | null; size?: number; ring?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const cls = `rounded-full shrink-0 ${ring ? "ring-2 ring-white dark:ring-slate-900" : ""}`;
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- user avatar
    <img src={photoUrl} alt={name} style={{ width: size, height: size }} className={`${cls} object-cover`} />
  ) : (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={`${cls} bg-gradient-to-br ${toneFor(name)} text-white font-black flex items-center justify-center`}
    >
      {initials}
    </div>
  );
}

export function ConversationRow({
  name,
  photoUrl,
  subtitle,
  badge,
  preview,
  previewIsMine,
  previewRead,
  time,
  unread,
  active,
  onClick,
}: {
  name: string;
  photoUrl?: string | null;
  subtitle?: string | null;
  badge?: { label: string; cls: string } | null;
  preview: string;
  previewIsMine?: boolean;
  previewRead?: boolean;
  time?: string | null;
  unread: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition ${
        active ? "bg-emerald-50 dark:bg-emerald-950/25" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
    >
      <ChatAvatar name={name} photoUrl={photoUrl} size={48} />
      <div className="flex-1 min-w-0 border-b border-slate-100 dark:border-slate-800 pb-2.5 -mb-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">{name}</span>
          {time && (
            <span className={`text-[11px] shrink-0 ${unread > 0 ? "text-emerald-600 font-bold" : "text-slate-400"}`}>{time}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
          {badge && <span className={`text-[9px] px-1.5 py-px rounded-md font-bold uppercase tracking-wide shrink-0 ${badge.cls}`}>{badge.label}</span>}
          {subtitle && <span className="text-[11px] text-slate-400 truncate shrink-0 max-w-[40%]">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className={`flex-1 min-w-0 text-[13px] truncate flex items-center gap-0.5 ${unread > 0 ? "text-slate-900 dark:text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}>
            {previewIsMine && (
              <span className={`material-symbols-outlined text-[16px] shrink-0 ${previewRead ? "text-sky-500" : "text-slate-400"}`}>done_all</span>
            )}
            <span className="truncate">{preview}</span>
          </p>
          {unread > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export type ChatBubbleMessage = {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole?: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  isSelf?: boolean;
  /** Not yet confirmed by the server. */
  pending?: boolean;
};

/** Wallpaper doodle, drawn once as a data URI so it costs nothing per bubble. */
const WALLPAPER =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='%2394a3b8' stroke-opacity='0.16' stroke-width='1.4'><circle cx='18' cy='20' r='6'/><path d='M60 14l6 10H54z'/><rect x='92' y='14' width='12' height='12' rx='3'/><path d='M14 70c6-8 14-8 20 0'/><circle cx='64' cy='66' r='3'/><path d='M90 60l12 12M102 60L90 72'/><path d='M20 104h14M27 97v14'/><path d='M56 100q8-10 16 0'/><circle cx='98' cy='102' r='5'/></g></svg>\")";

export function ChatStream({
  messages,
  currentUserId,
  loading,
  showSenderNames,
  emptyHint,
}: {
  messages: ChatBubbleMessage[];
  currentUserId: string;
  loading?: boolean;
  /** Group chats / admin desks: name above the first bubble of each run. */
  showSenderNames?: boolean;
  emptyHint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // Stay pinned to the bottom unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);
  useEffect(() => {
    stick.current = true;
  }, [loading]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = atBottom;
    setShowJump(!atBottom);
  };

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={ref}
        onScroll={onScroll}
        className="absolute inset-0 overflow-y-auto px-3 sm:px-6 py-3 bg-[#efeae2] dark:bg-[#0b141a]"
        style={{ backgroundImage: WALLPAPER }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600">progress_activity</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-xs text-center rounded-xl bg-[#fff8c4] dark:bg-[#182229] text-[12px] text-slate-700 dark:text-slate-300 px-4 py-3 shadow-sm">
              <span className="material-symbols-outlined text-base align-middle mr-1 text-amber-600">lock</span>
              {emptyHint ?? "Say hi! Messages here are private to this chat."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[2px] max-w-3xl mx-auto">
            {messages.map((m, i) => {
              const mine = m.isSelf || m.senderUserId === currentUserId;
              const prev = messages[i - 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const firstOfRun = newDay || !prev || prev.senderUserId !== m.senderUserId;
              return (
                <React.Fragment key={m.id}>
                  {newDay && (
                    <div className="flex justify-center my-2.5 sticky top-1 z-10">
                      <span className="px-3 py-1 rounded-lg bg-white/90 dark:bg-[#182229]/95 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"} ${firstOfRun && !newDay ? "mt-2" : ""}`}>
                    <div
                      className={`relative max-w-[82%] sm:max-w-[65%] px-2.5 pt-1.5 pb-1 rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
                        mine ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white" : "bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100"
                      } ${firstOfRun ? (mine ? "rounded-tr-none" : "rounded-tl-none") : ""} ${m.pending ? "opacity-70" : ""}`}
                    >
                      {firstOfRun && (
                        <span
                          aria-hidden
                          className={`absolute top-0 w-2.5 h-3 ${mine ? "-right-2.5 bg-[#d9fdd3] dark:bg-[#005c4b]" : "-left-2.5 bg-white dark:bg-[#202c33]"}`}
                          style={{ clipPath: mine ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)" }}
                        />
                      )}
                      {!mine && showSenderNames && firstOfRun && (
                        <p className={`text-[12px] font-bold mb-0.5 bg-gradient-to-r ${toneFor(m.senderName)} bg-clip-text text-transparent`}>
                          {m.senderName}
                          {m.senderRole ? <span className="text-slate-400 font-medium"> · {m.senderRole.toLowerCase()}</span> : null}
                        </p>
                      )}
                      <p className="text-[14.5px] leading-[1.35] whitespace-pre-wrap break-words">
                        {m.body}
                        {/* Room for the time so it never overlaps the last line */}
                        <span className="inline-block w-[70px]" aria-hidden />
                      </p>
                      <span className="absolute right-2 bottom-1 flex items-center gap-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                        {clock(m.createdAt)}
                        {mine && (
                          <span
                            className={`material-symbols-outlined text-[15px] ${m.pending ? "" : m.readAt ? "text-sky-500" : ""}`}
                            title={m.pending ? "Sending" : m.readAt ? "Read" : "Delivered"}
                          >
                            {m.pending ? "schedule" : "done_all"}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
      {showJump && (
        <button
          type="button"
          onClick={() => {
            const el = ref.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          }}
          className="absolute right-4 bottom-4 w-10 h-10 rounded-full bg-white dark:bg-[#202c33] shadow-md flex items-center justify-center text-slate-600 dark:text-slate-200"
          aria-label="Jump to latest"
        >
          <span className="material-symbols-outlined">keyboard_double_arrow_down</span>
        </button>
      )}
    </div>
  );
}

const EMOJIS = ["👍", "🙏", "😊", "😂", "❤️", "👌", "🔥", "🤔", "😅", "✅", "📚", "🎯", "💯", "👏", "😢", "😮"];

export function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  placeholder = "Message",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [emoji, setEmoji] = useState(false);

  // Grow with the text, up to ~6 lines.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    // Measured while hidden (phone, list showing) gives 0: fall back to the CSS size.
    el.style.height = el.scrollHeight > 0 ? `${Math.min(el.scrollHeight, 140)}px` : "";
  }, [value]);

  const insert = (e: string) => {
    const el = ta.current;
    if (!el) return onChange(value + e);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + e + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + e.length;
    });
  };

  const canSend = value.trim().length > 0 && !sending;
  return (
    <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-2 sm:px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {emoji && (
        <div className="max-w-3xl mx-auto mb-2 grid grid-cols-8 gap-1 p-2 rounded-2xl bg-white dark:bg-[#111b21] shadow-sm">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => insert(e)} className="text-2xl h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              {e}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend();
        }}
        className="max-w-3xl mx-auto flex items-end gap-2"
      >
        <div className="flex-1 flex items-end gap-1 rounded-3xl bg-white dark:bg-[#2a3942] px-2 py-1 shadow-sm">
          <button
            type="button"
            onClick={() => setEmoji((v) => !v)}
            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${emoji ? "text-emerald-600" : "text-slate-500 dark:text-slate-300"}`}
            aria-label="Emoji"
          >
            <span className="material-symbols-outlined">{emoji ? "keyboard" : "mood"}</span>
          </button>
          <textarea
            ref={ta}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            placeholder={placeholder}
            className="flex-1 min-w-0 min-h-[36px] resize-none border-0 shadow-none focus:ring-0 bg-transparent px-1 py-2 text-[15px] leading-5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!canSend}
          className="w-11 h-11 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white flex items-center justify-center shadow-sm transition active:scale-95"
          aria-label="Send"
        >
          <span className={`material-symbols-outlined ${sending ? "animate-spin" : ""}`}>{sending ? "progress_activity" : "send"}</span>
        </button>
      </form>
    </div>
  );
}
