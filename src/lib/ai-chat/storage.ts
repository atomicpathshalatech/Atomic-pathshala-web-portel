import type { ChatSession } from "@/types/ai-chat";

const STORAGE_KEY = "atomic-pathshala-chats";

export function loadChats(): ChatSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChats(chats: ChatSession[]): void {
  if (typeof window === "undefined") return;

  const stripped = chats.map((chat) => ({
    ...chat,
    messages: chat.messages.map((message) => ({
      ...message,
      imageBase64: undefined,
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        base64: undefined,
      })),
    })),
  }));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
}

export function chatsForServerSync(chats: ChatSession[]): ChatSession[] {
  return chats.map((chat) => ({
    ...chat,
    messages: chat.messages.map((message) => ({
      ...message,
      imageUrl: undefined,
      imageBase64: undefined,
      imageMimeType: undefined,
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        url: attachment.url?.startsWith("https://") ? attachment.url : undefined,
        base64: undefined,
      })),
    })),
  }));
}

export function mergeChats(
  localChats: ChatSession[],
  serverChats: ChatSession[]
): ChatSession[] {
  const chatsById = new Map(localChats.map((chat) => [chat.id, chat]));

  for (const serverChat of serverChats) {
    const localChat = chatsById.get(serverChat.id);
    if (!localChat) {
      chatsById.set(serverChat.id, serverChat);
      continue;
    }

    const messagesById = new Map(localChat.messages.map((message) => [message.id, message]));
    for (const serverMessage of serverChat.messages) {
      const localMessage = messagesById.get(serverMessage.id);
      const serverIsNewer =
        !localMessage ||
        (serverMessage.editedAt ?? serverMessage.timestamp) >=
          (localMessage.editedAt ?? localMessage.timestamp);

      messagesById.set(
        serverMessage.id,
        serverIsNewer
          ? { ...localMessage, ...serverMessage }
          : localMessage
      );
    }

    const serverIsNewer = serverChat.updatedAt >= localChat.updatedAt;
    chatsById.set(serverChat.id, {
      ...(serverIsNewer ? localChat : serverChat),
      ...(serverIsNewer ? serverChat : localChat),
      messages: [...messagesById.values()].sort((a, b) => a.timestamp - b.timestamp),
      updatedAt: Math.max(localChat.updatedAt, serverChat.updatedAt),
    });
  }

  return [...chatsById.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createChatTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New Doubt";
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}...` : cleaned;
}
