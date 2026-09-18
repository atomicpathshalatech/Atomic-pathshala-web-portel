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

  // New Message Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [composeRecipientType, setComposeRecipientType] = useState<"TEACHER" | "ADMIN">("TEACHER");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [teacherOptions, setTeacherOptions] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [newMsgText, setNewMsgText] = useState("");
  const [isSendingNew, setIsSendingNew] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

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
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, { ...newMsg, isSelf: true }];
      });

      // Refresh conversations snippet
      refreshConversations();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
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
      setActiveConvId(newConvId);
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

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[550px]">
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500 text-2xl">forum</span>
            Messages &amp; Inbox
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Connect directly with your Subject Faculty and Admin Support Desk
          </p>
        </div>

        <button
          onClick={() => {
            setIsNewModalOpen(true);
            setSelectedTeacher(null);
            setNewMsgText("");
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add_comment</span>
          New Message
        </button>
      </div>

      {/* Main Content: Split Master-Detail */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Conversations Sidebar */}
        <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
          {/* Filter Tabs */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 bg-slate-50/40 dark:bg-slate-800/20">
            <button
              onClick={() => setFilterTab("all")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition ${
                filterTab === "all"
                  ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab("teachers")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition ${
                filterTab === "teachers"
                  ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Teachers
            </button>
            <button
              onClick={() => setFilterTab("admin")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition ${
                filterTab === "admin"
                  ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Admin Desk
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-transparent focus:border-orange-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                <span className="material-symbols-outlined text-3xl mb-2 text-slate-300 dark:text-slate-600">
                  chat_bubble_outline
                </span>
                <p>No conversations found</p>
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="mt-3 text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                >
                  Send a new message
                </button>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c.id === activeConvId;
                const isTeacher = c.type === "TEACHER_STUDENT";
                const isAdminDesk = c.type === "STUDENT_ADMIN";

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition cursor-pointer ${
                      isActive
                        ? "bg-orange-50/70 dark:bg-orange-950/20 border-l-4 border-orange-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-transparent"
                    }`}
                  >
                    {/* Counterpart Avatar */}
                    <div className="relative shrink-0">
                      {c.otherParticipant?.photoUrl ? (
                        <img
                          src={c.otherParticipant.photoUrl}
                          alt={c.otherParticipant.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                            isAdminDesk
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                          }`}
                        >
                          {isAdminDesk
                            ? "AD"
                            : c.otherParticipant?.name?.charAt(0).toUpperCase() || "T"}
                        </div>
                      )}
                    </div>

                    {/* Metadata & Message Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {c.otherParticipant?.name || "Participant"}
                        </span>
                        {c.lastMessage && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(c.lastMessage.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            isAdminDesk
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {isAdminDesk ? "Admin Support" : "Teacher"}
                        </span>
                        {c.teacher?.department && (
                          <span className="text-[10px] text-slate-400 truncate">
                            • {c.teacher.department}
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-xs truncate ${
                          c.unreadCount > 0
                            ? "font-semibold text-slate-900 dark:text-white"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {c.lastMessage?.body || "Conversation started"}
                      </p>
                    </div>

                    {/* Unread Pill */}
                    {c.unreadCount > 0 && (
                      <span className="shrink-0 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Message Thread */}
        <div className="flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-900/40">
          {activeConversation ? (
            <>
              {/* Conversation Top Info Bar */}
              <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {activeConversation.otherParticipant?.photoUrl ? (
                      <img
                        src={activeConversation.otherParticipant.photoUrl}
                        alt={activeConversation.otherParticipant.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 flex items-center justify-center font-bold text-xs">
                        {activeConversation.type === "STUDENT_ADMIN"
                          ? "AD"
                          : activeConversation.otherParticipant?.name?.charAt(0).toUpperCase() ||
                            "U"}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {activeConversation.otherParticipant?.name}
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          activeConversation.type === "STUDENT_ADMIN"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                        }`}
                      >
                        {activeConversation.type === "STUDENT_ADMIN" ? "Admin Support" : "Teacher"}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {activeConversation.teacher?.department
                        ? `Department: ${activeConversation.teacher.department}`
                        : activeConversation.otherParticipant?.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => loadMessages(activeConversation.id)}
                  title="Refresh messages"
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                </button>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full text-xs text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-2xl mr-2 text-orange-500">
                      progress_activity
                    </span>
                    Loading conversation...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 dark:text-slate-600">
                      chat
                    </span>
                    <p>No messages yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Type your message below to begin this conversation.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMyMessage = m.isSelf || m.senderUserId === currentUserId;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMyMessage ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                            isMyMessage
                              ? "bg-orange-600 text-white rounded-br-xs"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs"
                          }`}
                        >
                          {!isMyMessage && (
                            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mb-1">
                              {m.senderName} ({m.senderRole})
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                        </div>
                        <div
                          className={`flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1 ${
                            isMyMessage ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isMyMessage && (
                            <span
                              className={`material-symbols-outlined text-xs ${
                                m.readAt ? "text-blue-500" : "text-slate-400"
                              }`}
                              title={m.readAt ? "Read" : "Delivered"}
                            >
                              {m.readAt ? "done_all" : "done"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Input */}
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message here... (Shift + Enter for new line)"
                    className="flex-1 p-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-orange-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none resize-none transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="h-11 px-5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    {sending ? (
                      <span className="material-symbols-outlined animate-spin text-sm">
                        progress_activity
                      </span>
                    ) : (
                      <>
                        <span>Send</span>
                        <span className="material-symbols-outlined text-base">send</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <span className="material-symbols-outlined text-5xl mb-3 text-slate-300 dark:text-slate-600">
                mark_email_unread
              </span>
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                No Conversation Selected
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Select an existing conversation from the left, or compose a new message to a teacher or
                Admin Helpdesk.
              </p>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Compose Message
              </button>
            </div>
          )}
        </div>
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
