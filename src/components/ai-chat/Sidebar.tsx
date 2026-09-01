"use client";

import { Logo } from "@/components/ai-chat/Logo";
import Link from "next/link";
import type { ChatSession } from "@/types/ai-chat";
import { ClipboardList, CalendarDays, LayoutDashboard, MessageSquarePlus, BookOpenCheck, PanelLeftClose, Trash2, Library } from "lucide-react";
import { useAiChatUser } from "@/components/ai-chat/AiChatUserContext";

interface SidebarProps {
  chats: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onClose?: () => void;
  onOpenQuiz?: () => void;
}

export function Sidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onClose,
  onOpenQuiz,
}: SidebarProps) {
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const { user } = useAiChatUser();
  // Source: user?.role === "ADMIN" || user?.role === "FACULTY". Real
  // equivalent is the AICHAT_QUESTION_BANK_VIEW permission flag.
  const canViewQuestionBank = user.isQuestionBankViewer;

  return (
    <aside className="flex h-full w-full flex-col bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
        <Logo />
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-atomic-orange/50 bg-white px-4 py-3 text-sm font-medium text-atomic-orange transition-all hover:border-atomic-orange hover:bg-orange-50 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Doubt
        </button>

        {/* Class Schedule */}
        <Link
          href="/guru/schedule"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700 transition-all hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30"
        >
          <CalendarDays className="h-4 w-4" />
          Class Schedule
        </Link>

                <Link
          href="/guru/dashboard"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>

        {canViewQuestionBank && (
          <Link
            href="/guru/admin/question-bank"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Library className="h-4 w-4" />
            Question Bank
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {sortedChats.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            No chat history yet. Ask your first doubt!
          </p>
        ) : (
          <ul className="space-y-1">
            {sortedChats.map((chat) => (
              <li key={chat.id}>
                <div
                  className={`group flex items-center gap-1 rounded-xl transition-colors ${
                    activeChatId === chat.id
                      ? "bg-atomic-orange/10 dark:bg-atomic-orange/20"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left"
                  >
                    <p
                      className={`truncate text-sm font-medium ${
                        activeChatId === chat.id
                          ? "text-atomic-orange"
                          : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {chat.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                      {new Date(chat.updatedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                      {" - "}
                      {chat.messages.length} msg
                    </p>
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="mr-2 rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 dark:border-slate-700">
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          (c) Atomic Pathshala 2026
        </p>
      </div>
    </aside>
  );
}
