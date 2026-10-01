"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { directConversationChannel, DIRECT_MESSAGE_EVENTS } from "@/lib/realtime/events";
import type { ConversationSummary } from "@/lib/messages/messaging-service";
import { ChatAvatar, ChatComposer, ChatStream, ConversationRow, listTime } from "@/components/messages/ChatUI";

interface MessageItem {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  senderRole: string;
  recipientUserId?: string | null;
  recipientRole?: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
  isSelf: boolean;
  pending?: boolean;
}

export function StudentMessagesConsole({
  initialConversations,
  currentUserId,
}: {
  initialConversations: ConversationSummary[];
  currentUserId: string;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    initialConversations[0]?.id || null
  );
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "teachers" | "admin">("all");
  // Phones show one pane at a time, like WhatsApp: the chat list, or a chat.
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const openConversation = (id: string) => {
    setActiveConvId(id);
    setMobileThreadOpen(true);
  };

  // New Message Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [composeRecipientType, setComposeRecipientType] = useState<"TEACHER" | "ADMIN">("TEACHER");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [teacherOptions, setTeacherOptions] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [newMsgText, setNewMsgText] = useState("");
  const [isSendingNew, setIsSendingNew] = useState(false);

  // Refresh conversation summaries
  const refreshConversations = async () => {
    try {
      const url = new URL("/api/messages/conversations", window.location.origin);
      if (searchQuery) url.searchParams.set("search", searchQuery);

      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.conversations)) {
        setConversations(data.data.conversations);
        if (!activeConvId && data.data.conversations.length > 0) {
          setActiveConvId(data.data.conversations[0].id);
        }
      }
    } catch {
      // Non-blocking
    }
  };

  // Load messages for selected conversation
  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/conversations/${convId}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages || []);
        // Update local conversation list to clear unread badge
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConvId) {
      // On a phone the chat list shows first: don't open (and mark read)
      // a chat the user hasn't tapped yet.
      if (!mobileThreadOpen && window.matchMedia("(max-width: 767px)").matches) return;
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId, mobileThreadOpen]);

  // Real-time Pusher listener for active thread
  useEffect(() => {
    if (!activeConvId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = directConversationChannel(activeConvId);
    const channel = pusher.subscribe(channelName);

    channel.bind(DIRECT_MESSAGE_EVENTS.NEW_MESSAGE, (incomingMsg: any) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        return [
          ...prev,
          {
            ...incomingMsg,
            isSelf: incomingMsg.senderUserId === currentUserId,
          },
        ];
      });

      // Update conversations preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? {
                ...c,
                lastMessage: {
                  id: incomingMsg.id,
                  body: incomingMsg.body,
                  createdAt: incomingMsg.createdAt,
                  senderUserId: incomingMsg.senderUserId,
                  senderRole: incomingMsg.senderRole,
                  isUnread: false,
                },
                updatedAt: incomingMsg.createdAt,
              }
            : c
        )
      );
    });

    channel.bind(DIRECT_MESSAGE_EVENTS.MESSAGES_READ, () => {
      setMessages((prev) =>
        prev.map((m) => (m.readAt ? m : { ...m, readAt: new Date().toISOString() }))
      );
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [activeConvId, currentUserId]);

  // Send message in current active conversation
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConvId || sending) return;

    const bodyText = inputText.trim();
    setInputText("");
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversationId: activeConvId,
        senderUserId: currentUserId,
        senderName: "You",
        senderPhotoUrl: null,
        senderRole: "STUDENT",
        body: bodyText,
        readAt: null,
        createdAt: new Date().toISOString(),
        isSelf: true,
        pending: true,
      },
    ]);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          body: bodyText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message");
      }

      // Add to messages if not already placed by pusher
      const newMsg = data.data.message;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === newMsg.id)) return withoutTemp;
        return [...withoutTemp, { ...newMsg, isSelf: true }];
      });

      // Refresh conversations snippet
      refreshConversations();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(bodyText); // restore on failure
    } finally {
      setSending(false);
    }
  };

  // Fetch teacher options when composing
  useEffect(() => {
    if (!isNewModalOpen || composeRecipientType !== "TEACHER") return;

    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      try {
        const url = new URL("/api/messages/recipients", window.location.origin);
        url.searchParams.set("role", "TEACHER");
        if (recipientSearch) url.searchParams.set("q", recipientSearch);

        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.success) {
          setTeacherOptions(data.data.recipients || []);
        }
      } catch {
        // Non-blocking
      } finally {
        setLoadingTeachers(false);
      }
    };

    const timer = setTimeout(fetchTeachers, 250);
    return () => clearTimeout(timer);
  }, [isNewModalOpen, composeRecipientType, recipientSearch]);

  // Handle Dispatching New Conversation / First Message
  const handleStartNewConversation = async () => {
    if (!newMsgText.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (composeRecipientType === "TEACHER" && !selectedTeacher) {
      toast.error("Please select a teacher");
      return;
    }

    setIsSendingNew(true);
    try {
      const payload: any = {
        body: newMsgText.trim(),
        recipientRole: composeRecipientType,
      };

      if (composeRecipientType === "TEACHER") {
        payload.recipientUserId = selectedTeacher.id;
        payload.teacherId = selectedTeacher.teacherId;
      }

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message");
      }

      toast.success(
        composeRecipientType === "ADMIN"
          ? "Message sent to Admin Support desk"
          : `Message sent to ${selectedTeacher.name}`
      );

      setIsNewModalOpen(false);
      setSelectedTeacher(null);
      setNewMsgText("");
      setRecipientSearch("");

      // Switch to new/updated conversation
      const newConvId = data.data.conversationId;
      await refreshConversations();
      openConversation(newConvId);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSendingNew(false);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  // Filtered conversation list
  const filteredConversations = conversations.filter((c) => {
    if (filterTab === "teachers" && c.type !== "TEACHER_STUDENT") return false;
    if (filterTab === "admin" && c.type !== "STUDENT_ADMIN") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.otherParticipant?.name?.toLowerCase().includes(q);
      const matchSub = c.teacher?.department?.toLowerCase().includes(q);
      const matchBody = c.lastMessage?.body?.toLowerCase().includes(q);
      return matchName || matchSub || matchBody;
    }
    return true;
  });

  const badgeFor = (type: string) =>
    type === "STUDENT_ADMIN"
      ? { label: "Admin desk", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" }
      : { label: "Teacher", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" };
  const nameOf = (c: ConversationSummary) => (c.type === "STUDENT_ADMIN" ? c.otherParticipant?.name || "Admin Support" : c.otherParticipant?.name || "Teacher");

  return (
    <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex h-[calc(100dvh-140px)] min-h-[520px]">
      {/* Chat list */}
      <div
        className={`${mobileThreadOpen ? "hidden md:flex" : "flex"} w-full md:w-[340px] lg:w-[380px] shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21]`}
      >
        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
          <h1 className="text-[22px] font-black text-slate-900 dark:text-white">Chats</h1>
          <button
            type="button"
            onClick={() => {
              setIsNewModalOpen(true);
              setSelectedTeacher(null);
              setNewMsgText("");
            }}
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm"
            title="New chat"
          >
            <span className="material-symbols-outlined">add_comment</span>
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full pl-10 pr-3 py-2 text-sm bg-slate-100 dark:bg-[#202c33] dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </div>
        <div className="px-3 pb-2 flex gap-1.5">
          {([
            ["all", "All"],
            ["teachers", "Teachers"],
            ["admin", "Admin desk"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterTab(id)}
              className={`px-3 py-1 rounded-full text-[13px] font-semibold transition ${
                filterTab === id
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                  : "bg-slate-100 text-slate-600 dark:bg-[#202c33] dark:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">forum</span>
              <p className="mt-1">No chats yet</p>
              <button type="button" onClick={() => setIsNewModalOpen(true)} className="mt-3 text-emerald-600 font-bold text-sm">
                Message a teacher
              </button>
            </div>
          ) : (
            filteredConversations.map((c) => (
              <ConversationRow
                key={c.id}
                name={nameOf(c)}
                photoUrl={c.otherParticipant?.photoUrl}
                badge={badgeFor(c.type)}
                subtitle={c.teacher?.department ?? null}
                preview={c.lastMessage?.body || "Tap to chat"}
                previewIsMine={c.lastMessage?.senderUserId === currentUserId}
                previewRead={c.lastMessage ? !c.lastMessage.isUnread : false}
                time={c.lastMessage ? listTime(c.lastMessage.createdAt) : null}
                unread={c.unreadCount}
                active={c.id === activeConvId}
                onClick={() => openConversation(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Open chat */}
      <div className={`${mobileThreadOpen ? "flex" : "hidden md:flex"} flex-1 min-w-0 flex-col`}>
        {activeConversation ? (
          <>
            <div className="px-2 sm:px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMobileThreadOpen(false)}
                className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-200"
                aria-label="Back to chats"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <ChatAvatar name={nameOf(activeConversation)} photoUrl={activeConversation.otherParticipant?.photoUrl} size={40} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">{nameOf(activeConversation)}</h2>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                  {activeConversation.type === "STUDENT_ADMIN"
                    ? "Atomic Pathshala support"
                    : [activeConversation.teacher?.department, "Teacher"].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadMessages(activeConversation.id)}
                title="Refresh"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
            <ChatStream
              messages={messages}
              currentUserId={currentUserId}
              loading={loadingMessages}
              showSenderNames={activeConversation.type === "STUDENT_ADMIN"}
              emptyHint="Ask your question here — your teacher will reply in this chat."
            />
            <ChatComposer value={inputText} onChange={setInputText} onSend={() => handleSendMessage()} sending={sending} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#f0f2f5] dark:bg-[#222e35]">
            <span className="material-symbols-outlined text-6xl text-emerald-600/70">forum</span>
            <h3 className="mt-3 text-lg font-bold text-slate-700 dark:text-slate-200">Atomic Pathshala Chats</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">Message your teachers or the admin desk. Pick a chat on the left to continue.</p>
          </div>
        )}
      </div>

      {/* New Message Composer Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">outgoing_mail</span>
                Compose New Message
              </h2>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Recipient Target Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Send Message To
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setComposeRecipientType("TEACHER");
                      setSelectedTeacher(null);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      composeRecipientType === "TEACHER"
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">school</span>
                    Teacher / Faculty
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposeRecipientType("ADMIN");
                      setSelectedTeacher(null);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      composeRecipientType === "ADMIN"
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">support_agent</span>
                    Admin Helpdesk
                  </button>
                </div>
              </div>

              {/* Teacher Selection */}
              {composeRecipientType === "TEACHER" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Select Teacher
                  </label>
                  {selectedTeacher ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {selectedTeacher.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {selectedTeacher.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {selectedTeacher.department || "Faculty"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTeacher(null)}
                        className="text-xs text-orange-600 hover:underline font-semibold"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="Search teacher name or subject..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-orange-500 focus:outline-none"
                      />
                      <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                        {loadingTeachers ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            Loading faculty list...
                          </div>
                        ) : teacherOptions.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No teachers found
                          </div>
                        ) : (
                          teacherOptions.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTeacher(t)}
                              className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-xs transition cursor-pointer"
                            >
                              <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                                {t.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {t.name}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {t.department || "Faculty"}
                                </p>
                              </div>
                              <span className="material-symbols-outlined text-slate-400 text-sm">
                                chevron_right
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Desk Notice */}
              {composeRecipientType === "ADMIN" && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-300 text-xs leading-relaxed">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <span className="material-symbols-outlined text-base">info</span>
                    Direct Admin &amp; Student Operations Desk
                  </div>
                  Your message will be sent directly to the Atomic Pathshala Administration team for
                  quick assistance regarding admissions, batches, tests, or technical questions.
                </div>
              )}

              {/* Message Body */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Message
                </label>
                <textarea
                  rows={4}
                  value={newMsgText}
                  onChange={(e) => setNewMsgText(e.target.value)}
                  placeholder="Type your message or inquiry here..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-orange-500 focus:outline-none resize-none transition"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartNewConversation}
                disabled={
                  isSendingNew ||
                  !newMsgText.trim() ||
                  (composeRecipientType === "TEACHER" && !selectedTeacher)
                }
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSendingNew ? (
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                ) : (
                  <>
                    <span>Send Message</span>
                    <span className="material-symbols-outlined text-sm">send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
