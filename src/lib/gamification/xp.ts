import "server-only";
import type { XPReason, Prisma } from "@prisma/client";
import { awardActivityXp, levelForXp, dateOnlyUTC } from "./xp-engine";

export { levelForXp, dateOnlyUTC };

/**
 * Backward-compatible gateway to the Centralized XP Reward Engine.
 * All awards now flow through awardActivityXp with idempotency,
 * limit validation, audit logging, and concurrency control.
 */
export async function awardXp(
  studentId: string,
  amount: number,
  reason: XPReason,
  metadata?: Prisma.InputJsonValue
) {
  if (amount <= 0) return;

  const meta = (metadata && typeof metadata === "object" ? (metadata as Record<string, any>) : {}) as Record<string, any>;

  let activityName: string;
  let sourceEntityId: string | undefined;

  switch (reason) {
    case "TEST_COMPLETED":
      activityName = "TEST_SUBMISSION";
      sourceEntityId = meta.attemptId || meta.testId;
      break;
    case "DPP_COMPLETED":
      activityName = "DPP_COMPLETION";
      sourceEntityId = meta.attemptId || meta.testId;
      break;
    case "LIVE_CLASS_ATTENDANCE":
      activityName = "LIVE_CLASS_ATTENDANCE";
      sourceEntityId = meta.whiteboardSessionId || meta.sessionId;
      break;
    case "LECTURE_COMPLETED":
      activityName = "RECORDED_LECTURE";
      sourceEntityId = meta.lectureId;
      break;
    case "QUIZ_CORRECT_ANSWER":
      activityName = "CORRECT_ANSWER";
      sourceEntityId = meta.quizAttemptId || meta.quizId || meta.questionId;
      break;
    case "DAILY_LOGIN_STREAK":
      activityName = "DAILY_LOGIN";
      sourceEntityId = dateOnlyUTC(new Date()).toISOString().split("T")[0];
      break;
    case "DOUBT_RESOLVED":
      activityName = "DOUBT_PARTICIPATION";
      sourceEntityId = meta.doubtId;
      break;
    default:
      activityName = String(reason);
      sourceEntityId = meta.id || meta.sourceId;
      break;
  }

  const idempotencyKey = meta.idempotencyKey || (sourceEntityId ? `${activityName}:${sourceEntityId}:${studentId}` : undefined);

  await awardActivityXp({
    studentId,
    activityName,
    sourceEntityId,
    idempotencyKey,
    payload: meta,
    customXp: amount,
    overrideReason: reason,
  });
}
