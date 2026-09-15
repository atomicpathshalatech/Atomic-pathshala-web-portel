"use client";

import React, { useState, useEffect, useRef } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { directConversationChannel, DIRECT_MESSAGE_EVENTS } from "@/lib/realtime/events";

interface FollowButtonProps {
  teacherId: string;
  initialFollowerCount: number;
  initialFollowing?: boolean;
}

export function TeacherFollowButton({
  teacherId,
  initialFollowerCount,
  initialFollowing = false,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [loading, setLoading] = useState(false);

  // Sync state if user is authenticated
  useEffect(() => {
    let isMounted = true;
    async function checkFollowState() {
      try {
        const res = await fetch(`/api/teachers/${teacherId}/follow`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setFollowerCount(data.data.followerCount);
            setFollowing(Boolean(data.data.following));
          }
        }
      } catch {
        // Guest or offline fallback
      }
    }
    checkFollowState();
    return () => {
      isMounted = false;
    };
  }, [teacherId]);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const nextState = !following;
    setFollowing(nextState);
    setFollowerCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/teachers/${teacherId}/follow`, {
        method: nextState ? "POST" : "DELETE",
      });

      if (!res.ok) {
        if (res.status === 401) {
          alert("Please sign in as a student to follow this educator.");
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        // Rollback on server failure
        setFollowing(!nextState);
        setFollowerCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
        return;
      }

      const data = await res.json();
      if (data.success) {
        setFollowerCount(data.data.followerCount);
        setFollowing(data.data.following);
      }
    } catch {
      // Rollback
      setFollowing(!nextState);
      setFollowerCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${
        following
          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200"
          : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
      }`}
    >
      <span className="material-symbols-outlined text-sm">
        {following ? "check" : "add"}
      </span>
      <span>{following ? "Following" : "Follow"}</span>
      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-black/10 dark:bg-white/10 ml-0.5">
        {followerCount >= 1000
          ? `${(followerCount / 1000).toFixed(1)}k`
          : followerCount}
      </span>
    </button>
  );
}

interface MessageButtonAndModalProps {
  teacherId: string;
  teacherName: string;
  teacherPhoto: string | null;
  teacherSubject: string;
}

interface DirectMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

export function TeacherMessageButtonAndModal({
  teacherId,
  teacherName,
  teacherPhoto,
  teacherSubject,
}: MessageButtonAndModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Open modal and load existing conversation
  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/teachers/${teacherId}/messages`);
      if (!res.ok) {
        if (res.status === 401) {
          alert("Please sign in as a student to message this educator.");
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          setIsOpen(false);
          return;
        }
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || "Failed to load conversation.");
        return;
      }

      const data = await res.json();
      if (data.success) {
        setConversationId(data.data.conversationId);
        setMessages(data.data.messages || []);
        if (data.data.student?.user?.id) {
          setCurrentUserId(data.data.student.user.id);
        }
      }
    } catch {
      setErrorMessage("Network error connecting to educator direct messaging.");
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to realtime Pusher updates
  useEffect(() => {
    if (!conversationId || !isOpen) return;

    try {
      const pusher = getPusherClient();
      const channelName = directConversationChannel(conversationId);
      const channel = pusher.subscribe(channelName);

      channel.bind(DIRECT_MESSAGE_EVENTS.NEW_MESSAGE, (newMsg: DirectMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      });

      return () => {
        pusher.unsubscribe(channelName);
      };
    } catch (err) {
      console.warn("Pusher client direct message binding error:", err);
    }
  }, [conversationId, isOpen]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await fetch(`/api/teachers/${teacherId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: textToSend,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to deliver message.");
        setInputText(textToSend); // Restore
        return;
      }

      const data = await res.json();
      if (data.success && data.data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.data.message.id)) return prev;
          return [...prev, data.data.message];
        });
      }
    } catch {
      alert("Network error sending message.");
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 text-xs font-bold transition-all active:scale-95 shadow-sm"
      >
        <span className="material-symbols-outlined text-sm">chat_bubble</span>
        <span>Send Message</span>
      </button>

      {/* Direct Messaging Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111625] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-[600px] max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm overflow-hidden shrink-0">
                  {teacherPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={teacherPhoto} alt={teacherName} className="w-full h-full object-cover" />
                  ) : (
                    teacherName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                    {teacherName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{teacherSubject}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Direct Query
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Safety & Moderation Notice */}
            <div className="px-4 py-2.5 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex items-start gap-2 text-[11px] text-blue-900 dark:text-blue-200">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-sm shrink-0 mt-0.5">
                verified_user
              </span>
              <p className="leading-snug">
                <strong className="font-bold">Student Safety &amp; Academic Support:</strong> Messages are monitored and audited by Atomic Pathshala Administration in compliance with our student safety policy.
              </p>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-xl text-blue-600 mr-2">
                    progress_activity
                  </span>
                  Connecting to educator...
                </div>
              ) : errorMessage ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-300">
                  {errorMessage}
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">chat</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ask {teacherName} a question
                  </p>
                  <p className="text-[11px] max-w-xs text-slate-500">
                    Send your academic queries, syllabus guidance, or class doubt questions directly.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderRole === "STUDENT" || (currentUserId && msg.senderUserId === currentUserId);
                  const isTeacher = msg.senderRole === "TEACHER";
                  const isAdminRole = msg.senderRole === "ADMIN";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 px-1 mb-0.5">
                        <span>
                          {isMe ? "You" : isTeacher ? teacherName : "Administration"}
                        </span>
                        {isAdminRole && (
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1 rounded font-bold">
                            Support
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </div>
                      <div
                        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : isTeacher
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200/80 dark:border-slate-700"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-tl-none border border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {msg.body}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-2"
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`Message ${teacherName}...`}
                rows={1}
                className="flex-1 resize-none bg-white dark:bg-[#151c2e] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />

              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center active:scale-95 transition-all shrink-0 shadow-sm shadow-blue-600/20"
              >
                <span className="material-symbols-outlined text-base">send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

interface WriteTestimonialProps {
  teacherId: string;
  teacherName: string;
}

export function WriteTestimonialButtonAndModal({
  teacherId,
  teacherName,
}: WriteTestimonialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, content: content.trim() }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          alert("Please sign in as a student to write a review.");
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to submit review.");
        return;
      }

      setSubmittedMessage(
        "Thank you! Your feedback has been submitted and will be displayed once verified by our academic moderation team."
      );
    } catch {
      alert("Network error submitting review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setSubmittedMessage(null);
          setContent("");
          setRating(5);
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-600/80 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-sm">rate_review</span>
        <span>Write a Review</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111625] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Review &amp; Feedback
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Share your genuine learning experience with {teacherName}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {submittedMessage ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-2">
                <span className="material-symbols-outlined text-3xl text-emerald-600 dark:text-emerald-400">
                  check_circle
                </span>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  {submittedMessage}
                </p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="mt-2 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Interactive Star Rating */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Rating (1 to 5 Stars)
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="p-1 text-slate-300 dark:text-slate-700 hover:scale-110 transition-transform"
                        >
                          <span
                            className={`material-symbols-outlined text-2xl ${
                              active ? "text-amber-400" : ""
                            }`}
                          >
                            star
                          </span>
                        </button>
                      );
                    })}
                    <span className="ml-2 text-xs font-bold text-amber-500">
                      {hoverRating || rating} / 5
                    </span>
                  </div>
                </div>

                {/* Review Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Your Review &amp; Comments
                  </label>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="How does this educator explain topics? What helped you the most in your exam preparation?"
                    required
                    minLength={5}
                    maxLength={1000}
                    className="w-full bg-slate-50 dark:bg-[#151c2e] border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Authentic feedback only</span>
                    <span>{content.length}/1000</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || content.trim().length < 5}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-95"
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
