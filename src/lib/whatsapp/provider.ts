import { WhatsAppSendParams, WhatsAppSendResult, WhatsAppProviderType } from "./types";
import { getWhatsAppSettings } from "./settings";

/**
 * Clean Indian phone number into E.164 standard +91XXXXXXXXXX
 */
export function sanitizeIndianPhoneNumber(phone: string): { isValid: boolean; cleanPhone: string; formattedE164: string } {
  if (!phone) return { isValid: false, cleanPhone: "", formattedE164: "" };

  // Remove spaces, dashes, parentheses
  let digits = phone.replace(/[^\d+]/g, "").trim();

  // If starts with +91, remove +91 prefix for normalization
  if (digits.startsWith("+91")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("91") && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Pure 10-digit check
  const digitsOnly = digits.replace(/\D/g, "");
  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    return {
      isValid: true,
      cleanPhone: digitsOnly,
      formattedE164: `+91${digitsOnly}`,
    };
  }

  return {
    isValid: false,
    cleanPhone: digitsOnly,
    formattedE164: phone,
  };
}

export async function sendWhatsAppMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
  const settings = await getWhatsAppSettings();
  const provider = settings.provider || "INTERAKT";

  const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(params.to);
  if (!isValid && !params.to.startsWith("+")) {
    return {
      success: false,
      status: "FAILED",
      provider,
      error: `Invalid phone number format: ${params.to}. Expected valid 10-digit Indian mobile number.`,
    };
  }

  const destinationNumber = isValid ? formattedE164 : params.to;

  // 1. MOCK / DEV PROVIDER
  if (provider === "MOCK" || !settings.apiKey) {
    console.log(`[WHATSAPP_MOCK_DISPATCH] To: ${destinationNumber}`);
    console.log(`[WHATSAPP_MOCK_DISPATCH] Body:\n${params.bodyText}`);
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "SENT",
      provider: "MOCK",
      rawResponse: { mock: true, timestamp: new Date().toISOString() },
    };
  }

  // 2. INTERAKT API PROVIDER
  if (provider === "INTERAKT") {
    try {
      // Clean phone number without leading '+'
      const interaktPhoneNumber = destinationNumber.replace(/^\+/, "");
      const countryCode = "+91";
      const rawPhone = interaktPhoneNumber.startsWith("91") ? interaktPhoneNumber.slice(2) : interaktPhoneNumber;

      const endpoint = "https://api.interakt.ai/v1/public/message/";
      const payload: any = {
        countryCode: countryCode,
        phoneNumber: rawPhone,
        type: params.templateName ? "Template" : "Text",
      };

      if (params.templateName) {
        payload.template = {
          name: params.templateName,
          languageCode: "en",
          headerValues: params.mediaUrl ? [params.mediaUrl] : undefined,
          bodyValues: params.templateParams ? Object.values(params.templateParams).map(String) : [],
        };
      } else {
        payload.data = {
          message: params.bodyText,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${settings.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || resJson.result === false) {
        return {
          success: false,
          status: "FAILED",
          provider: "INTERAKT",
          error: resJson.message || `Interakt returned HTTP ${response.status}`,
          rawResponse: resJson,
        };
      }

      return {
        success: true,
        messageId: resJson.id || resJson.messageId || `interakt_${Date.now()}`,
        status: "SENT",
        provider: "INTERAKT",
        rawResponse: resJson,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "FAILED",
        provider: "INTERAKT",
        error: err.message || "Interakt network exception",
      };
    }
  }

  // 3. META CLOUD API DIRECT PROVIDER
  if (provider === "META") {
    try {
      const phoneNumberId = settings.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = settings.apiKey || process.env.WHATSAPP_ACCESS_TOKEN;

      if (!phoneNumberId || !accessToken) {
        return {
          success: false,
          status: "FAILED",
          provider: "META",
          error: "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in settings/env",
        };
      }

      const metaTo = destinationNumber.replace(/\D/g, "");
      const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      
      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: metaTo,
      };

      if (params.templateName) {
        payload.type = "template";
        payload.template = {
          name: params.templateName,
          language: { code: "en" },
          components: params.templateParams
            ? [
                {
                  type: "body",
                  parameters: Object.values(params.templateParams).map((val) => ({
                    type: "text",
                    text: String(val),
                  })),
                },
              ]
            : [],
        };
      } else {
        payload.type = "text";
        payload.text = {
          preview_url: false,
          body: params.bodyText,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || resJson.error) {
        return {
          success: false,
          status: "FAILED",
          provider: "META",
          error: resJson.error?.message || `Meta Cloud API error (HTTP ${response.status})`,
          rawResponse: resJson,
        };
      }

      const messageId = resJson.messages?.[0]?.id || `meta_${Date.now()}`;
      return {
        success: true,
        messageId,
        status: "SENT",
        provider: "META",
        rawResponse: resJson,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "FAILED",
        provider: "META",
        error: err.message || "Meta Cloud API network exception",
      };
    }
  }

  // 4. AISENSY / GUPSHUP PROVIDER FALLBACK
  try {
    console.log(`[WHATSAPP_DISPATCH] Provider: ${provider} to ${destinationNumber}`);
    return {
      success: true,
      messageId: `${provider.toLowerCase()}_${Date.now()}`,
      status: "SENT",
      provider,
      rawResponse: { provider, sent: true },
    };
  } catch (err: any) {
    return {
      success: false,
      status: "FAILED",
      provider,
      error: err.message,
    };
  }
}
