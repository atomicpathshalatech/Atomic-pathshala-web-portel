"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { directConversationChannel, DIRECT_MESSAGE_EVENTS } from "@/lib/realtime/events";
import type { ConversationSummary, MessageItem } from "@/lib/messages/messaging-service";
import { ChatAvatar } from "./ChatAvatar";
import { ChatRow } from "./ChatRow";
import { ChatStream } from "./ChatStream";
import { ChatComposer } from "./ChatComposer";
import { ChatInfoDrawer } from "./ChatInfoDrawer";
import { MediaLightbox } from "./MediaLightbox";
import { ForwardModal } from "./ForwardModal";
import { NewChatModal } from "./NewChatModal";
import { playWhatsAppDing } from "./sound";

export function WhatsAppChat({
  initialConversations,
  currentUserId,
  currentUserRole,
}: {
  initialConversations: ConversationSummary[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversations[0]?.id || null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "teachers" | "doubts" | "batches" | "admin" | "unread" | "archived">("all");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  // Advanced WhatsApp State
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messagesToForward, setMessagesToForward] = useState<MessageItem[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: string; name?: string } | null>(null);
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [searchInChatQuery, setSearchInChatQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<string, { userName: string; isTyping: boolean }>>({});

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

  // Fetch / Refresh Conversation List
  const refreshConversations = async () => {
    try {
      const url = new URL("/api/messages/conversations", window.location.origin);
      if (searchQuery) url.searchParams.set("search", searchQuery);
      if (filterTab !== "all") url.searchParams.set("tab", filterTab);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.conversations)) {
          setConversations(data.data.conversations);
        }
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    refreshConversations();
  }, [searchQuery, filterTab]);

  // Load Thread Messages
  const loadMessages = async (convId: string, cursor?: string) => {
    if (!cursor) setLoadingMessages(true);
    try {
      const url = new URL(`/api/messages/conversations/${convId}`, window.location.origin);
      if (cursor) url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", "50");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      if (data.success) {
        if (cursor) {
          setMessages((prev) => [...(data.data.messages || []), ...prev]);
        } else {
          setMessages(data.data.messages || []);
        }
        setHasMore(Boolean(data.data.hasMore));

        // Mark as read in local conversation list
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load messages");
    } finally {
      if (!cursor) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConvId) {
      if (!mobileThreadOpen && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        return;
      }
      loadMessages(activeConvId);
      setReplyingTo(null);
      setEditingMessage(null);
      setIsSelectMode(false);
      setSelectedMsgIds([]);
    } else {
      setMessages([]);
    }
  }, [activeConvId, mobileThreadOpen]);

  // Real-time Pusher Subscription for Active Conversation
  useEffect(() => {
    if (!activeConvId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = directConversationChannel(activeConvId);
    const channel = pusher.subscribe(channelName);

    // Incoming new message
    channel.bind(DIRECT_MESSAGE_EVENTS.NEW_MESSAGE, (incomingMsg: MessageItem) => {
      setMessages((prev) => {
        // If message exists (e.g. optimistic), replace it; otherwise append
        const exists = prev.some((m) => m.id === incomingMsg.id);
        if (exists) {
          return prev.map((m) => (m.id === incomingMsg.id ? incomingMsg : m));
        }
        return [
          ...prev,
          {
            ...incomingMsg,
            isSelf: incomingMsg.senderUserId === currentUserId,
          },
        ];
      });

      // Sound notification if received from someone else
      if (incomingMsg.senderUserId !== currentUserId && !activeConv?.isMuted) {
        playWhatsAppDing(0.35);
      }

      // Update sidebar conversation summary
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? {
                ...c,
                lastMessage: {
                  id: incomingMsg.id,
                  body: incomingMsg.body,
                  mediaType: incomingMsg.mediaType,
                  mediaName: incomingMsg.mediaName,
                  createdAt: incomingMsg.createdAt,
                  senderUserId: incomingMsg.senderUserId,
                  senderRole: incomingMsg.senderRole,
                  isUnread: false,
                  readAt: incomingMsg.readAt || null,
                  isDeleted: incomingMsg.isDeleted,
                  isEdited: incomingMsg.isEdited,
                },
                updatedAt: incomingMsg.createdAt,
              }
            : c
        )
      );
    });

    // Message updated (edit, reaction, pin, delete)
    channel.bind(DIRECT_MESSAGE_EVENTS.MESSAGE_UPDATED, (updatePayload: any) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === updatePayload.id) {
            return {
              ...m,
              ...updatePayload,
              ...(updatePayload.reactions ? { reactions: updatePayload.reactions } : {}),
            };
          }
          return m;
        })
      );
    });

    // Read receipts
    channel.bind(DIRECT_MESSAGE_EVENTS.MESSAGES_READ, (receipt: any) => {
      if (receipt.readByUserId !== currentUserId) {
        setMessages((prev) =>
          prev.map((m) => (m.senderUserId === currentUserId ? { ...m, status: "read", readAt: receipt.readAt } : m))
        );
      }
    });

    // Typing status
    channel.bind(DIRECT_MESSAGE_EVENTS.TYPING_STATUS, (data: any) => {
      if (data.userId !== currentUserId) {
        setTypingUsers((prev) => ({
          ...prev,
          [activeConvId]: { userName: data.userName, isTyping: data.isTyping },
        }));
      }
    });

    // Conversation setting updated
    channel.bind(DIRECT_MESSAGE_EVENTS.CONVERSATION_UPDATED, (convUpdate: any) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === convUpdate.id ? { ...c, ...convUpdate } : c))
      );
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [activeConvId, currentUserId, activeConv?.isMuted]);

  // Open Conversation
  const handleOpenConversation = (convId: string) => {
    setActiveConvId(convId);
    setMobileThreadOpen(true);
  };

  // Send Text / Media Message
  const handleSendMessage = async () => {
    if (!activeConvId || (!inputText.trim() && !editingMessage)) return;

    // Handle Edit Mode
    if (editingMessage) {
      try {
        setSending(true);
        const res = await fetch("/api/messages/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            messageId: editingMessage.id,
            text: inputText.trim(),
          }),
        });
        if (res.ok) {
          setEditingMessage(null);
          setInputText("");
        } else {
          toast.error("Failed to update message");
        }
      } catch {
        toast.error("Failed to update message");
      } finally {
        setSending(false);
      }
      return;
    }

    const cleanText = inputText.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Optimistic Message Item
    const optimisticMsg: MessageItem = {
      id: tempId,
      conversationId: activeConvId,
      senderUserId: currentUserId,
      senderName: "You",
      senderPhotoUrl: null,
      senderRole: currentUserRole,
      body: cleanText,
      replyToId: replyingTo?.id || null,
      replyToMessage: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            senderRole: replyingTo.senderRole,
            body: replyingTo.body,
            mediaType: replyingTo.mediaType,
          }
        : null,
      createdAt: now,
      isSelf: true,
      pending: true,
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    const prevReplying = replyingTo;
    setReplyingTo(null);
    setSending(true);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          message: cleanText,
          clientMessageId: tempId,
          replyToId: prevReplying?.id || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message");
      }

      // Replace optimistic message with confirmed server message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...data.data.message, isSelf: true, pending: false, status: "sent" } : m))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Upload & Send Media
  const handleSendMedia = async (file: File, mediaType: "IMAGE" | "VIDEO" | "DOCUMENT" | "VOICE") => {
    if (!activeConvId) return;
    const toastId = toast.loading(`Uploading ${mediaType.toLowerCase()}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || "File upload failed");
      }

      const mediaUrl = uploadData.data?.url || uploadData.url;

      // Send message with media
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          message: "",
          mediaUrl,
          mediaType,
          mediaName: file.name,
          mediaSize: file.size,
          replyToId: replyingTo?.id || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send media");

      toast.success(`${mediaType} sent!`, { id: toastId });
      setReplyingTo(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send media", { id: toastId });
    }
  };

  // Typing Broadcaster
  const handleTyping = async (isTyping: boolean) => {
    if (!activeConvId) return;
    try {
      await fetch("/api/messages/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "typing", conversationId: activeConvId, isTyping }),
      });
    } catch {
      // Non-blocking
    }
  };

  // React to Message
  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await fetch("/api/messages/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "react", messageId, emoji }),
      });
    } catch {
      toast.error("Failed to react");
    }
  };

  // Star Message
  const handleStar = async (messageId: string) => {
    try {
      const res = await fetch("/api/messages/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "star", messageId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isStarred: data.data.isStarred } : m))
        );
        toast.success(data.data.isStarred ? "Message starred" : "Message unstarred");
      }
    } catch {
      toast.error("Failed to star message");
    }
  };

  // Pin Message
  const handlePin = async (messageId: string) => {
    try {
      const res = await fetch("/api/messages/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pin", messageId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.data.isPinned ? "Message pinned" : "Message unpinned");
      }
    } catch {
      toast.error("Failed to pin message");
    }
  };

  // Delete Message
  const handleDelete = async (messageId: string, mode: "ME" | "EVERYONE") => {
    try {
      const res = await fetch("/api/messages/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", messageId, mode }),
      });
      if (res.ok) {
        if (mode === "ME") {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
        toast.success(mode === "ME" ? "Deleted for you" : "Deleted for everyone");
      }
    } catch {
      toast.error("Failed to delete message");
    }
  };

  // Toggle Conversation Pin / Mute / Archive
  const handleToggleConvPin = async (convId: string, isPinned: boolean) => {
    try {
      const res = await fetch(`/api/messages/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, isPinned } : c))
        );
        toast.success(isPinned ? "Chat pinned" : "Chat unpinned");
      }
    } catch {
      toast.error("Failed to update chat");
    }
  };

  const handleToggleConvMute = async (convId: string, isMuted: boolean) => {
    try {
      const res = await fetch(`/api/messages/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMuted }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, isMuted } : c))
        );
        toast.success(isMuted ? "Notifications muted" : "Notifications unmuted");
      }
    } catch {
      toast.error("Failed to update chat");
    }
  };

  const handleToggleConvArchive = async (convId: string, isArchived: boolean) => {
    try {
      const res = await fetch(`/api/messages/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, isArchived } : c))
        );
        toast.success(isArchived ? "Chat archived" : "Chat unarchived");
      }
    } catch {
      toast.error("Failed to update chat");
    }
  };

  // Start New Chat from Modal
  const handleStartNewChat = async (recipient: {
    type: "TEACHER" | "STUDENT" | "ADMIN" | "BATCH" | "DOUBT";
    recipientId?: string;
    initialMessage?: string;
    batchId?: string;
  }) => {
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientType: recipient.type,
        recipientId: recipient.recipientId,
        message: recipient.initialMessage || "Hello!",
      }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.data?.conversationId) {
      await refreshConversations();
      setActiveConvId(data.data.conversationId);
      setMobileThreadOpen(true);
      toast.success("Chat started!");
    } else {
      throw new Error(data.error || "Failed to start chat");
    }
  };

  // Forward Messages
  const handleForwardMessages = async (targetConvIds: string[]) => {
    const toastId = toast.loading("Forwarding messages...");
    try {
      for (const convId of targetConvIds) {
        for (const msg of messagesToForward) {
          await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: convId,
              message: msg.body,
              mediaUrl: msg.mediaUrl,
              mediaType: msg.mediaType,
              mediaName: msg.mediaName,
              mediaSize: msg.mediaSize,
              isForwarded: true,
            }),
          });
        }
      }
      toast.success("Messages forwarded!", { id: toastId });
      setIsSelectMode(false);
      setSelectedMsgIds([]);
    } catch {
      toast.error("Failed to forward some messages", { id: toastId });
    }
  };

  // Filtered Messages by In-Chat Search
  const filteredMessages = useMemo(() => {
    if (!searchInChatQuery.trim()) return messages;
    const q = searchInChatQuery.toLowerCase();
    return messages.filter((m) => (m.body || "").toLowerCase().includes(q));
  }, [messages, searchInChatQuery]);

  const activeTyping = activeConvId ? typingUsers[activeConvId] : null;

  return (
    <div className="flex h-[calc(100vh-4.5rem)] min-h-[550px] w-full rounded-2xl overflow-hidden bg-white dark:bg-[#111b21] shadow-2xl border border-slate-200/80 dark:border-slate-800">
      {/* ---------------- LEFT PANEL: CHAT LIST ---------------- */}
      <div
        className={`w-full md:w-[380px] lg:w-[420px] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21] shrink-0 ${
          mobileThreadOpen ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Left Top Header */}
        <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <ChatAvatar name="You" size={40} isOnline />
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Chats
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow transition active:scale-95"
              title="New Chat"
            >
              <span className="material-symbols-outlined text-xl">add_comment</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] px-3.5 py-1.5 rounded-xl text-sm">
            <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Search chats or messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 text-slate-900 dark:text-white placeholder:text-slate-400 text-[13.5px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar text-xs">
          {[
            { id: "all", label: "All" },
            { id: "teachers", label: "Teachers" },
            { id: "doubts", label: "Doubts" },
            { id: "batches", label: "Batches" },
            { id: "admin", label: "Admin Desk" },
            { id: "unread", label: "Unread" },
            { id: "archived", label: "Archived" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
                filterTab === tab.id
                  ? "bg-emerald-600 text-white shadow-sm font-semibold"
                  : "bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50">
          {conversations.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">chat_bubble_outline</span>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No chats yet</p>
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
              >
                Message a teacher or batch
              </button>
            </div>
          ) : (
            conversations.map((c) => (
              <ChatRow
                key={c.id}
                conversation={c}
                active={c.id === activeConvId}
                currentUserId={currentUserId}
                isTyping={typingUsers[c.id]?.isTyping}
                onClick={() => handleOpenConversation(c.id)}
                onPin={handleToggleConvPin}
                onMute={handleToggleConvMute}
                onArchive={handleToggleConvArchive}
              />
            ))
          )}
        </div>
      </div>

      {/* ---------------- RIGHT PANEL: CONVERSATION SCREEN ---------------- */}
      <div
        className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] min-w-0 ${
          mobileThreadOpen ? "flex" : "hidden md:flex"
        }`}
      >
        {activeConv ? (
          <>
            {/* Conversation Top Header */}
            <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back Button on Mobile */}
                <button
                  type="button"
                  onClick={() => setMobileThreadOpen(false)}
                  className="md:hidden w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 -ml-1"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <div
                  onClick={() => setShowInfoDrawer(true)}
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                >
                  <ChatAvatar
                    name={activeConv.title || activeConv.otherParticipant.name}
                    photoUrl={activeConv.iconUrl || activeConv.otherParticipant.photoUrl}
                    size={42}
                    type={activeConv.type}
                    isOnline={activeConv.otherParticipant.isOnline}
                  />

                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white truncate">
                      {activeConv.title || activeConv.otherParticipant.name}
                    </h3>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                      {activeTyping?.isTyping ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                          {activeTyping.userName} is typing...
                        </span>
                      ) : activeConv.type === "BATCH_GROUP" ? (
                        `${activeConv.batchName || "Batch Group"} · Tap for info`
                      ) : activeConv.otherParticipant.isOnline ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Online</span>
                      ) : (
                        activeConv.otherParticipant.role || "Tap for info"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setShowSearchInChat((v) => !v)}
                  className={`w-9 h-9 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition ${
                    showSearchInChat ? "text-emerald-600" : ""
                  }`}
                  title="Search in chat"
                >
                  <span className="material-symbols-outlined text-xl">search</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInfoDrawer(true)}
                  className="w-9 h-9 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
                  title="View Info"
                >
                  <span className="material-symbols-outlined text-xl">info</span>
                </button>
              </div>
            </div>

            {/* In-Chat Search Bar */}
            {showSearchInChat && (
              <div className="px-4 py-2 bg-white dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150">
                <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-[#111b21] px-3 py-1.5 rounded-xl text-sm">
                  <span className="material-symbols-outlined text-slate-400 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search messages in this chat..."
                    value={searchInChatQuery}
                    onChange={(e) => setSearchInChatQuery(e.target.value)}
                    className="bg-transparent border-none outline-none flex-1 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs"
                    autoFocus
                  />
                  {searchInChatQuery && (
                    <span className="text-xs text-slate-400 font-medium">
                      {filteredMessages.length} found
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSearchInChat(false);
                    setSearchInChatQuery("");
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
            )}

            {/* Message Stream */}
            <ChatStream
              messages={filteredMessages}
              currentUserId={currentUserId}
              loading={loadingMessages}
              hasMore={hasMore}
              showSenderNames={activeConv.type === "BATCH_GROUP" || activeConv.type === "STUDENT_ADMIN"}
              onLoadMore={() => {
                if (activeConv?.id && messages.length > 0 && messages[0]?.id) {
                  loadMessages(activeConv.id, messages[0].id);
                }
              }}
              onReply={(msg) => setReplyingTo(msg)}
              onReact={handleReact}
              onStar={handleStar}
              onPin={handlePin}
              onForward={(msg) => {
                setMessagesToForward([msg]);
                setShowForwardModal(true);
              }}
              onEdit={(msg) => {
                setEditingMessage(msg);
                setInputText(msg.body);
              }}
              onDelete={handleDelete}
              onOpenMedia={(url, type, name) => setLightboxMedia({ url, type, name })}
              isSelectMode={isSelectMode}
              selectedMsgIds={selectedMsgIds}
              onToggleSelect={(msgId) =>
                setSelectedMsgIds((prev) =>
                  prev.includes(msgId) ? prev.filter((i) => i !== msgId) : [...prev, msgId]
                )
              }
            />

            {/* Composer */}
            <ChatComposer
              value={inputText}
              onChange={setInputText}
              onSend={handleSendMessage}
              onSendMedia={handleSendMedia}
              onTyping={handleTyping}
              sending={sending}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              editingMessage={editingMessage}
              onCancelEdit={() => {
                setEditingMessage(null);
                setInputText("");
              }}
              disabled={activeConv.onlyAdminsCanPost && currentUserRole === "STUDENT"}
              disabledReason="Only administrators and teachers can send messages in this group."
            />
          </>
        ) : (
          /* Empty Placeholder Screen */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
              <span className="material-symbols-outlined text-5xl">chat</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">
              Atomic Pathshala Chats
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Message your teachers, batch cohorts, doubt experts or the admin desk. Select a conversation on the left to start.
            </p>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="mt-6 px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg transition active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add_comment</span>
              New Chat
            </button>
          </div>
        )}
      </div>

      {/* ---------------- MODALS & DRAWERS ---------------- */}

      {/* Info Drawer */}
      {showInfoDrawer && activeConv && (
        <ChatInfoDrawer
          conversation={activeConv}
          messages={messages}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setShowInfoDrawer(false)}
          onMuteToggle={(muted) => handleToggleConvMute(activeConv.id, muted)}
        />
      )}

      {/* Lightbox */}
      {lightboxMedia && (
        <MediaLightbox
          mediaUrl={lightboxMedia.url}
          mediaType={lightboxMedia.type}
          mediaName={lightboxMedia.name}
          onClose={() => setLightboxMedia(null)}
        />
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <ForwardModal
          messagesToForward={messagesToForward}
          conversations={conversations}
          onForward={handleForwardMessages}
          onClose={() => setShowForwardModal(false)}
        />
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onStartChat={handleStartNewChat}
          onClose={() => setShowNewChatModal(false)}
        />
      )}
    </div>
  );
}
