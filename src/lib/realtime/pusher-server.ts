import "server-only";
import Pusher from "pusher";

export { sessionChannel, teacherChannel, WB_EVENTS } from "./events";

/**
 * Server-side Pusher client — the only thing allowed to publish realtime
 * events. All state (hand raises, quiz responses) lives in Postgres first;
 * Pusher is purely a broadcast layer for "something changed, go re-check" —
 * this mirrors the rest of this codebase's pattern of never trusting the
 * client with authority (see PERMISSIONS / requirePermission()).
 */
const globalForPusher = globalThis as unknown as { pusherServer?: Pusher };

export const pusherServer =
  globalForPusher.pusherServer ??
  new Pusher({
    appId: process.env.PUSHER_APP_ID ?? "",
    key: process.env.PUSHER_KEY ?? "",
    secret: process.env.PUSHER_SECRET ?? "",
    cluster: process.env.PUSHER_CLUSTER || "ap2",
    useTLS: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPusher.pusherServer = pusherServer;
}
