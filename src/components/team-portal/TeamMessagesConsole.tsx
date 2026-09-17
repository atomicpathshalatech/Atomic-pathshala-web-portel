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
  recipientName?: string | null;
  recipientPhotoUrl?: string | null;
  recipientRole?: string | null;
  body: string;
  readAt: string | null;
  isRead?: boolean;
  createdAt: string;
  isSelf: boolean;
}

interface ActiveConversationDetail {
  id: string;
  type: "TEACHER_STUDENT" | "STUDENT_ADMIN" | "TEACHER_ADMIN";
  title: string;
  subtitle: string;
  student?: {
    id: string;
    enrollmentNumber: string | null;
    class: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      photoUrl: string | null;
    };
  } | null;
  teacher?: {
    id: string;
    department: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      photoUrl: string | null;
    };
  } | null;
  adminUser?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    photoUrl: string | null;
    role?: { name: string };
  } | null;
  updatedAt: string;
}

function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatMessageFullDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `${d.toLocaleDateString([], {
      day: "numeric",
      month: "short",
    })}, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

function formatSidebarTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

interface ExtractedParticipant {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
  class?: string | null;
  enrollmentNumber?: string | null;
  department?: string | null;
}

function extractStudentInfo(data: any): ExtractedParticipant | null {
  if (!data) return null;
  return {
    id: data.id,
    userId: data.userId || data.user?.id,
    name: data.name || data.user?.name || "Student",
    email: data.email || data.user?.email || "",
    phone: data.phone || data.user?.phone || null,
    photoUrl: data.photoUrl || data.user?.photoUrl || null,
    class: data.class || null,
    enrollmentNumber: data.enrollmentNumber || null,
  };
}

function extractTeacherInfo(data: any): ExtractedParticipant | null {
  if (!data) return null;
  return {
    id: data.id,
    userId: data.userId || data.user?.id,
    name: data.name || data.user?.name || "Teacher",
    email: data.email || data.user?.email || "",
    phone: data.phone || data.user?.phone || null,
    photoUrl: data.photoUrl || data.user?.photoUrl || null,
    department: data.department || null,
  };
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
  const [activeConvDetail, setActiveConvDetail] = useState<ActiveConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminTab, setAdminTab] = useState<"all" | "teacher_student" | "helpdesk" | "staff_direct">("all");

  // Admin reply target (for TEACHER_STUDENT conversations)
  const [adminReplyTarget, setAdminReplyTarget] = useState<"STUDENT" | "TEACHER">("STUDENT");

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

  // Read URL param conversationId on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramConvId = params.get("conversationId");
      if (paramConvId) {
        setActiveConvId(paramConvId);
      }
    }
  }, []);

  // Fetch updated conversations list
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

  // Load message thread for the selected conversation
  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/conversations/${convId}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages || []);
        setActiveConvDetail(data.data.conversation || null);

        // Reset local conversation unread count
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
      setActiveConvDetail(null);
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
                  senderName: incoming.senderName || incoming.senderRole || "User",
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
      const currStudent = extractStudentInfo(activeConvDetail?.student || activeConv?.student);
      const currTeacher = extractTeacherInfo(activeConvDetail?.teacher || activeConv?.teacher);

      let recipientType: "STUDENT" | "TEACHER" | "ADMIN" = "STUDENT";
      let recipientId: string | undefined = undefined;

      if (activeConv?.type === "TEACHER_STUDENT") {
        if (isAdmin) {
          if (adminReplyTarget === "TEACHER") {
            recipientType = "TEACHER";
            recipientId = currTeacher?.userId || currTeacher?.id;
          } else {
            recipientType = "STUDENT";
            recipientId = currStudent?.userId || currStudent?.id;
          }
        } else if (currentUserRole === "TEACHER") {
          recipientType = "STUDENT";
          recipientId = currStudent?.userId || currStudent?.id;
        } else {
          recipientType = "TEACHER";
          recipientId = currTeacher?.userId || currTeacher?.id;
        }
      } else if (activeConv?.type === "TEACHER_ADMIN") {
        recipientType = isAdmin ? "TEACHER" : "ADMIN";
        recipientId = isAdmin ? (currTeacher?.userId || currTeacher?.id) : undefined;
      } else if (activeConv?.type === "STUDENT_ADMIN") {
        recipientType = isAdmin ? "STUDENT" : "ADMIN";
        recipientId = isAdmin ? (currStudent?.userId || currStudent?.id) : undefined;
      }

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          message: text,
          recipientType,
          recipientId,
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

  // Helper for role pill styling
  const getRoleBadge = (role: string) => {
    const r = (role || "").toUpperCase();
    if (r === "ADMIN" || r === "SUPER_ADMIN" || r === "FOUNDER" || r === "SUB_ADMIN") {
      return {
        label: "Admin",
        badgeBg: "bg-blue-600 text-white shadow-xs",
        chipBg: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800",
        bubbleBorder: "border-blue-200 dark:border-blue-800",
      };
    }
    if (r === "TEACHER") {
      return {
        label: "Teacher",
        badgeBg: "bg-emerald-600 text-white shadow-xs",
        chipBg: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
        bubbleBorder: "border-emerald-200 dark:border-emerald-800",
      };
    }
    return {
      label: "Student",
      badgeBg: "bg-indigo-600 text-white shadow-xs",
      chipBg: "bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800",
      bubbleBorder: "border-indigo-200 dark:border-indigo-800",
    };
  };

  // Participant resolution
  const studentData = extractStudentInfo(activeConvDetail?.student || activeConv?.student);
  const teacherData = extractTeacherInfo(activeConvDetail?.teacher || activeConv?.teacher);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row h-[840px]">
      {/* 1. LEFT PANE: CONVERSATION LIST & FILTERS */}
      <div className="w-full md:w-88 lg:w-96 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/70 dark:bg-slate-900/60">
        {/* Header with Compose Button */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
          <div>
            <h2 className="font-extrabold text-base text-[#031635] dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">forum</span>
              <span>Communication Hub</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isAdmin ? "Monitor & manage all platform dialogues" : "Direct messages with students & staff"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedRecipient(null);
              setNewMsgText("");
              setIsNewModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition flex items-center gap-1.5 shrink-0 text-xs font-bold"
            title="Compose New Message"
          >
            <span className="material-symbols-outlined text-base">edit_square</span>
            <span>New</span>
          </button>
        </div>

        {/* Admin Tabs */}
        {isAdmin && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 p-1.5 gap-1 bg-slate-100/80 dark:bg-slate-800/80 text-[11px]">
            {[
              { id: "all", label: "All Threads" },
              { id: "teacher_student", label: "Teacher ↔ Student" },
              { id: "helpdesk", label: "Helpdesk" },
              { id: "staff_direct", label: "Staff Direct" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setAdminTab(t.id as any);
                  refreshConversations(t.id as any, searchQuery);
                }}
                className={`flex-1 py-1.5 px-1 rounded-lg font-bold transition text-center whitespace-nowrap truncate ${
                  adminTab === t.id
                    ? "bg-[#031635] text-white shadow-xs"
                    : "text-slate-600 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Search Filter */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search by student, teacher or keyword..."
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
            <div className="p-10 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 dark:text-slate-600">
                chat_bubble_outline
              </span>
              <p className="font-bold text-slate-600 dark:text-slate-400">No conversations found</p>
              <p className="text-[11px] text-slate-400 mt-1">Try switching tabs or clear search</p>
            </div>
          ) : (
            conversations.map((c) => {
              const active = c.id === activeConvId;

              // Derive badge and context based on conversation type
              const isTeacherStudent = c.type === "TEACHER_STUDENT";
              const isHelpdesk = c.type === "STUDENT_ADMIN";

              const typeBadge = isTeacherStudent
                ? { label: "Teacher ↔ Student", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" }
                : isHelpdesk
                ? { label: "Helpdesk Query", color: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" }
                : { label: "Staff Direct", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300" };

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left p-3.5 transition flex items-start gap-3 hover:bg-white dark:hover:bg-slate-800/80 ${
                    active
                      ? "bg-white dark:bg-slate-800 shadow-xs border-l-4 border-l-blue-600"
                      : "bg-transparent"
                  }`}
                >
                  {/* Left Avatar / Dual Icon */}
                  {isTeacherStudent ? (
                    <div className="relative w-10 h-10 shrink-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs">
                        {c.student?.name?.charAt(0).toUpperCase() || "S"}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center absolute -bottom-1 -right-1 border-2 border-white dark:border-slate-800 shadow-xs">
                        {c.teacher?.name?.charAt(0).toUpperCase() || "T"}
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {c.otherParticipant?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                        {c.title || c.otherParticipant?.name}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                        {c.lastMessage?.createdAt ? formatSidebarTime(c.lastMessage.createdAt) : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${typeBadge.color}`}>
                        {typeBadge.label}
                      </span>
                      {isTeacherStudent && c.teacher?.department && (
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                          {c.teacher.department}
                        </span>
                      )}
                      {isHelpdesk && c.student?.class && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {c.student.class}
                        </span>
                      )}
                    </div>

                    {/* Last message preview */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-1.5">
                      {c.lastMessage ? (
                        <>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {c.lastMessage.senderName || c.lastMessage.senderRole}:{" "}
                          </span>
                          <span>{c.lastMessage.body}</span>
                        </>
                      ) : (
                        <span className="text-slate-400 italic">No messages yet</span>
                      )}
                    </p>
                  </div>

                  {/* Unread Pill */}
                  {c.unreadCount > 0 && (
                    <span className="min-w-5 h-5 px-1 bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center rounded-full shrink-0 animate-pulse shadow-xs">
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
            {/* Detailed Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Conversation Title & Subtitle */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-[#031635] dark:text-white">
                      {activeConv.type === "TEACHER_STUDENT" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-indigo-700 dark:text-indigo-400 font-extrabold">
                            {studentData?.name || "Student"}
                          </span>
                          <span className="text-slate-400 font-normal">↔</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                            {teacherData?.name || "Teacher"}
                          </span>
                        </span>
                      ) : (
                        activeConv.title || activeConv.otherParticipant?.name
                      )}
                    </h3>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {activeConv.categoryLabel || activeConv.type.replace(/_/g, " ")}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeConv.subtitle}
                  </p>
                </div>

                {/* Participant Metadata Strip */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {studentData && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-indigo-600 text-sm">school</span>
                      <div className="text-[11px]">
                        <span className="font-bold text-indigo-950 dark:text-indigo-200">
                          {studentData.name}
                        </span>
                        {studentData.class && (
                          <span className="text-indigo-600 dark:text-indigo-400 ml-1">
                            ({studentData.class})
                          </span>
                        )}
                        {studentData.enrollmentNumber && (
                          <span className="text-slate-400 ml-1">
                            #{studentData.enrollmentNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {teacherData && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-600 text-sm">person</span>
                      <div className="text-[11px]">
                        <span className="font-bold text-emerald-950 dark:text-emerald-200">
                          {teacherData.name}
                        </span>
                        {teacherData.department && (
                          <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                            • {teacherData.department}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
              {loadingMessages ? (
                <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading full conversation thread...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-1">
                    chat
                  </span>
                  <p className="font-bold text-slate-600 dark:text-slate-400">No messages yet</p>
                  <p className="text-[11px] mt-1">Send a message below to start this conversation.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const roleConfig = getRoleBadge(m.senderRole);
                  const isTeacher = m.senderRole.toUpperCase() === "TEACHER";
                  const isStudent = m.senderRole.toUpperCase() === "STUDENT";
                  const isSenderAdmin =
                    m.senderRole.toUpperCase() === "ADMIN" ||
                    m.senderRole.toUpperCase() === "SUPER_ADMIN";

                  let alignmentClass = "items-start";
                  let cardBg = "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80";

                  if (isSenderAdmin) {
                    alignmentClass = "items-end";
                    cardBg = "bg-[#031635] text-white border border-blue-900 shadow-sm";
                  } else if (isTeacher) {
                    alignmentClass = "items-start md:ml-4";
                    cardBg = "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 border border-emerald-200/90 dark:border-emerald-800/60 shadow-xs";
                  } else if (isStudent) {
                    alignmentClass = "items-start";
                    cardBg = "bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 border border-indigo-200/90 dark:border-indigo-800/60 shadow-xs";
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${alignmentClass} group`}
                    >
                      {/* Sender & Recipient Dialogue Header */}
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        {/* Sender Name + Role */}
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {m.senderName}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase ${roleConfig.badgeBg}`}>
                          {roleConfig.label}
                        </span>

                        {/* Recipient Indicator */}
                        {m.recipientName && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span className="material-symbols-outlined text-xs">arrow_forward</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {m.recipientName}
                            </span>
                            {m.recipientRole && (
                              <span className="text-[9px] uppercase font-bold text-slate-400">
                                ({m.recipientRole})
                              </span>
                            )}
                          </span>
                        )}

                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-[10px] text-slate-400">
                          {formatMessageFullDateTime(m.createdAt)}
                        </span>
                      </div>

                      {/* Bubble Content */}
                      <div
                        className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-xs leading-relaxed break-words rounded-tl-sm ${cardBg}`}
                      >
                        <p className="whitespace-pre-wrap select-text">{m.body}</p>

                        {/* Status Footer */}
                        <div className="flex items-center justify-end gap-1.5 mt-2 pt-1 border-t border-black/5 dark:border-white/5 text-[10px]">
                          <span className="opacity-70">
                            {formatMessageTime(m.createdAt)}
                          </span>

                          {m.isRead || m.readAt ? (
                            <span className="flex items-center text-blue-500 font-bold gap-0.5" title="Read by recipient">
                              <span className="material-symbols-outlined text-sm">done_all</span>
                              <span className="text-[9px]">Read</span>
                            </span>
                          ) : (
                            <span className="flex items-center text-slate-400 gap-0.5" title="Delivered">
                              <span className="material-symbols-outlined text-sm">done</span>
                              <span className="text-[9px]">Delivered</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Admin Intervene / Direct Reply Bar */}
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              {/* Target Picker if conversation is between Teacher and Student */}
              {isAdmin && activeConv.type === "TEACHER_STUDENT" && (
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-400 text-[11px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-blue-600">reply</span>
                    <span>Admin Reply Target:</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAdminReplyTarget("STUDENT")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        adminReplyTarget === "STUDENT"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span>To Student</span>
                      <span className="text-[10px] opacity-80">
                        ({studentData?.name || "Student"})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminReplyTarget("TEACHER")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        adminReplyTarget === "TEACHER"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span>To Teacher</span>
                      <span className="text-[10px] opacity-80">
                        ({teacherData?.name || "Teacher"})
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Input Form */}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isAdmin
                      ? activeConv.type === "TEACHER_STUDENT"
                        ? `Send official reply as Admin to ${adminReplyTarget === "TEACHER" ? teacherData?.name || "Teacher" : studentData?.name || "Student"}...`
                        : "Send official reply as Admin..."
                      : "Type your message... (Press Enter to send)"
                  }
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
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-2 text-slate-300 dark:text-slate-600">
              chat
            </span>
            <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
              No Conversation Selected
            </h4>
            <p className="text-xs mt-1 max-w-sm">
              Pick a conversation from the left pane or click Compose to initiate a direct thread.
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

                <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
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
                            <p className="text-slate-900 dark:text-white font-semibold">{r.name}</p>
                            <p className="text-[10px] text-slate-400">{r.subtitle || r.email}</p>
                          </div>
                          {isSelected && (
                            <span className="material-symbols-outlined text-blue-600 text-sm">
                              check_circle
                            </span>
                          )}
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

            {/* Selected Recipient Preview */}
            {selectedRecipient && (
              <div className="px-3 py-2 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-600">Selected:</span>
                  <span className="ml-1.5 font-bold text-slate-900 dark:text-white">
                    {selectedRecipient.name}
                  </span>
                  <span className="ml-1 text-slate-500 text-[11px]">
                    ({selectedRecipient.subtitle || selectedRecipient.email})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
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
