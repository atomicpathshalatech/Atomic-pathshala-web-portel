"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { StudentLiveClassRoom as StudentLiveClassRoomType } from "./StudentLiveClassRoom";
import { LiveRoomSkeleton } from "./LiveRoomSkeleton";

/**
 * Client boundary for the ~1.3k-line StudentLiveClassRoom. Loaded with
 * `ssr: false` (it's entirely browser-only — Pusher, canvas, LiveKit) so it
 * never runs on the server and its chunk is fetched after the shell paints,
 * behind a skeleton. The server page stays a Server Component.
 */
const StudentLiveClassRoom = dynamic(
  () => import("./StudentLiveClassRoom").then((m) => m.StudentLiveClassRoom),
  { ssr: false, loading: () => <LiveRoomSkeleton /> }
);

export function StudentLiveClassRoomClient(
  props: ComponentProps<typeof StudentLiveClassRoomType>
) {
  return <StudentLiveClassRoom {...props} />;
}
