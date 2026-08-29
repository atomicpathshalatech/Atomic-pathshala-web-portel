import type {
  AccessPlan,
  AccessStatus,
  Prisma,
  AccessType,
  PrismaClient,
  AiChatSubscription,
} from "@prisma/client";
import { logAiChatEvent } from "@/lib/ai-chat/audit";

export interface AccessGrantInput {
  userId: string;
  grantedByUserId?: string;
  plan: AccessPlan;
  accessType: AccessType;
  expiresAt?: Date | null;
  batchId?: string | null;
  courseId?: string | null;
  enrollmentId?: string | null;
  externalEnrollmentId?: string | null;
  syncSource?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

const PLAN_PRIORITY: Record<AccessPlan, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  LIFETIME: 3,
};

function isEligible(subscription: Pick<AiChatSubscription, "accessStatus" | "endsAt">) {
  return (
    subscription.accessStatus === "ACTIVE" &&
    (!subscription.endsAt || subscription.endsAt > new Date())
  );
}

function subscriptionStatusFor(accessStatus: AccessStatus) {
  if (accessStatus === "ACTIVE") return "ACTIVE" as const;
  if (accessStatus === "SUSPENDED") return "PAST_DUE" as const;
  if (accessStatus === "EXPIRED") return "EXPIRED" as const;
  return "CANCELED" as const;
}

export async function refreshEffectiveAccess(prisma: PrismaClient, userId: string) {
  const subscriptions = await prisma.aiChatSubscription.findMany({
    where: { userId },
    orderBy: [{ grantedAt: "desc" }, { createdAt: "desc" }],
  });
  const active = subscriptions
    .filter(isEligible)
    .sort((left, right) => PLAN_PRIORITY[right.plan] - PLAN_PRIORITY[left.plan])[0];

  // Note: the source app also cached the result on `User.isPro` here. That
  // field wasn't brought over onto atomic-ops's User (redundant with this
  // very table) — UserAccess is the single source of truth for "is this
  // user Pro", callers should read it from here instead.
  const access = active
    ? await prisma.userAccess.upsert({
        where: { userId },
        create: {
          userId,
          subscriptionId: active.id,
          plan: active.plan,
          accessType: active.accessType,
          status: active.accessStatus,
          startsAt: active.startsAt,
          expiresAt: active.endsAt,
          batchId: active.batchId,
          courseId: active.courseId,
        },
        update: {
          subscriptionId: active.id,
          plan: active.plan,
          accessType: active.accessType,
          status: active.accessStatus,
          startsAt: active.startsAt,
          expiresAt: active.endsAt,
          batchId: active.batchId,
          courseId: active.courseId,
        },
      })
    : await prisma.userAccess.upsert({
        where: { userId },
        create: {
          userId,
          plan: "FREE",
          accessType: "FREE_TRIAL",
          status: "EXPIRED",
        },
        update: {
          subscriptionId: null,
          plan: "FREE",
          accessType: "FREE_TRIAL",
          status: "EXPIRED",
          startsAt: null,
          expiresAt: null,
          batchId: null,
          courseId: null,
        },
      });

  return access;
}

export async function grantAccess(prisma: PrismaClient, input: AccessGrantInput) {
  const subscription = await prisma.aiChatSubscription.create({
    data: {
      userId: input.userId,
      grantedByUserId: input.grantedByUserId,
      plan: input.plan,
      accessType: input.accessType,
      accessStatus: "ACTIVE",
      status: "ACTIVE",
      grantedAt: new Date(),
      startsAt: new Date(),
      endsAt: input.plan === "LIFETIME" ? null : input.expiresAt ?? null,
      batchId: input.batchId,
      courseId: input.courseId,
      enrollmentId: input.enrollmentId,
      externalEnrollmentId: input.externalEnrollmentId,
      syncSource: input.syncSource,
      reason: input.reason,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  const access = await refreshEffectiveAccess(prisma, input.userId);

  await logAiChatEvent({
    actorUserId: input.grantedByUserId,
    targetUserId: input.userId,
    event: "SUBSCRIPTION_CHANGED",
    entityType: "AiChatSubscription",
    entityId: subscription.id,
    metadata: {
      action: "grant",
      subscriptionId: subscription.id,
      plan: input.plan,
      accessType: input.accessType,
      expiresAt: subscription.endsAt?.toISOString() ?? null,
      batchId: input.batchId ?? null,
    },
  });

  return { subscription, access };
}

export async function updateAccessStatus(
  prisma: PrismaClient,
  input: { subscriptionId: string; status: Exclude<AccessStatus, "ACTIVE">; grantedByUserId: string; reason?: string }
) {
  const subscription = await prisma.aiChatSubscription.update({
    where: { id: input.subscriptionId },
    data: {
      accessStatus: input.status,
      status: subscriptionStatusFor(input.status),
      reason: input.reason,
    },
  });
  const access = await refreshEffectiveAccess(prisma, subscription.userId);
  await logAiChatEvent({
    actorUserId: input.grantedByUserId,
    targetUserId: subscription.userId,
    event: "SUBSCRIPTION_CHANGED",
    entityType: "AiChatSubscription",
    entityId: subscription.id,
    metadata: { action: input.status.toLowerCase(), subscriptionId: subscription.id, reason: input.reason },
  });

  return { subscription, access };
}

export async function updateSubscriptionExpiry(
  prisma: PrismaClient,
  input: { subscriptionId: string; expiresAt: Date | null; grantedByUserId: string; reason?: string }
) {
  const subscription = await prisma.aiChatSubscription.update({
    where: { id: input.subscriptionId },
    data: {
      endsAt: input.expiresAt,
      accessStatus:
        input.expiresAt && input.expiresAt <= new Date() ? "EXPIRED" : "ACTIVE",
      status:
        input.expiresAt && input.expiresAt <= new Date() ? "EXPIRED" : "ACTIVE",
      reason: input.reason,
    },
  });
  const access = await refreshEffectiveAccess(prisma, subscription.userId);
  await logAiChatEvent({
    actorUserId: input.grantedByUserId,
    targetUserId: subscription.userId,
    event: "SUBSCRIPTION_CHANGED",
    entityType: "AiChatSubscription",
    entityId: subscription.id,
    metadata: {
      action: "change_expiry",
      subscriptionId: subscription.id,
      expiresAt: subscription.endsAt?.toISOString() ?? null,
      reason: input.reason,
    },
  });

  return { subscription, access };
}

export async function ensureBasicAccess(prisma: PrismaClient, userId: string) {
  const existing = await prisma.aiChatSubscription.findFirst({
    where: { userId, accessStatus: "ACTIVE" },
    select: { id: true },
  });
  if (existing) return refreshEffectiveAccess(prisma, userId);

  await grantAccess(prisma, {
    userId,
    plan: "BASIC",
    accessType: "BASIC_PLAN",
    reason: "Default Basic access",
  });
  return refreshEffectiveAccess(prisma, userId);
}

/**
 * Boundary for a future Atomic Pathshala ERP adapter. An external worker can
 * translate a verified enrollment event into this data shape and call grantAccess.
 */
export interface EnrollmentSyncEvent {
  externalEnrollmentId: string;
  userId: string;
  courseId?: string;
  batchId?: string;
  accessEndsAt?: Date | null;
  source: string;
}
