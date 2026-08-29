"use client";

import {
  Bot,
  Check,
  Copy,
  Edit3,
  Flag,
  FileText,
  RefreshCw,
  RotateCcw,
  User,
} from "lucide-react";
import Image from "next/image";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { copyMarkdownAsRichText } from "@/lib/ai-chat/clipboard";
import { QuizTimer } from "@/components/ai-chat/QuizTimer";
import {
  containsDevanagari,
  getQuizTimerSeconds,
  stripQuizTimerDirective,
} from "@/lib/ai-chat/quiz";
import type { ChatAttachment, ChatMessage } from "@/types/ai-chat";

import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";

interface MessageBubbleProps {
  message: ChatMessage;
  disabled?: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
}

function sanitizeSvg(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<svg") || typeof window === "undefined") return null;

  const clean = DOMPurify.sanitize(trimmed, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["svg"],
  });

  return clean.includes("<svg") ? clean : null;
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function AttachmentPreview({
  attachment,
  isUser,
}: {
  attachment: ChatAttachment;
  isUser: boolean;
}) {
  if (attachment.kind === "image" && attachment.url) {
    return (
      <button
        type="button"
        onClick={() => window.open(attachment.url, "_blank")}
        className={`overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 ${
          isUser ? "ml-auto" : ""
        }`}
        title={attachment.name}
      >
        <Image
          src={attachment.url}
          alt={attachment.name}
          width={320}
          height={240}
          className="max-h-60 w-auto object-contain"
          unoptimized
        />
      </button>
    );
  }

  if (attachment.kind === "pdf") {
    return (
      <button
        type="button"
        onClick={() => attachment.url && window.open(attachment.url, "_blank")}
        className={`flex max-w-xs items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 ${
          isUser ? "ml-auto" : ""
        }`}
        title={attachment.name}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{attachment.name}</span>
      </button>
    );
  }

  return null;
}

function MessageBubbleComponent({
  message,
  disabled = false,
  onEdit,
  onRegenerate,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const attachments = message.attachments ?? [];
  const quizTimerSeconds = isUser ? null : getQuizTimerSeconds(message.content);
  const displayContent = stripQuizTimerDirective(message.content);
  const hasHindiText = containsDevanagari(displayContent);
  const hasAttachmentImages = attachments.some(
    (attachment) => attachment.kind === "image"
  );

  const handleCopy = async () => {
    await copyMarkdownAsRichText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const handleReport = async () => {
    if (reported) return;
    try {
      await fetch("/api/ai-chat/report-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: message.content }),
      });
    } catch {
      // best-effort; don't block the UI on failure
    } finally {
      setReported(true);
      window.setTimeout(() => setReported(false), 3000);
    }
  };

  const handleSaveEdit = () => {
    onEdit?.(message.id, draft);
    setIsEditing(false);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-atomic-orange text-white"
            : "bg-atomic-blue text-white dark:bg-atomic-blue-light"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={`flex max-w-[88%] flex-col gap-2 sm:max-w-[76%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {attachments.map((attachment) => (
          <AttachmentPreview
            key={attachment.id}
            attachment={attachment}
            isUser={isUser}
          />
        ))}

        {!hasAttachmentImages && message.imageUrl && (
          <AttachmentPreview
            attachment={{
              id: `${message.id}-legacy-image`,
              kind: "image",
              name: "Uploaded doubt",
              mimeType: message.imageMimeType ?? "image/jpeg",
              size: 0,
              url: message.imageUrl,
            }}
            isUser={isUser}
          />
        )}

        {(message.content || isEditing) && (
          <div
            lang={hasHindiText ? "hi" : undefined}
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? "message-user rounded-tr-sm"
                : "message-assistant rounded-tl-sm"
            } ${hasHindiText ? "font-hindi" : ""}`}
          >
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-atomic-orange focus:ring-2 focus:ring-atomic-orange/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(message.content);
                      setIsEditing(false);
                    }}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={disabled}
                    className="rounded-lg bg-atomic-orange px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {quizTimerSeconds && <div className="mb-3"><QuizTimer initialSeconds={quizTimerSeconds} /></div>}
                <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                skipHtml
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-4 mt-4 text-2xl font-bold text-orange-600">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-3 mt-4 text-xl font-semibold text-orange-500">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-2 mt-3 text-lg font-semibold">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 leading-8 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-3 list-disc space-y-2 pl-6">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-3 list-decimal space-y-2 pl-6">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="leading-7">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-bold text-orange-600">
                      {children}
                    </strong>
                  ),
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full border-collapse text-left">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-slate-200 bg-slate-100 px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-slate-700">
                      {children}
                    </td>
                  ),
                  code({ children, className }) {
                    if (className === "language-svg") {
                      const raw = String(children);
                      const clean = sanitizeSvg(raw);

                      if (clean) {
                        return (
                          <span
                            className="my-3 block overflow-hidden rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-white [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
                            dangerouslySetInnerHTML={{ __html: clean }}
                          />
                        );
                      }
                    }

                    return className ? (
                      <code className={className}>{children}</code>
                    ) : (
                      <code className="rounded bg-slate-100 px-1 py-0.5 text-red-600 dark:bg-slate-800 dark:text-red-300">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-white">
                      {children}
                    </pre>
                  ),
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-atomic-blue underline underline-offset-2 dark:text-blue-300"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {displayContent}
                </ReactMarkdown>
              </>
            )}
          </div>
        )}

        <div
          className={`flex flex-wrap items-center gap-1 text-xs text-slate-400 ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <span>
            {formatTimestamp(message.timestamp)}
            {message.editedAt ? " · edited" : ""}
          </span>

          {message.content && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Copy"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {isUser && onEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Edit"
              aria-label="Edit message"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}

          {isUser && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              disabled={disabled}
              className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Retry"
              aria-label="Retry from this message"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          {!isUser && onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(message.id)}
              disabled={disabled}
              className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Regenerate"
              aria-label="Regenerate response"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}

          {!isUser && message.content && (
            <button
              type="button"
              onClick={() => void handleReport()}
              disabled={reported}
              className="rounded-md p-1 hover:bg-slate-100 hover:text-red-600 disabled:opacity-60 dark:hover:bg-slate-800 dark:hover:text-red-400"
              title={reported ? "Reported - thank you" : "Report wrong answer"}
              aria-label="Report wrong answer"
            >
              <Flag className={`h-3.5 w-3.5 ${reported ? "fill-red-500 text-red-500" : ""}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);
