import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver, EgressStatus } from "livekit-server-sdk";
import { prisma } from "@/lib/db";
import { pusherServer, sessionChannel } from "@/lib/realtime/pusher-server";

export const runtime = "nodejs";

/**
 * LiveKit webhooks (configured in LiveKit Cloud project dashboard -> Settings -> Webhooks).
 * Egress events update WhiteboardSession and FileAsset records upon completion.
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
        include: {
          teacher: true,
          batchSchedule: true,
        },
      });

      if (session) {
        if (info.status === EgressStatus.EGRESS_COMPLETE) {
          const file = info.fileResults?.[0];
          const storageKey = file?.filename || session.recordingStorageKey || `recordings/${session.id}/final.mp4`;
          const durationSeconds = file?.duration
            ? Math.round(Number(file.duration) / 1_000_000_000)
            : undefined;

          // 1. Create or update FileAsset record
          const fileAsset = await prisma.fileAsset
            .upsert({
              where: { storageKey },
              update: {
                status: "ACTIVE",
                sizeBytes: file?.size ? BigInt(file.size) : undefined,
                metadata: {
                  whiteboardSessionId: session.id,
                  batchScheduleId: session.batchScheduleId,
                  type: "LIVE_CLASS_RECORDING",
                  durationSeconds,
                  egressId: info.egressId,
                },
              },
              create: {
                ownerId: session.teacher?.userId || session.teacherId,
                fileType: "VIDEO",
                storageProvider: "r2",
                storageKey,
                originalFilename: `${(session.title || "Live_Class").replace(/[^a-zA-Z0-9_-]/g, "_")}_Recording.mp4`,
                mimeType: "video/mp4",
                sizeBytes: file?.size ? BigInt(file.size) : BigInt(0),
                status: "ACTIVE",
                visibility: "PROTECTED",
                metadata: {
                  whiteboardSessionId: session.id,
                  batchScheduleId: session.batchScheduleId,
                  type: "LIVE_CLASS_RECORDING",
                  durationSeconds,
                  egressId: info.egressId,
                },
              },
            })
            .catch((faErr) => {
              console.warn("[livekit_webhook_fileasset_warning]", faErr);
              return null;
            });

          // 2. Update WhiteboardSession
          await prisma.whiteboardSession.update({
            where: { id: session.id },
            data: {
              recordingStatus: "READY",
              recordingStorageKey: storageKey,
              ...(durationSeconds !== undefined && { recordingDurationSeconds: durationSeconds }),
            },
          });

          // 3. Realtime push notification
          try {
            await pusherServer.trigger(sessionChannel(session.id), "recording-ready", {
              recordingStatus: "READY",
              durationSeconds,
              resourceId: fileAsset?.id || null,
            });
          } catch {
            // non-blocking
          }
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
    console.error("[livekit_webhook_handler_error]", error);
  }

  return NextResponse.json({ success: true });
}

