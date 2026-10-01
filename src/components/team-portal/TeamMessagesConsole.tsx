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
  // Phones show one pane at a time: the chat list, or a chat.
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const openConversation = (id: string) => {
    setActiveConvId(id);
    setMobileThreadOpen(true);
  };

  // New Message Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [recipientTab, setRecipientTab] = useState<"STUDENT" | "TEACHER" | "ADMIN">("STUDENT");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<any[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any | null>(null);
  const [newMsgText, setNewMsgText] = useState("");
  const [isSendingNew, setIsSendingNew] = useState(false);

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
      // On a phone the chat list shows first: don't open (and mark read)
      // a chat the user hasn't tapped yet.
      if (!mobileThreadOpen && window.matchMedia("(max-width: 767px)").matches) return;
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId, mobileThreadOpen]);

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
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversationId: activeConvId,
        senderUserId: currentUserId,
        senderName: "You",
        senderPhotoUrl: null,
        senderRole: isAdmin ? "ADMIN" : "TEACHER",
        body: text,
        readAt: null,
        createdAt: new Date().toISOString(),
        isSelf: true,
        pending: true,
      } as MessageItem,
    ]);

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
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === newMsg.id)) return withoutTemp;
        return [...withoutTemp, { ...newMsg, isSelf: true }];
      });

      refreshConversations();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
      openConversation(newConvId);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSendingNew(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
    STUDENT: { label: "Student", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    TEACHER: { label: "Teacher", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    ADMIN: { label: "Admin", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  };
  const badgeFor = (c: ConversationSummary) =>
    c.type === "STUDENT_ADMIN" && isAdmin
      ? { label: "Helpdesk", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
      : ROLE_BADGE[c.otherParticipant?.role ?? ""] ?? null;

  return (
    <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex h-[calc(100dvh-160px)] min-h-[560px] max-h-[860px]">
      {/* Chat list */}
      <div
        className={`${mobileThreadOpen ? "hidden md:flex" : "flex"} w-full md:w-[340px] lg:w-[380px] shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21]`}
      >
        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[22px] font-black text-slate-900 dark:text-white">Chats</h2>
            <p className="text-[11px] text-slate-500 truncate">{isAdmin ? "All conversations across the institute" : "Your students and staff"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedRecipient(null);
              setNewMsgText("");
              setIsNewModalOpen(true);
            }}
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm shrink-0"
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
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                refreshConversations(adminTab, e.target.value);
              }}
              className="w-full pl-10 pr-3 py-2 text-sm bg-slate-100 dark:bg-[#202c33] dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </div>
        {isAdmin && (
          <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[
              { id: "all", label: "All" },
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
                className={`shrink-0 px-3 py-1 rounded-full text-[13px] font-semibold transition ${
                  adminTab === t.id
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                    : "bg-slate-100 text-slate-600 dark:bg-[#202c33] dark:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">forum</span>
              <p className="mt-1">No chats yet</p>
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationRow
                key={c.id}
                name={c.otherParticipant?.name || "User"}
                photoUrl={c.otherParticipant?.photoUrl}
                badge={badgeFor(c)}
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
        {activeConv ? (
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
              <ChatAvatar name={activeConv.otherParticipant?.name || "User"} photoUrl={activeConv.otherParticipant?.photoUrl} size={40} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">{activeConv.otherParticipant?.name}</h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                  {[ROLE_BADGE[activeConv.otherParticipant?.role ?? ""]?.label, activeConv.otherParticipant?.phone || activeConv.otherParticipant?.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="hidden sm:inline px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {activeConv.type.replace(/_/g, " ").toLowerCase()}
              </span>
            </div>
            <ChatStream
              messages={messages}
              currentUserId={currentUserId}
              loading={loadingMessages}
              showSenderNames={isAdmin || activeConv.type === "STUDENT_ADMIN"}
              emptyHint="No messages yet. Say hello to start this chat."
            />
            <ChatComposer value={inputText} onChange={setInputText} onSend={() => handleSendMessage()} sending={sending} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#f0f2f5] dark:bg-[#222e35]">
            <span className="material-symbols-outlined text-6xl text-emerald-600/70">forum</span>
            <h4 className="mt-3 text-lg font-bold text-slate-700 dark:text-slate-200">Atomic Pathshala Chats</h4>
            <p className="text-sm text-slate-500 max-w-sm mt-1">Pick a chat on the left, or start a new one.</p>
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
