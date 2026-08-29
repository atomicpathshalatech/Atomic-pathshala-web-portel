"use client";

import { AlertCircle, LogOut, Menu, RefreshCw, Settings, UserCircle } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChatInput,
  type ChatInputAttachment,
} from "@/components/ai-chat/ChatInput";
import { LanguageSelector } from "@/components/ai-chat/LanguageSelector";
import { Logo } from "@/components/ai-chat/Logo";
import { Sidebar } from "@/components/ai-chat/Sidebar";
import { ThemeToggle } from "@/components/ai-chat/ThemeToggle";
import { TypingIndicator } from "@/components/ai-chat/TypingIndicator";
import { WelcomeScreen } from "@/components/ai-chat/WelcomeScreen";
import {
  createChatTitle,
  chatsForServerSync,
  generateId,
  loadChats,
  mergeChats,
  saveChats,
} from "@/lib/ai-chat/storage";
import type {
  ChatAttachment,
  ChatMessage,
  ChatRequestBody,
  ChatSession,
  Language,
  StudentProfile,
} from "@/types/ai-chat";

const MessageBubble = dynamic(
  () => import("@/components/ai-chat/MessageBubble").then((module) => module.MessageBubble),
  {
    ssr: false,
    loading: () => <div className="h-24" />,
  }
);

interface FailedRequest {
  chatId: string;
  messages: ChatMessage[];
  language: Language;
  studentProfile: StudentProfile;
}

const DEFAULT_STUDENT_PROFILE: StudentProfile = {
  target: "NEET",
};

interface ChatAppProps {
  studentProfile?: StudentProfile;
  userName?: string;
  userEmail?: string;
  onSignOut?: () => void;
}

async function fileToBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      resolve({ base64, mimeType: file.type });
    };

    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function createNewChat(language: Language): ChatSession {
  const now = Date.now();

  return {
    id: generateId(),
    title: "New Doubt",
    messages: [],
    language,
    createdAt: now,
    updatedAt: now,
  };
}

function buildApiMessages(messages: ChatMessage[]): ChatRequestBody["messages"] {
  return messages.map((message) => {
    const attachments = message.attachments
      ?.filter((attachment) => Boolean(attachment.base64))
      .map((attachment) => ({
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        base64: attachment.base64,
        extractedText: attachment.extractedText,
      }));

    return {
      role: message.role,
      content: message.content,
      attachments,
      imageBase64: attachments?.length ? undefined : message.imageBase64,
      imageMimeType: attachments?.length ? undefined : message.imageMimeType,
    };
  });
}

function toMessageAttachments(
  inputAttachments: ChatInputAttachment[]
): ChatAttachment[] {
  return inputAttachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    base64: attachment.base64,
    url: attachment.previewUrl,
  }));
}

export function ChatApp({
  studentProfile,
  userName,
  userEmail,
  onSignOut,
}: ChatAppProps = {}) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("hinglish");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const syncedAccountRef = useRef<string | null>(null);

  // Source gated cloud sync on authBackend === "nextauth" (vs a local-only
  // "guest" backend). This route group is always a signed-in atomic-ops
  // user (guest mode was dropped per the auth-reuse decision), so this
  // just checks userEmail is present.
  const cloudSyncEnabled = Boolean(userEmail);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chats]
  );

  const effectiveStudentProfile = useMemo<StudentProfile>(
    () => ({
      ...DEFAULT_STUDENT_PROFILE,
      ...studentProfile,
      language: studentProfile?.language ?? language,
    }),
    [language, studentProfile]
  );

  const scrollSignal = useMemo(() => {
    const messages = activeChat?.messages ?? [];
    const lastMessage = messages[messages.length - 1];

    return [
      activeChat?.id ?? "",
      messages.length,
      lastMessage?.id ?? "",
      lastMessage?.content.length ?? 0,
      isLoading ? "loading" : "idle",
    ].join(":");
  }, [activeChat, isLoading]);

  useEffect(() => {
    const stored = loadChats();
    const sorted = [...stored].sort((a, b) => b.updatedAt - a.updatedAt);

    setChats(sorted);
    setActiveChatId(sorted[0]?.id ?? null);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveChats(chats);
  }, [chats, hydrated]);

  useEffect(() => {
    if (!cloudSyncEnabled) syncedAccountRef.current = null;
  }, [cloudSyncEnabled]);

  useEffect(() => {
    if (!hydrated || !cloudSyncEnabled || !userEmail) return;

    const accountKey = userEmail.toLowerCase();
    if (syncedAccountRef.current === accountKey) return;

    let cancelled = false;
    syncedAccountRef.current = accountKey;

    async function mergeCloudHistory() {
      try {
        const response = await fetch("/api/ai-chat/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chats: chatsForServerSync(chats) }),
        });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as { chats?: ChatSession[] };
        if (!data.chats || cancelled) return;

        setChats((current) => {
          return mergeChats(current, data.chats ?? []);
        });
      } catch {
        // Local history remains fully usable when cloud sync is unavailable.
      }
    }

    void mergeCloudHistory();
    return () => {
      cancelled = true;
    };
  }, [chats, cloudSyncEnabled, hydrated, userEmail]);

  useEffect(() => {
    if (!hydrated || !cloudSyncEnabled || !userEmail || isLoading) return;
    if (syncedAccountRef.current !== userEmail.toLowerCase()) return;

    const timer = window.setTimeout(() => {
      void fetch("/api/ai-chat/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chats: chatsForServerSync(chats) }),
      }).catch(() => {
        // A failed background sync must not interrupt the active study session.
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [chats, cloudSyncEnabled, hydrated, isLoading, userEmail]);

  useEffect(() => {
    if (activeChat) setLanguage(activeChat.language);
  }, [activeChat]);

  useEffect(() => {
    if (!activeChatId && chats.length > 0) setActiveChatId(chats[0]?.id ?? null);
  }, [activeChatId, chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scrollSignal]);

  const createChat = useCallback(() => {
    const newChat = createNewChat(language);

    setChats((current) => [newChat, ...current]);
    setActiveChatId(newChat.id);
    setError(null);
    setSidebarOpen(false);
  }, [language]);

  const deleteChat = useCallback(
    (id: string) => {
      setChats((current) => {
        const next = current.filter((chat) => chat.id !== id);
        if (activeChatId === id) {
          setActiveChatId(next[0]?.id ?? null);
        }
        return next;
      });

      if (cloudSyncEnabled) {
        void fetch(`/api/ai-chat/chats/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
          () => {
            // The local user action is retained and sync can be retried later.
          }
        );
      }
    },
    [activeChatId, cloudSyncEnabled]
  );

  const updateChatLanguage = useCallback(
    (nextLanguage: Language) => {
      setLanguage(nextLanguage);

      if (!activeChatId) return;

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChatId ? { ...chat, language: nextLanguage } : chat
        )
      );
    },
    [activeChatId]
  );

  const requestAssistant = useCallback(
    async (
      chatId: string,
      messages: ChatMessage[],
      requestLanguage: Language,
      requestProfile: StudentProfile
    ) => {
      const assistantId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      const controller = new AbortController();
      const decoder = new TextDecoder();
      let accumulated = "";

      abortControllerRef.current = controller;
      setIsLoading(true);
      setError(null);
      setFailedRequest(null);

      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...messages, assistantMessage],
                updatedAt: Date.now(),
              }
            : chat
        )
      );

      try {
        const response = await fetch("/api/ai-chat/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: buildApiMessages(messages),
            language: requestLanguage,
            stream: true,
            studentProfile: requestProfile,
          } satisfies ChatRequestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = `Request failed (${response.status}).`;

          try {
            const data = (await response.json()) as { error?: string };
            message = data.error ?? message;
          } catch {
            const fallback = await response.text();
            if (fallback.trim()) message = fallback;
          }

          throw new Error(message);
        }

        if (!response.body) {
          throw new Error("Server did not return a streaming response.");
        }

        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += decoder.decode(value, { stream: true });

          setChats((current) =>
            current.map((chat) =>
              chat.id === chatId
                ? {
                    ...chat,
                    messages: chat.messages.map((message) =>
                      message.id === assistantId
                        ? { ...message, content: accumulated }
                        : message
                    ),
                    updatedAt: Date.now(),
                  }
                : chat
            )
          );
        }

        accumulated += decoder.decode();

        if (!accumulated.trim()) {
          throw new Error("Received an empty response from AI.");
        }
      } catch (caughtError) {
        if (isAbortError(caughtError)) {
          if (!accumulated.trim()) {
            setChats((current) =>
              current.map((chat) =>
                chat.id === chatId
                  ? {
                      ...chat,
                      messages: chat.messages.filter(
                        (message) => message.id !== assistantId
                      ),
                    }
                  : chat
              )
            );
          }
          return;
        }

        setChats((current) =>
          current.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.filter(
                    (message) => message.id !== assistantId
                  ),
                }
              : chat
          )
        );

        setFailedRequest({
          chatId,
          messages,
          language: requestLanguage,
          studentProfile: requestProfile,
        });
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Something went wrong."
        );
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (
      text: string,
      imageFile?: File,
      inputAttachments: ChatInputAttachment[] = []
    ) => {
      if (isLoading) return;

      setError(null);

      let outgoingAttachments = toMessageAttachments(inputAttachments);

      if (outgoingAttachments.length === 0 && imageFile) {
        const converted = await fileToBase64(imageFile);
        outgoingAttachments = [
          {
            id: generateId(),
            kind: "image",
            name: imageFile.name || "image",
            mimeType: converted.mimeType,
            size: imageFile.size,
            base64: converted.base64,
            url: URL.createObjectURL(imageFile),
          },
        ];
      }

      if (!text.trim() && outgoingAttachments.length === 0) return;

      let currentChats = chats;
      let chatId = activeChatId;

      if (!chatId) {
        const newChat = createNewChat(language);
        currentChats = [newChat, ...chats];
        chatId = newChat.id;
        setChats(currentChats);
        setActiveChatId(chatId);
      }

      const chat = currentChats.find((item) => item.id === chatId);
      if (!chat) return;

      const firstImage = outgoingAttachments.find(
        (attachment) => attachment.kind === "image"
      );
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        attachments: outgoingAttachments,
        imageUrl: firstImage?.url,
        imageBase64: firstImage?.base64,
        imageMimeType: firstImage?.mimeType,
        timestamp: Date.now(),
      };
      const updatedMessages = [...chat.messages, userMessage];
      const titleSource =
        text ||
        outgoingAttachments.map((attachment) => attachment.name).join(", ") ||
        "New Doubt";
      const title =
        chat.messages.length === 0 ? createChatTitle(titleSource) : chat.title;

      setChats((current) =>
        current.map((item) =>
          item.id === chatId
            ? {
                ...item,
                title,
                messages: updatedMessages,
                language,
                updatedAt: Date.now(),
              }
            : item
        )
      );

      await requestAssistant(
        chatId,
        updatedMessages,
        language,
        effectiveStudentProfile
      );
    },
    [
      activeChatId,
      chats,
      effectiveStudentProfile,
      isLoading,
      language,
      requestAssistant,
    ]
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const retryFailedRequest = useCallback(() => {
    if (!failedRequest || isLoading) return;
    void requestAssistant(
      failedRequest.chatId,
      failedRequest.messages,
      failedRequest.language,
      failedRequest.studentProfile
    );
  }, [failedRequest, isLoading, requestAssistant]);

  const regenerateFromAssistant = useCallback(
    (messageId: string) => {
      if (!activeChat || isLoading) return;

      const assistantIndex = activeChat.messages.findIndex(
        (message) => message.id === messageId && message.role === "assistant"
      );
      if (assistantIndex <= 0) return;

      const previousMessages = activeChat.messages.slice(0, assistantIndex);
      const previousUser = [...previousMessages]
        .reverse()
        .find((message) => message.role === "user");
      if (!previousUser) return;

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages: previousMessages,
                updatedAt: Date.now(),
              }
            : chat
        )
      );

      void requestAssistant(
        activeChat.id,
        previousMessages,
        activeChat.language,
        effectiveStudentProfile
      );
    },
    [activeChat, effectiveStudentProfile, isLoading, requestAssistant]
  );

  const retryFromUser = useCallback(
    (messageId: string) => {
      if (!activeChat || isLoading) return;

      const userIndex = activeChat.messages.findIndex(
        (message) => message.id === messageId && message.role === "user"
      );
      if (userIndex < 0) return;

      const messages = activeChat.messages.slice(0, userIndex + 1);

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? { ...chat, messages, updatedAt: Date.now() }
            : chat
        )
      );

      void requestAssistant(
        activeChat.id,
        messages,
        activeChat.language,
        effectiveStudentProfile
      );
    },
    [activeChat, effectiveStudentProfile, isLoading, requestAssistant]
  );

  const editUserMessage = useCallback(
    (messageId: string, nextContent: string) => {
      if (!activeChat || isLoading) return;

      const messageIndex = activeChat.messages.findIndex(
        (message) => message.id === messageId && message.role === "user"
      );
      if (messageIndex < 0) return;

      const original = activeChat.messages[messageIndex];
      if (!original) return;

      const trimmed = nextContent.trim();
      if (!trimmed && !original.attachments?.length && !original.imageBase64) return;

      const editedMessage: ChatMessage = {
        ...original,
        content: trimmed,
        editedAt: Date.now(),
      };
      const messages = [
        ...activeChat.messages.slice(0, messageIndex),
        editedMessage,
      ];

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages,
                title:
                  messageIndex === 0
                    ? createChatTitle(trimmed || chat.title)
                    : chat.title,
                updatedAt: Date.now(),
              }
            : chat
        )
      );

      void requestAssistant(
        activeChat.id,
        messages,
        activeChat.language,
        effectiveStudentProfile
      );
    },
    [activeChat, effectiveStudentProfile, isLoading, requestAssistant]
  );

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white dark:bg-atomic-navy">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-atomic-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-atomic-navy">
      <div className="hidden w-72 shrink-0 border-r border-slate-200 dark:border-slate-700 lg:block">
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onNewChat={createChat}
          onSelectChat={(id) => {
            setActiveChatId(id);
            setError(null);
          }}
          onDeleteChat={deleteChat}
          onOpenQuiz={() => router.push("/quiz")}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <Sidebar
              chats={chats}
              activeChatId={activeChatId}
              onNewChat={createChat}
              onSelectChat={(id) => {
                setActiveChatId(id);
                setError(null);
                setSidebarOpen(false);
              }}
              onDeleteChat={deleteChat}
              onClose={() => setSidebarOpen(false)}
              onOpenQuiz={() => {
                router.push("/quiz");
                setSidebarOpen(false);
              }}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-700 sm:px-4">
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <h2 className="hidden text-sm font-semibold text-slate-700 dark:text-slate-200 lg:block">
              {activeChat?.title ?? "New Doubt"}
            </h2>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto sm:gap-3">
            <LanguageSelector
              value={language}
              onChange={updateChatLanguage}
              disabled={isLoading}
            />
            {userEmail && (
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:flex">
                <UserCircle className="h-4 w-4 text-atomic-orange" />
                <div className="min-w-0">
                  <p className="max-w-32 truncate font-medium text-slate-800 dark:text-slate-100">
                    {userName || userEmail}
                  </p>
              
                </div>
              </div>
            )}
                        {userEmail ? (
              <Link
                href="/guru/settings"
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-atomic-orange dark:hover:bg-slate-800"
                aria-label="Open settings"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            ) : null}
            <div className="shrink-0">
              <ThemeToggle />
            </div>
             {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/20 dark:hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            )}
          </div>
        </header>

        <main className="flex flex-1 flex-col overflow-hidden">
          {!activeChat || activeChat.messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={(value) => void sendMessage(value)} />
          ) : (
            <div className="flex-1 space-y-6 overflow-y-auto px-3 py-6 sm:px-6">
              {activeChat.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  disabled={isLoading}
                  onEdit={editUserMessage}
                  onRegenerate={regenerateFromAssistant}
                  onRetry={retryFromUser}
                />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}

          {error && (
            <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:mx-4">
              <div className="flex min-w-0 items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="min-w-0">{error}</span>
              </div>
              {failedRequest && (
                <button
                  type="button"
                  onClick={retryFailedRequest}
                  disabled={isLoading}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-red-100 disabled:opacity-50 dark:hover:bg-red-900/30"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
            </div>
          )}

          <ChatInput
            onSend={sendMessage}
            disabled={isLoading}
            isGenerating={isLoading}
            onStop={stopGeneration}
            language={language}
            placeholder={
              language === "hindi"
                ? "अपना सवाल यहां लिखें..."
                : language === "hinglish"
                  ? "Apna doubt yahan likho..."
                  : "Ask your doubt here..."
            }
          />
        </main>
      </div>
    </div>
  );
}
