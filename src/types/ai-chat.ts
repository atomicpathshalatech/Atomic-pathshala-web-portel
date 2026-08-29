// Ported as-is from _import_atomic-ai-chat/src/types/chat.ts — no schema
// dependency, no changes needed beyond the file location.

export type Language = "english" | "hindi" | "hinglish";

export type MessageRole = "user" | "assistant";

export type AttachmentKind = "image" | "pdf";

export interface ChatAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  base64?: string;
  extractedText?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: ChatAttachment[];
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  timestamp: number;
  editedAt?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  language: Language;
  createdAt: number;
  updatedAt: number;
}

export interface StudentProfile {
  name?: string;
  className?: string;
  target?: "NEET" | "JEE" | "Board" | "Other";
  board?: string;
  language?: Language;
  atomicBatch?: "SELECTION_PRO" | "SELECTION_1_0" | "ARAMBH" | "MANZIL" | "UDAAN" | "NO_BATCH";
}

export interface ChatRequestAttachment {
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  base64?: string;
  extractedText?: string;
}

export interface ChatRequestBody {
  messages: Array<{
    role: MessageRole;
    content: string;
    attachments?: ChatRequestAttachment[];
    imageBase64?: string;
    imageMimeType?: string;
  }>;
  language: Language;
  stream?: boolean;
  studentProfile?: StudentProfile;
}
