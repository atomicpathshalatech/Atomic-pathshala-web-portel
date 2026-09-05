"use client";

import PusherClient from "pusher-js";

let client: PusherClient | null = null;

/** Browser-side singleton. Auth for presence/private channels goes through
 * /api/pusher/auth, which re-derives identity from the server session —
 * the browser never gets to declare its own user id/name. */
export function getPusherClient() {
  if (client) return client;
  client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY ?? "", {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2",
    authEndpoint: "/api/pusher/auth",
  });
  return client;
}
