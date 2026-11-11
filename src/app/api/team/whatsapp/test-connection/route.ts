import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { sanitizeIndianPhoneNumber } from "@/lib/whatsapp/provider";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_MANAGE);

    const body = await req.json().catch(() => ({}));
    const currentSettings = await getWhatsAppSettings();

    const provider = body.provider || currentSettings.provider || "META";
    let apiKey = body.apiKey !== undefined ? body.apiKey : currentSettings.apiKey;
    const phoneNumberId = body.phoneNumberId || currentSettings.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const testPhone = body.testPhone?.trim();

    if (provider === "MOCK") {
      return apiSuccess({
        success: true,
        provider: "MOCK",
        message: "Mock Provider is active. Messages are logged to console without reaching WhatsApp.",
      });
    }

    if (provider === "INTERAKT") {
      if (!apiKey) {
        return apiError("Missing Interakt API Key. Please provide your API Key.", 400);
      }
      try {
        const res = await fetch("https://api.interakt.ai/v1/public/track/users/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${apiKey}`,
          },
          body: JSON.stringify({ phoneNumber: "9999999999", countryCode: "+91", traits: {} }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok && res.status === 401) {
          return apiError("Interakt API Key is invalid or unauthorized.", 401);
        }
        return apiSuccess({
          success: true,
          provider: "INTERAKT",
          message: "Interakt API connection verified successfully.",
          raw: json,
        });
      } catch (err: any) {
        return apiError(`Interakt connection error: ${err.message}`, 502);
      }
    }

    if (provider === "META") {
      // If user passed a numeric App ID into apiKey, check if it's invalid
      if (apiKey && /^\d+$/.test(apiKey)) {
        if (process.env.WHATSAPP_ACCESS_TOKEN) {
          apiKey = process.env.WHATSAPP_ACCESS_TOKEN;
        } else {
          return apiError(
            `The API Key entered (${apiKey}) is a numeric ID (like an App ID or Phone Number ID), NOT a Meta Access Token. A valid Meta Access Token starts with 'EAA...' and is 200+ characters long.`,
            400
          );
        }
      }

      const accessToken = apiKey || process.env.WHATSAPP_ACCESS_TOKEN;

      if (!phoneNumberId) {
        return apiError("Missing Phone Number ID. Please enter your Meta Phone Number ID.", 400);
      }

      if (!accessToken) {
        return apiError("Missing Meta Access Token. Please enter your Permanent System User Token starting with 'EAA...'.", 400);
      }

      // Check phone number details on Meta Graph API
      const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`;
      const res = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const resJson = await res.json().catch(() => ({}));

      if (!res.ok || resJson.error) {
        const errObj = resJson.error || {};
        let friendlyMessage = errObj.message || `Meta Cloud API returned HTTP ${res.status}`;

        if (errObj.code === 190) {
          if (errObj.error_subcode === 463) {
            friendlyMessage = "Your Meta WhatsApp Access Token has EXPIRED. Temporary tokens expire after 24 hours. Please generate a Permanent System User Token from Meta Business Suite.";
          } else {
            friendlyMessage = "Invalid Meta Access Token. Make sure you copied the full token starting with 'EAA...'.";
          }
        } else if (errObj.code === 100) {
          friendlyMessage = `Invalid Phone Number ID (${phoneNumberId}). Check the Phone Number ID in your Meta WhatsApp API Setup tab.`;
        }

        return apiSuccess({
          success: false,
          provider: "META",
          error: friendlyMessage,
          details: errObj,
        });
      }

      // If testPhone is provided, try sending a test message
      let testMessageResult: any = null;
      if (testPhone) {
        const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(testPhone);
        if (!isValid && !testPhone.startsWith("+")) {
          return apiSuccess({
            success: true,
            provider: "META",
            metaAccount: resJson,
            message: `Connected to Meta as ${resJson.display_phone_number || resJson.verified_name}, but test phone ${testPhone} is not a valid 10-digit Indian phone number.`,
          });
        }

        const destination = (isValid ? formattedE164 : testPhone).replace(/\D/g, "");
        const sendUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
        const sendRes = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: destination,
            type: "text",
            text: { preview_url: false, body: "Hello! This is a test message from Atomic Pathshala WhatsApp automation." },
          }),
        });

        const sendJson = await sendRes.json().catch(() => ({}));
        testMessageResult = {
          status: sendRes.status,
          success: sendRes.ok && !sendJson.error,
          response: sendJson,
        };
      }

      return apiSuccess({
        success: true,
        provider: "META",
        message: `Successfully connected to Meta WhatsApp Cloud API! Number: ${resJson.display_phone_number || phoneNumberId} (${resJson.verified_name || "Verified"})`,
        metaAccount: {
          displayPhoneNumber: resJson.display_phone_number,
          verifiedName: resJson.verified_name,
          qualityRating: resJson.quality_rating,
          status: resJson.code_verification_status,
        },
        testMessageResult,
      });
    }

    return apiError(`Provider ${provider} is not supported. Use META or INTERAKT.`, 400);
  } catch (error) {
    return handleApiError(error);
  }
}
