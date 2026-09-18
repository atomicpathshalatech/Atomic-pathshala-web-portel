"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { directConversationChannel, DIRECT_MESSAGE_EVENTS } from "@/lib/realtime/events";
import type { ConversationSummary } from "@/lib/messages/messaging-service";

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
}

export function TeamMessagesConsole({
  initialConversations,
  currentUserId,
  currentUserRole,
}: {
  initialConversations: ConversationSummary[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const isAdmin =
    currentUserRole === "SUPER_ADMIN" ||
    currentUserRole === "ADMIN" ||
    currentUserRole === "FOUNDER" ||
    currentUserRole === "SUB_ADMIN";

  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    initialConversations[0]?.id || null
  );
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminTab, setAdminTab] = useState<"all" | "admin_desk" | "teacher_directs">("all");

  // New Message Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [recipientTab, setRecipientTab] = useState<"STUDENT" | "TEACHER" | "ADMIN">("STUDENT");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<any[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any | null>(null);
  const [newMsgText, setNewMsgText] = useState("");
  const [isSendingNew, setIsSendingNew] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of active message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations list
  const refreshConversations = async (tab = adminTab, query = searchQuery) => {
    try {
      const url = new URL("/api/messages/conversations", window.location.origin);
      if (isAdmin && tab) url.searchParams.set("tab", tab);
      if (query) url.searchParams.set("search", query);

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

  // Load messages for the selected conversation
  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/conversations/${convId}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages || []);

        // Decrement local conversation unread count
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
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  // Realtime Pusher subscription on active conversation
  useEffect(() => {
    if (!activeConvId) return;

    try {
      const pusher = getPusherClient();
      const channelName = directConversationChannel(activeConvId);
      const channel = pusher.subscribe(channelName);

      channel.bind(DIRECT_MESSAGE_EVENTS.NEW_MESSAGE, (incoming: any) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [
            ...prev,
            {
              ...incoming,
              isSelf: incoming.senderUserId === currentUserId,
            },
          ];
        });

        // Update last message in conversation sidebar
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConvId) {
              return {
                ...c,
                lastMessage: {
                  id: incoming.id,
                  body: incoming.body,
                  createdAt: incoming.createdAt,
                  senderUserId: incoming.senderUserId,
                  senderRole: incoming.senderRole,
                  isUnread: false,
                },
                updatedAt: incoming.createdAt,
              };
            }
            return c;
          })
        );
      });

      return () => {
        pusher.unsubscribe(channelName);
      };
    } catch (err) {
      console.warn("Pusher binding error:", err);
    }
  }, [activeConvId, currentUserId]);

  // Send message in current thread
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending || !activeConvId) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const activeConv = conversations.find((c) => c.id === activeConvId);
      const recipientType =
        activeConv?.type === "TEACHER_ADMIN"
          ? isAdmin ? "TEACHER" : "ADMIN"
          : activeConv?.otherParticipant?.role === "STUDENT"
          ? "STUDENT"
          : activeConv?.otherParticipant?.role === "TEACHER"
          ? "TEACHER"
          : "ADMIN";

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          message: text,
          recipientType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to deliver message");
      }

      // Add to local state if Pusher hasn't added it already
      const newMsg = data.data.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [
          ...prev,
          {
            ...newMsg,
            isSelf: true,
          },
        ];
      });

      refreshConversations();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setInputText(text); // restore input
    } finally {
      setSending(false);
    }
  };

  // Search recipients for Compose modal
  const fetchRecipients = async (type: string, q: string) => {
    setLoadingRecipients(true);
    try {
      const url = new URL("/api/messages/recipients", window.location.origin);
      if (type !== "ADMIN") url.searchParams.set("type", type);
      if (q) url.searchParams.set("q", q);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        if (type === "ADMIN") {
          setRecipientOptions([data.data.admin]);
        } else if (type === "TEACHER") {
          setRecipientOptions(data.data.teachers || []);
        } else {
          setRecipientOptions(data.data.students || []);
        }
      }
    } catch {
      toast.error("Failed to load recipients");
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    if (isNewModalOpen) {
      fetchRecipients(recipientTab, recipientSearch);
    }
  }, [isNewModalOpen, recipientTab, recipientSearch]);

  // Submit Compose New Message
  const handleCreateNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient || !newMsgText.trim() || isSendingNew) return;

    setIsSendingNew(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType: selectedRecipient.type,
          recipientId: selectedRecipient.userId || selectedRecipient.id,
          message: newMsgText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate conversation");
      }

      toast.success("Message delivered successfully!");
      setIsNewModalOpen(false);
      setSelectedRecipient(null);
      setNewMsgText("");
      setRecipientSearch("");

      // Select newly created conversation
      const newConvId = data.data.conversationId;
      await refreshConversations();
      setActiveConvId(newConvId);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSendingNew(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row h-[780px]">
      {/* 1. LEFT PANE: CONVERSATION LIST & FILTERS */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Header with Compose Button */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-extrabold text-base text-[#031635] dark:text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-xl">forum</span>
              <span>Inbox &amp; Messages</span>
            </h2>
            <p className="text-xs text-slate-500">
              {isAdmin ? "Global communication console" : "Direct messages with students & staff"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedRecipient(null);
              setNewMsgText("");
              setIsNewModalOpen(true);
            }}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition flex items-center justify-center shrink-0"
            title="Compose New Message"
          >
            <span className="material-symbols-outlined text-lg">edit_square</span>
          </button>
        </div>

        {/* Admin Tabs */}
        {isAdmin && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 p-1.5 gap-1 bg-white dark:bg-slate-900 text-xs">
            {[
              { id: "all", label: "All Threads" },
              { id: "admin_desk", label: "Helpdesk" },
              { id: "teacher_directs", label: "Teacher ↔ Student" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setAdminTab(t.id as any);
                  refreshConversations(t.id as any, searchQuery);
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${
                  adminTab === t.id
                    ? "bg-[#031635] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Search Filter */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                refreshConversations(adminTab, e.target.value);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">chat_bubble_outline</span>
              <p>No conversations found.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const active = c.id === activeConvId;
              const roleBadgeColor =
                c.otherParticipant?.role === "TEACHER"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : c.otherParticipant?.role === "ADMIN"
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-purple-100 text-purple-800 border-purple-200";

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left p-3.5 transition flex items-start gap-3 hover:bg-white dark:hover:bg-slate-800/80 ${
                    active ? "bg-white dark:bg-slate-800 shadow-xs border-l-4 border-l-blue-600" : ""
                  }`}
                >
                  {/* Avatar */}
                  {c.otherParticipant?.photoUrl ? (
                    <img
                      src={c.otherParticipant.photoUrl}
                      alt={c.otherParticipant.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {c.otherParticipant?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {c.otherParticipant?.name}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                        {c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${roleBadgeColor}`}>
                        {c.otherParticipant?.role}
                      </span>
                      {c.type === "STUDENT_ADMIN" && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Helpdesk
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 truncate mt-1">
                      {c.lastMessage?.body || "No messages yet"}
                    </p>
                  </div>

                  {/* Unread Pill */}
                  {c.unreadCount > 0 && (
                    <span className="min-w-4.5 h-4.5 px-1 bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full shrink-0 animate-pulse">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. RIGHT PANE: ACTIVE CHAT THREAD */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-w-0">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                {activeConv.otherParticipant?.photoUrl ? (
                  <img
                    src={activeConv.otherParticipant.photoUrl}
                    alt={activeConv.otherParticipant.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                    {activeConv.otherParticipant?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-[#031635] dark:text-white truncate">
                    {activeConv.otherParticipant?.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{activeConv.otherParticipant?.email}</span>
                    {activeConv.otherParticipant?.phone && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{activeConv.otherParticipant?.phone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {activeConv.type.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/20">
              {loadingMessages ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Loading message thread...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No messages yet. Send a message below to start this conversation.
                </div>
              ) : (
                messages.map((m) => {
                  const isSelf = m.isSelf;
                  const rolePill =
                    m.senderRole === "ADMIN"
                      ? "bg-blue-600 text-white"
                      : m.senderRole === "TEACHER"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-600 text-white";

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{m.senderName}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-extrabold uppercase ${rolePill}`}>
                          {m.senderRole}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed break-words ${
                          isSelf
                            ? "bg-blue-600 text-white rounded-tr-xs"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message... (Press Enter to send)"
                disabled={sending}
                className="flex-1 px-4 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-slate-900 dark:text-white transition"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-base">send</span>
                <span>{sending ? "Sending..." : "Send"}</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-2 text-slate-300">chat</span>
            <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">No Conversation Selected</h4>
            <p className="text-xs mt-1 max-w-sm">
              Pick a conversation from the left pane or click Compose to initiate a new direct thread.
            </p>
          </div>
        )}
      </div>

      {/* 3. COMPOSE / NEW MESSAGE MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#031635] dark:text-white">
                  Compose New Message
                </h3>
                <p className="text-xs text-slate-500">Direct routed messaging with real-time delivery.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Recipient Type Tabs */}
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl p-1 gap-1 text-xs font-bold">
              {[
                { id: "STUDENT", label: "Student" },
                { id: "TEACHER", label: "Teacher" },
                ...(isAdmin ? [] : [{ id: "ADMIN", label: "Administration" }]),
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRecipientTab(tab.id as any);
                    setSelectedRecipient(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${
                    recipientTab === tab.id
                      ? "bg-[#031635] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Recipient Selector / Search */}
            {recipientTab !== "ADMIN" ? (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Select {recipientTab === "STUDENT" ? "Student" : "Teacher"} *
                </label>
                <input
                  type="text"
                  placeholder={`Search ${recipientTab.toLowerCase()} by name or email...`}
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />

                <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingRecipients ? (
                    <div className="p-3 text-center text-slate-400 text-xs">Searching...</div>
                  ) : recipientOptions.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">No matching recipients</div>
                  ) : (
                    recipientOptions.map((r) => {
                      const isSelected = selectedRecipient?.id === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRecipient(r)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition hover:bg-blue-50 dark:hover:bg-slate-800 ${
                            isSelected ? "bg-blue-50 dark:bg-blue-950 font-bold" : ""
                          }`}
                        >
                          <div>
                            <p className="text-slate-900 dark:text-white">{r.name}</p>
                            <p className="text-[10px] text-slate-400">{r.subtitle || r.email}</p>
                          </div>
                          {isSelected && <span className="material-symbols-outlined text-blue-600 text-sm">check_circle</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 text-xs text-blue-900 dark:text-blue-200">
                <p className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">support_agent</span>
                  Official Administration Helpdesk
                </p>
                <p className="text-[11px] mt-1 text-slate-600 dark:text-slate-300">
                  This message will be routed directly to the Central Admin Desk for review and resolution.
                </p>
              </div>
            )}

            {/* Message Body */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Message *</label>
              <textarea
                rows={3}
                placeholder="Write your message..."
                value={newMsgText}
                onChange={(e) => setNewMsgText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewConversation}
                disabled={
                  (recipientTab !== "ADMIN" && !selectedRecipient) ||
                  !newMsgText.trim() ||
                  isSendingNew
                }
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                <span>{isSendingNew ? "Sending..." : "Send Message"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
