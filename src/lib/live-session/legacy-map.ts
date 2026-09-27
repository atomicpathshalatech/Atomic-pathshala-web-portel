/**
 * Maps a pre-redesign WhiteboardSession (+ its BatchSchedule) onto the
 * LiveSession row that represents the same occurrence. Pure — no I/O — so the
 * backfill script (scripts/backfill-live-sessions.ts) and its tests share
 * exactly one definition of the mapping.
 *
 * Deliberately conservative:
 *   - A YouTube class counts as APP_YOUTUBE only when Atomic itself created
 *     the broadcast (youtubeBroadcastId + youtubeStreamId present). A pasted
 *     video id can't be proven to belong to either channel, so it becomes
 *     EXTERNAL_YOUTUBE.
 *   - The old code marked YouTube recordings READY at End Class without
 *     asking YouTube, so recordingVideoId is NOT carried over — the new
 *     recording check verifies it instead of trusting it.
 */

export type LegacyWhiteboardSession = {
  id: string;
  teacherId: string;
  status: string; // ACTIVE | ENDED
  livePhase: string;
  videoTransport: string; // LIVEKIT | YOUTUBE | BOTH
  youtubeBroadcastId: string | null;
  youtubeStreamId: string | null;
  youtubeVideoId: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualStartedAt: Date | null;
  actualEndedAt: Date | null;
  endedAt: Date | null;
  totalExtendedMinutes: number;
};

export type LegacySchedule = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

export type MappedLiveSession = {
  batchScheduleId: string;
  occurrence: 1;
  whiteboardSessionId: string;
  deliveryMode: "APP_YOUTUBE" | "MAIN_YOUTUBE" | "EXTERNAL_YOUTUBE" | "LEGACY_LIVEKIT";
  youtubeChannel: "APP" | null;
  youtubeBroadcastId: string | null;
  youtubeVideoId: string | null;
  state:
    | "SCHEDULED"
    | "READY"
    | "YOUTUBE_CONNECTING"
    | "LIVE"
    | "ENDING"
    | "RECORDING_PROCESSING"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED";
  controllingTeacherId: string;
  plannedStartsAt: Date;
  effectiveEndsAt: Date;
  totalExtendedMinutes: number;
  actualStartedAt: Date | null;
  actualEndedAt: Date | null;
};

function mapDeliveryMode(wb: LegacyWhiteboardSession): Pick<MappedLiveSession, "deliveryMode" | "youtubeChannel" | "youtubeBroadcastId" | "youtubeVideoId"> {
  const youtubeTransport = wb.videoTransport === "YOUTUBE" || wb.videoTransport === "BOTH";
  if (youtubeTransport && wb.youtubeBroadcastId && wb.youtubeStreamId) {
    return {
      deliveryMode: "APP_YOUTUBE",
      youtubeChannel: "APP",
      youtubeBroadcastId: wb.youtubeBroadcastId,
      youtubeVideoId: wb.youtubeVideoId ?? wb.youtubeBroadcastId,
    };
  }
  if (youtubeTransport && wb.youtubeVideoId) {
    return { deliveryMode: "EXTERNAL_YOUTUBE", youtubeChannel: null, youtubeBroadcastId: null, youtubeVideoId: wb.youtubeVideoId };
  }
  // LIVEKIT, or a YouTube class whose broadcast was never created (it fell
  // back to the LiveKit room).
  return { deliveryMode: "LEGACY_LIVEKIT", youtubeChannel: null, youtubeBroadcastId: null, youtubeVideoId: null };
}

function mapState(wb: LegacyWhiteboardSession): MappedLiveSession["state"] {
  switch (wb.livePhase) {
    case "CANCELLED":
      return "CANCELLED";
    case "FAILED":
      return "FAILED";
    case "ENDED":
    case "RECORDED":
      return "COMPLETED";
    case "PROCESSING_RECORDING":
      return "RECORDING_PROCESSING";
    case "ENDING":
      return "ENDING";
  }
  // Any other phase on an ENDED row is history, not a live class.
  if (wb.status === "ENDED") return "COMPLETED";
  switch (wb.livePhase) {
    case "LIVE":
      return "LIVE";
    case "WAITING_FOR_STREAM":
      return "YOUTUBE_CONNECTING";
    case "PREPARING":
      return "READY";
    default:
      return "SCHEDULED";
  }
}

export function mapLegacyLiveSession(wb: LegacyWhiteboardSession, schedule: LegacySchedule): MappedLiveSession {
  const plannedStartsAt = wb.scheduledStart ?? schedule.startsAt;
  // Same "later of the two" rule the interim extend fix uses, so a class
  // that was extended keeps its extension.
  let effectiveEndsAt =
    wb.scheduledEnd && wb.scheduledEnd.getTime() > schedule.endsAt.getTime() ? wb.scheduledEnd : schedule.endsAt;
  // The table requires end > start; bad legacy rows get a 60-minute window.
  if (effectiveEndsAt.getTime() <= plannedStartsAt.getTime()) {
    effectiveEndsAt = new Date(plannedStartsAt.getTime() + 60 * 60_000);
  }

  return {
    batchScheduleId: schedule.id,
    occurrence: 1,
    whiteboardSessionId: wb.id,
    ...mapDeliveryMode(wb),
    state: mapState(wb),
    controllingTeacherId: wb.teacherId,
    plannedStartsAt,
    effectiveEndsAt,
    totalExtendedMinutes: wb.totalExtendedMinutes ?? 0,
    actualStartedAt: wb.actualStartedAt,
    actualEndedAt: wb.actualEndedAt ?? wb.endedAt,
  };
}
