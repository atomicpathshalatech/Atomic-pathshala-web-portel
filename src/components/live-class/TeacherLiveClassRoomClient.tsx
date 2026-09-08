"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TeacherLiveClassRoom as TeacherLiveClassRoomType } from "./TeacherLiveClassRoom";
import { LiveRoomSkeleton } from "./LiveRoomSkeleton";

/**
 * Client boundary for the ~3.8k-line TeacherLiveClassRoom. `ssr: false` —
 * it's browser-only (canvas engine, Pusher, LiveKit, media devices) — so it
 * never server-renders and its large chunk loads after the shell paints,
 * behind a skeleton. The server page stays a Server Component.
 */
const TeacherLiveClassRoom = dynamic(
  () => import("./TeacherLiveClassRoom").then((m) => m.TeacherLiveClassRoom),
  { ssr: false, loading: () => <LiveRoomSkeleton /> }
);

export function TeacherLiveClassRoomClient(
  props: ComponentProps<typeof TeacherLiveClassRoomType>
) {
  return <TeacherLiveClassRoom {...props} />;
}
