import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver, EgressStatus } from "livekit-server-sdk";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * LiveKit webhooks (configure in the LiveKit Cloud project dashboard ->
 * Settings -> Webhooks, pointing at `<domain>/api/webhooks/livekit`).
 * Only egress_* events are handled here - room/participant events aren't
 * needed since Pusher already carries those in realtime for this app.
 *
 * We only care about matching an egress back to the WhiteboardSession that
 * started it (via recordingEgressId) and recording where the finished file
 * landed. Everything else about the event is ignored.
 */
function getReceiver() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return new WebhookReceiver(apiKey, apiSecret);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const authHeader = request.headers.get("Authorize") || request.headers.get("authorization") || undefined;

  const receiver = getReceiver();
  if (!receiver) {
    console.error("[livekit_webhook_error] LiveKit not configured, dropping event");
    return NextResponse.json({ success: false }, { status: 200 });
  }

  let event;
  try {
    event = await receiver.receive(rawBody, authHeader);
  } catch (error) {
    console.error("[livekit_webhook_signature_error]", error);
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.event === "egress_ended" && event.egressInfo) {
      const info = event.egressInfo;
      const session = await prisma.whiteboardSession.findFirst({
        where: { recordingEgressId: info.egressId },
        select: { id: true },
      });

      if (session) {
        if (info.status === EgressStatus.EGRESS_COMPLETE) {
          const file = info.fileResults?.[0];
          await prisma.whiteboardSession.update({
            where: { id: session.id },
            data: {
              recordingStatus: "READY",
              recordingStorageKey: file?.filename || undefined,
              recordingDurationSeconds: file?.duration
                ? Math.round(Number(file.duration) / 1_000_000_000)
                : undefined,
            },
          });
        } else {
          await prisma.whiteboardSession.update({
            where: { id: session.id },
            data: { recordingStatus: "FAILED" },
          });
          console.error("[livekit_webhook_egress_failed]", info.egressId, info.error);
        }
      } else {
        console.warn("[livekit_webhook_unmatched_egress]", info.egressId);
      }
    }
  } catch (error) {
    // LiveKit doesn't retry webhooks on failure the way Razorpay does, but
    // there's still nothing useful a 500 here does for us - log and move on.
    console.error("[livekit_webhook_handler_error]", error);
  }

  return NextResponse.json({ success: true });
}
