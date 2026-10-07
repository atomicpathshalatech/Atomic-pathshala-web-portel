export interface MetaParsedMessage {
  wamId: string;
  fromPhone: string;
  senderName?: string;
  timestamp: Date;
  type: string;
  bodyText?: string;
  contextWamId?: string;
  mediaUrl?: string;
  mimeType?: string;
  mediaId?: string;
  buttonPayload?: string;
  raw: any;
}

export interface MetaParsedStatus {
  wamId: string;
  recipientPhone: string;
  status: "sent" | "delivered" | "read" | "failed" | "unknown";
  timestamp: Date;
  errorCode?: number;
  errorMessage?: string;
  raw: any;
}

export interface MetaParsedWebhookEvent {
  isWhatsApp: boolean;
  businessAccountId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  messages: MetaParsedMessage[];
  statuses: MetaParsedStatus[];
  rawPayload: any;
}

/**
 * Parses raw JSON payload from Meta WhatsApp Cloud API webhook.
 * Gracefully extracts all messages, button clicks, media, and status events.
 */
export function parseMetaWhatsAppWebhook(payload: any): MetaParsedWebhookEvent {
  const result: MetaParsedWebhookEvent = {
    isWhatsApp: false,
    messages: [],
    statuses: [],
    rawPayload: payload,
  };

  if (!payload || typeof payload !== "object") {
    return result;
  }

  if (payload.object !== "whatsapp_business_account" && !payload.entry) {
    return result;
  }

  result.isWhatsApp = true;

  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    if (entry.id) {
      result.businessAccountId = entry.id;
    }

    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      if (change.field !== "messages" || !change.value) {
        continue;
      }

      const value = change.value;

      if (value.metadata) {
        result.phoneNumberId = value.metadata.phone_number_id;
        result.displayPhoneNumber = value.metadata.display_phone_number;
      }

      // Map contacts name lookup by wa_id
      const contactMap: Record<string, string> = {};
      if (Array.isArray(value.contacts)) {
        for (const contact of value.contacts) {
          if (contact.wa_id && contact.profile?.name) {
            contactMap[contact.wa_id] = contact.profile.name;
          }
        }
      }

      // 1. Process Messages
      if (Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          if (!msg.id || !msg.from) continue;

          const fromPhone = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;
          const senderName = contactMap[msg.from] || undefined;
          const timestamp = msg.timestamp
            ? new Date(parseInt(msg.timestamp, 10) * 1000)
            : new Date();
          const contextWamId = msg.context?.id || undefined;

          let bodyText: string | undefined = undefined;
          let mediaUrl: string | undefined = undefined;
          let mediaId: string | undefined = undefined;
          let mimeType: string | undefined = undefined;
          let buttonPayload: string | undefined = undefined;

          const msgType = msg.type || "unknown";

          switch (msgType) {
            case "text":
              bodyText = msg.text?.body || "";
              break;

            case "interactive":
              if (msg.interactive?.type === "button_reply") {
                bodyText = msg.interactive.button_reply?.title || "";
                buttonPayload = msg.interactive.button_reply?.id || "";
              } else if (msg.interactive?.type === "list_reply") {
                bodyText = msg.interactive.list_reply?.title || "";
                buttonPayload = msg.interactive.list_reply?.id || "";
              }
              break;

            case "button":
              bodyText = msg.button?.text || "";
              buttonPayload = msg.button?.payload || "";
              break;

            case "image":
              bodyText = msg.image?.caption || "";
              mediaId = msg.image?.id;
              mimeType = msg.image?.mime_type;
              break;

            case "document":
              bodyText = msg.document?.caption || msg.document?.filename || "";
              mediaId = msg.document?.id;
              mimeType = msg.document?.mime_type;
              break;

            case "audio":
            case "voice":
              mediaId = msg.audio?.id || msg.voice?.id;
              mimeType = msg.audio?.mime_type || msg.voice?.mime_type;
              break;

            case "video":
              bodyText = msg.video?.caption || "";
              mediaId = msg.video?.id;
              mimeType = msg.video?.mime_type;
              break;

            case "location":
              bodyText = msg.location
                ? `Location: Lat ${msg.location.latitude}, Long ${msg.location.longitude}`
                : "";
              break;

            default:
              bodyText = `[${msgType.toUpperCase()}_MESSAGE]`;
              break;
          }

          result.messages.push({
            wamId: msg.id,
            fromPhone,
            senderName,
            timestamp,
            type: msgType,
            bodyText,
            contextWamId,
            mediaUrl,
            mediaId,
            mimeType,
            buttonPayload,
            raw: msg,
          });
        }
      }

      // 2. Process Statuses (sent, delivered, read, failed)
      if (Array.isArray(value.statuses)) {
        for (const st of value.statuses) {
          if (!st.id || !st.recipient_id) continue;

          const recipientPhone = st.recipient_id.startsWith("+")
            ? st.recipient_id
            : `+${st.recipient_id}`;

          const timestamp = st.timestamp
            ? new Date(parseInt(st.timestamp, 10) * 1000)
            : new Date();

          let status: MetaParsedStatus["status"] = "unknown";
          if (["sent", "delivered", "read", "failed"].includes(st.status)) {
            status = st.status as any;
          }

          let errorCode: number | undefined = undefined;
          let errorMessage: string | undefined = undefined;

          if (Array.isArray(st.errors) && st.errors.length > 0) {
            errorCode = st.errors[0].code;
            errorMessage = st.errors[0].title || st.errors[0].message;
          }

          result.statuses.push({
            wamId: st.id,
            recipientPhone,
            status,
            timestamp,
            errorCode,
            errorMessage,
            raw: st,
          });
        }
      }
    }
  }

  return result;
}
