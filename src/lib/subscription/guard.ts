import "server-only";
import { prisma } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/guard";
import {
  PAST_DUE_GRACE_DAYS,
  getPlanFeatures,
  type SubscriptionFeatureKey,
} from "@/lib/subscription/config";
import type { Subscription } from "@prisma/client";

/**
 * Access is granted while status is TRIAL, ACTIVE, or (briefly) PAST_DUE —
 * cutoff only happens once the record is actually EXPIRED/CANCELLED-and-past-
 * period, or the grace window on a failed recurring charge has run out.
 * This does NOT write to the DB — the actual TRIAL/PAST_DUE -> EXPIRED
 * transition is persisted by `syncSubscriptionStatus` (called from the
 * dashboard load / webhook / cron), not on every read.
 */
function isEntitled(sub: Subscription, now: Date): boolean {
  if (sub.status === "EXPIRED") return false;
  if (sub.currentPeriodEnd > now) return true;

  if (sub.status === "PAST_DUE") {
    const graceEnd = new Date(sub.currentPeriodEnd);
    graceEnd.setDate(graceEnd.getDate() + PAST_DUE_GRACE_DAYS);
    return graceEnd > now;
  }

  return false;
}

/** Loads the student's subscription row, or null if they never started one. */
export async function getSubscription(studentId: string): Promise<Subscription | null> {
  return prisma.subscription.findUnique({ where: { studentId } });
}

/**
 * Persists TRIAL/ACTIVE/PAST_DUE -> EXPIRED once the entitlement window has
 * actually closed. Cheap to call on every dashboard/feature-gated load;
 * only writes when the status actually needs to change.
 */
export async function syncSubscriptionStatus(sub: Subscription): Promise<Subscription> {
  const now = new Date();
  if (isEntitled(sub, now)) return sub;
  if (sub.status === "EXPIRED") return sub;

  return prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "EXPIRED" },
  });
}

/** True if the student currently has ANY active plan (core access). */
export async function hasActiveSubscription(studentId: string): Promise<boolean> {
  const sub = await getSubscription(studentId);
  if (!sub) return false;
  const synced = await syncSubscriptionStatus(sub);
  return isEntitled(synced, new Date());
}

/** True if the student's current plan unlocks the given gated feature. */
export async function hasFeatureAccess(
  studentId: string,
  feature: SubscriptionFeatureKey
): Promise<boolean> {
  const sub = await getSubscription(studentId);
  if (!sub) return false;
  const synced = await syncSubscriptionStatus(sub);
  if (!isEntitled(synced, new Date())) return false;
  return getPlanFeatures(synced.plan).includes(feature);
}

/**
 * Throws if the student has no active subscription at all. Use at the top
 * of any student-portal route that needs core paid access (courses, tests,
 * QBank, doubt solving, etc).
 */
export async function requireActiveSubscription(studentId: string | undefined | null) {
  if (!studentId) throw new UnauthorizedError();
  const allowed = await hasActiveSubscription(studentId);
  if (!allowed) {
    throw new ForbiddenError("An active subscription is required to access this.");
  }
}

/**
 * Throws unless the student's plan unlocks this specific gated feature
 * (Mentorship, NEET UG Assure, WhatsApp Community, SRG NCERT+Revision).
 */
export async function requireFeature(
  studentId: string | undefined | null,
  feature: SubscriptionFeatureKey
) {
  if (!studentId) throw new UnauthorizedError();
  const allowed = await hasFeatureAccess(studentId, feature);
  if (!allowed) {
    throw new ForbiddenError("This feature requires the PRO plan.");
  }
}
