"use strict";

/**
 * Real-time YouTube live chat for the teacher's class, without the YouTube
 * Data API.
 *
 * Reading the chat through the API costs quota (5 units a read out of 10,000
 * a day), so the web app could only read it every 20 s — too slow for a live
 * poll — and it stops completely when the channel's OAuth token expires.
 * The app instead opens YouTube's own pop-out chat page
 * (youtube.com/live_chat?v=…) for the class's stream in a hidden window and
 * reads the new messages from it about once a second, the same way the chat
 * shows them to any viewer. Nothing is posted; the window has no access to
 * the app bridge and its own cookie partition (YouTube never sees the
 * teacher's portal session, and no YouTube sign-in is needed for a public or
 * unlisted stream).
 */

const { BrowserWindow, session } = require("electron");

const CHAT_PARTITION = "atomic-youtube-chat";
let partitionHardened = false;

/** The chat page gets no camera, mic, notifications or anything else. */
function hardenChatPartition() {
  if (partitionHardened) return;
  const ses = session.fromPartition(CHAT_PARTITION);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  partitionHardened = true;
}

/** Only YouTube / Google pages (sign-in consent) in the chat window. */
function isYoutubeUrl(url) {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)youtube\.com$/.test(host) || /(^|\.)google\.com$/.test(host);
  } catch {
    return false;
  }
}
const READ_EVERY_MS = 900;

// Runs inside the YouTube chat page: returns messages not returned before.
// Prefers the chat item's own data (stable id, channel id, timestamp), with
// the visible text as the fallback.
const READ_SCRIPT = `(() => {
  const seen = window.__atomicSeen || (window.__atomicSeen = new Set());
  const out = [];
  for (const el of document.querySelectorAll("yt-live-chat-text-message-renderer")) {
    const d = el.data || el.__data?.data || null;
    const id = (d && d.id) || el.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    let text = "";
    if (d && d.message && Array.isArray(d.message.runs)) {
      for (const r of d.message.runs) text += r.text != null ? r.text : (r.emoji && r.emoji.shortcuts && r.emoji.shortcuts[0]) || "";
    } else {
      const m = el.querySelector("#message");
      if (m) for (const n of m.childNodes) text += n.nodeType === 3 ? n.textContent : n.tagName === "IMG" ? n.alt || "" : n.textContent;
    }
    const author = (d && d.authorName && d.authorName.simpleText) || (el.querySelector("#author-name") || {}).textContent || "";
    const photo = (d && d.authorPhoto && d.authorPhoto.thumbnails && d.authorPhoto.thumbnails[0] && d.authorPhoto.thumbnails[0].url) || (el.querySelector("#img") || {}).src || null;
    const usec = d && d.timestampUsec ? Number(d.timestampUsec) : 0;
    out.push({
      id: String(id).slice(0, 200),
      authorName: String(author).trim().slice(0, 190),
      authorChannelId: (d && d.authorExternalChannelId) || null,
      authorPhotoUrl: photo,
      messageText: String(text).trim().slice(0, 2000),
      publishedAt: new Date(usec > 0 ? usec / 1000 : Date.now()).toISOString(),
    });
  }
  if (seen.size > 20000) window.__atomicSeen = new Set(Array.from(seen).slice(-5000));
  return out;
})()`;

// "Top chat" hides some messages; switch the pop-out to "Live chat" (all
// messages): open the Top chat / Live chat menu, pick the second entry.
// Returns true once the label says Live chat. Best effort (checked against
// the pop-out in Oct 2026).
const LIVE_CHAT_SCRIPT = `(async () => {
  try {
    const label = () => ((document.querySelector("yt-sort-filter-sub-menu-renderer #label-text, #view-selector #label-text") || {}).textContent || "").trim();
    if (/live chat/i.test(label())) return true;
    const trigger = document.querySelector("yt-sort-filter-sub-menu-renderer #trigger, #view-selector #trigger");
    if (!trigger) return false;
    trigger.click();
    await new Promise((r) => setTimeout(r, 500));
    const items = document.querySelectorAll("tp-yt-paper-listbox a");
    if (items[1]) items[1].click();
    await new Promise((r) => setTimeout(r, 500));
    return /live chat/i.test(label());
  } catch (e) {
    return false;
  }
})()`;

let chat = null; // { win, videoId, timer, sender }

function stopChat() {
  if (!chat) return;
  clearInterval(chat.timer);
  if (!chat.win.isDestroyed()) chat.win.destroy();
  chat = null;
}

function startChat(videoId, sender) {
  if (chat && chat.videoId === videoId && !chat.win.isDestroyed()) {
    chat.sender = sender;
    return { watching: true, reused: true };
  }
  stopChat();
  hardenChatPartition();
  const win = new BrowserWindow({
    show: false,
    width: 420,
    height: 900,
    webPreferences: {
      partition: CHAT_PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // No preload: this page never gets window.atomicDesktop.
    },
  });
  win.webContents.setAudioMuted(true);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!isYoutubeUrl(url)) event.preventDefault();
  });
  const state = { win, videoId, timer: null, sender };
  chat = state;

  const send = (channel, payload) => {
    if (state.sender && !state.sender.isDestroyed()) state.sender.send(channel, payload);
  };
  const read = async () => {
    if (chat !== state || win.isDestroyed()) return;
    try {
      const messages = await win.webContents.executeJavaScript(READ_SCRIPT, true);
      if (Array.isArray(messages) && messages.length) send("ytchat:messages", messages);
    } catch {
      // page still loading / reloading: next tick
    }
  };
  win.webContents.on("did-finish-load", () => {
    const switchToLiveChat = (triesLeft) => {
      if (chat !== state || win.isDestroyed()) return;
      win.webContents
        .executeJavaScript(LIVE_CHAT_SCRIPT, true)
        .then((ok) => {
          if (!ok && triesLeft > 0) setTimeout(() => switchToLiveChat(triesLeft - 1), 4000);
        })
        .catch(() => undefined);
    };
    setTimeout(() => switchToLiveChat(3), 1500);
    send("ytchat:status", { state: "watching", videoId });
  });
  win.webContents.on("did-fail-load", (_e, code, desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    send("ytchat:status", { state: "error", videoId, error: `${code} ${desc}` });
    // Retry: the stream may not have started yet, or the connection dropped.
    setTimeout(() => {
      if (chat === state && !win.isDestroyed()) win.loadURL(chatUrl(videoId)).catch(() => undefined);
    }, 10_000);
  });
  win.loadURL(chatUrl(videoId)).catch(() => undefined);
  state.timer = setInterval(read, READ_EVERY_MS);
  return { watching: true, reused: false };
}

function chatUrl(videoId) {
  return `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`;
}

function registerYoutubeChatIpc({ ipcMain, trustedSender }) {
  ipcMain.handle("ytchat:watch", (event, videoId) => {
    if (!trustedSender(event)) throw new Error("untrusted sender");
    if (typeof videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("bad video id");
    return startChat(videoId, event.sender);
  });
  ipcMain.handle("ytchat:stop", (event) => {
    if (!trustedSender(event)) throw new Error("untrusted sender");
    stopChat();
    return { stopped: true };
  });
}

module.exports = { registerYoutubeChatIpc, stopChat };
