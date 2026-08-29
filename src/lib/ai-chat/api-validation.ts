import { ChatApiError } from "@/lib/ai-chat/errors";
import type {
  AttachmentKind,
  ChatRequestAttachment,
  ChatRequestBody,
  Language,
} from "@/types/ai-chat";

const VALID_LANGUAGES: Language[] = ["english", "hindi", "hinglish"];
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VALID_PDF_TYPES = ["application/pdf"];
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 20000;
const MAX_ATTACHMENTS_PER_MESSAGE = 8;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

type RequestMessage = ChatRequestBody["messages"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function estimateBase64Bytes(value: string) {
  return Math.ceil((value.length * 3) / 4);
}

function validateAttachment(raw: unknown): ChatRequestAttachment {
  if (!isRecord(raw)) {
    throw new ChatApiError("Invalid attachment.", 400);
  }

  const { kind, name, mimeType, size, base64, extractedText } = raw;

  if (kind !== "image" && kind !== "pdf") {
    throw new ChatApiError("Invalid attachment type.", 400);
  }

  if (typeof name !== "string" || !name.trim()) {
    throw new ChatApiError("Attachment name is required.", 400);
  }

  if (typeof mimeType !== "string" || !mimeType.trim()) {
    throw new ChatApiError("Attachment MIME type is required.", 400);
  }

  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
    throw new ChatApiError("Attachment size is invalid.", 400);
  }

  const supportedMimeTypes =
    kind === "image" ? VALID_IMAGE_TYPES : VALID_PDF_TYPES;

  if (!supportedMimeTypes.includes(mimeType)) {
    throw new ChatApiError(
      kind === "image"
        ? "Unsupported image type. Use JPEG, PNG, WebP, or GIF."
        : "Unsupported PDF type.",
      400
    );
  }

  if (base64 !== undefined && typeof base64 !== "string") {
    throw new ChatApiError("Attachment data is invalid.", 400);
  }

  const estimatedBytes =
    typeof base64 === "string" ? estimateBase64Bytes(base64) : size;
  const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;

  if (estimatedBytes > maxBytes || size > maxBytes) {
    throw new ChatApiError(
      `${kind === "image" ? "Image" : "PDF"} is too large.`,
      400
    );
  }

  if (extractedText !== undefined && typeof extractedText !== "string") {
    throw new ChatApiError("Extracted PDF text is invalid.", 400);
  }

  return {
    kind: kind as AttachmentKind,
    name: name.trim(),
    mimeType,
    size,
    base64,
    extractedText,
  };
}

export function validateChatRequest(body: unknown): ChatRequestBody {
  if (!isRecord(body)) {
    throw new ChatApiError("Invalid request body.", 400);
  }

  const { messages, language, stream, studentProfile } = body;

  if (!VALID_LANGUAGES.includes(language as Language)) {
    throw new ChatApiError("Invalid language. Use english, hindi, or hinglish.", 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ChatApiError("No messages provided.", 400);
  }

  if (messages.length > MAX_MESSAGES) {
    throw new ChatApiError("Too many messages in conversation.", 400);
  }

  const lastMessage = messages[messages.length - 1];
  if (!isRecord(lastMessage) || lastMessage.role !== "user") {
    throw new ChatApiError("Last message must be from the user.", 400);
  }

  const validatedMessages: RequestMessage[] = messages.map((rawMessage, index) => {
    if (!isRecord(rawMessage)) {
      throw new ChatApiError("Invalid message.", 400);
    }

    const { role, content, imageBase64, imageMimeType, attachments } = rawMessage;

    if (role !== "user" && role !== "assistant") {
      throw new ChatApiError("Invalid message role.", 400);
    }

    if (typeof content !== "string") {
      throw new ChatApiError("Message content must be a string.", 400);
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      throw new ChatApiError("Message is too long.", 400);
    }

    let validatedAttachments: ChatRequestAttachment[] | undefined;
    if (attachments !== undefined) {
      if (!Array.isArray(attachments)) {
        throw new ChatApiError("Attachments must be an array.", 400);
      }

      if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        throw new ChatApiError("Too many attachments.", 400);
      }

      validatedAttachments = attachments.map(validateAttachment);
    }

    if (imageBase64 !== undefined) {
      if (typeof imageBase64 !== "string") {
        throw new ChatApiError("Image data is invalid.", 400);
      }

      if (
        typeof imageMimeType !== "string" ||
        !VALID_IMAGE_TYPES.includes(imageMimeType)
      ) {
        throw new ChatApiError("Unsupported image type. Use JPEG, PNG, WebP, or GIF.", 400);
      }

      if (estimateBase64Bytes(imageBase64) > MAX_IMAGE_BYTES) {
        throw new ChatApiError("Image is too large.", 400);
      }
    }

    if (index === messages.length - 1 && role === "user") {
      const hasAttachment = Boolean(
        validatedAttachments?.some(
          (attachment) => attachment.base64 || attachment.extractedText
        )
      );

      if (!content.trim() && !imageBase64 && !hasAttachment) {
        throw new ChatApiError("Message must include text, an image, or a PDF.", 400);
      }
    }

    return {
      role,
      content,
      attachments: validatedAttachments,
      imageBase64:
        typeof imageBase64 === "string" ? imageBase64 : undefined,
      imageMimeType:
        typeof imageMimeType === "string" ? imageMimeType : undefined,
    };
  });

  return {
    messages: validatedMessages,
    language: language as Language,
    stream: stream === true,
    studentProfile: isRecord(studentProfile) ? studentProfile : undefined,
  };
}
