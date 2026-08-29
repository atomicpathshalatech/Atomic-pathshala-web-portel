import "server-only";
import { prisma } from "@/lib/db";

/**
 * `_import_atomic-ai-chat` called `prisma.auditLog.create({ actorUserId,
 * targetUserId, event, metadata })` throughout — its own AuditLog shape.
 * Per the integration decision, that model was dropped in favor of
 * atomic-ops's existing AuditLog, which has a different shape (`userId`,
 * `action`, `entityType`, `entityId`, `metadata`, `ipAddress`) and only
 * tracks a single user, not actor+target separately. This wraps every
 * ported call site onto the real shape in one place instead of hand-
 * adapting each one differently: `userId` becomes the actor (falling back
 * to the target when there's no separate actor, e.g. a user's own sign-in),
 * and a target that differs from the actor is folded into `metadata`
 * rather than dropped.
 */
export async function logAiChatEvent(input: {
  actorUserId?: string | null;
  targetUserId?: string | null;
  event: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.actorUserId ?? input.targetUserId ?? null,
      action: input.event,
      entityType: input.entityType ?? "AiChat",
      entityId: input.entityId ?? input.targetUserId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.targetUserId && input.targetUserId !== input.actorUserId
          ? { targetUserId: input.targetUserId }
          : {}),
      },
    },
  });
}
