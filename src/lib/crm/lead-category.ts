import "server-only";
import { prisma } from "@/lib/db";
import { getOutreachLeads, updateOutreachLead } from "@/lib/integrations/outreach-leads";

/**
 * NORMAL_LEAD < BATCH_EXPLORED < HOT_LEAD < CONVERTED — always computed live
 * from StudentActivityEvent + real conversion signals (an active enrollment
 * or a successful subscription payment), never stored. This keeps category
 * always consistent with the latest activity without a separate write path
 * (and separate bug surface) to keep a cached value in sync.
 */
export type LeadCategory = "NORMAL_LEAD" | "BATCH_EXPLORED" | "HOT_LEAD" | "CONVERTED";

export async function computeLeadCategory(studentId: string): Promise<LeadCategory | null> {
  const [hasEnrollment, hasSuccessPayment, hasPaymentIntent, hasBatchView, hasSearch] = await Promise.all([
    prisma.batchEnrollment.count({ where: { studentId, status: "ACTIVE" } }),
    prisma.subscriptionPayment.count({ where: { subscription: { studentId }, status: "SUCCESS" } }),
    prisma.studentActivityEvent.count({
      where: { studentId, type: { in: ["PAYMENT_INTENT", "PAYMENT_SUCCESS"] } },
    }),
    prisma.studentActivityEvent.count({ where: { studentId, type: "BATCH_VIEW" } }),
    prisma.studentActivityEvent.count({ where: { studentId, type: "SEARCH" } }),
  ]);

  if (hasEnrollment > 0 || hasSuccessPayment > 0) return "CONVERTED";
  if (hasPaymentIntent > 0) return "HOT_LEAD";
  if (hasBatchView > 0) return "BATCH_EXPLORED";
  if (hasSearch > 0) return "NORMAL_LEAD";
  return null;
}

export type ActivityTimelineEntry = {
  id: string;
  type: "SEARCH" | "BATCH_VIEW" | "PAYMENT_INTENT" | "PAYMENT_SUCCESS";
  searchQuery: string | null;
  batchName: string | null;
  createdAt: Date;
};

export async function getStudentActivityTimeline(
  studentId: string,
  limit = 50
): Promise<ActivityTimelineEntry[]> {
  const events = await prisma.studentActivityEvent.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      searchQuery: true,
      createdAt: true,
      batch: { select: { name: true } },
    },
  });
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    searchQuery: e.searchQuery,
    batchName: e.batch?.name ?? null,
    createdAt: e.createdAt,
  }));
}

/**
 * Matches an external OutreachLead's contact (email/phone) to a local
 * Student — there's no schema FK between the two systems (the CRM lives in
 * a separate app), so this join happens at read time instead.
 */
export async function findStudentByContact(
  email?: string | null,
  phone?: string | null
): Promise<{ id: string } | null> {
  if (!email && !phone) return null;
  const user = await prisma.user.findFirst({
    where: {
      OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(
        (c): c is { email: string } | { phone: string } => Boolean(c)
      ),
    },
    select: { student: { select: { id: true } } },
  });
  return user?.student ?? null;
}

/**
 * Records one activity event and returns the student's freshly-recomputed
 * category — callers that need to push a status change to the external CRM
 * (see src/lib/integrations/outreach-leads.ts) use the return value to
 * decide whether a sync is worth attempting, without a second DB round trip.
 */
export async function recordActivity(params: {
  studentId: string;
  type: "SEARCH" | "BATCH_VIEW" | "PAYMENT_INTENT" | "PAYMENT_SUCCESS";
  batchId?: string;
  searchQuery?: string;
}): Promise<LeadCategory | null> {
  await prisma.studentActivityEvent.create({
    data: {
      studentId: params.studentId,
      type: params.type,
      batchId: params.batchId,
      searchQuery: params.searchQuery,
    },
  });
  return computeLeadCategory(params.studentId);
}

export type LocalCrmData = {
  category: LeadCategory | null;
  timeline: ActivityTimelineEntry[];
};

/**
 * Batched version of findStudentByContact + computeLeadCategory +
 * getStudentActivityTimeline for a whole page of external leads at once —
 * one query to match contacts to local Students, rather than one per lead.
 * Keyed by whatever contact value was matched (email first, else phone) so
 * the caller can look a lead's data up by either.
 */
export async function getLocalCrmDataForContacts(
  contacts: { email: string | null; phone: string | null }[]
): Promise<Map<string, LocalCrmData>> {
  const emails = contacts.map((c) => c.email).filter((e): e is string => Boolean(e));
  const phones = contacts.map((c) => c.phone).filter((p): p is string => Boolean(p));
  if (emails.length === 0 && phones.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: {
      OR: [emails.length ? { email: { in: emails } } : undefined, phones.length ? { phone: { in: phones } } : undefined].filter(
        (c): c is { email: { in: string[] } } | { phone: { in: string[] } } => Boolean(c)
      ),
    },
    select: { email: true, phone: true, student: { select: { id: true } } },
  });

  const result = new Map<string, LocalCrmData>();
  await Promise.all(
    users
      .filter((u) => u.student)
      .map(async (u) => {
        const studentId = u.student!.id;
        const [category, timeline] = await Promise.all([
          computeLeadCategory(studentId),
          getStudentActivityTimeline(studentId),
        ]);
        const data: LocalCrmData = { category, timeline };
        if (u.email) result.set(u.email, data);
        if (u.phone) result.set(u.phone, data);
      })
  );
  return result;
}

/**
 * Best-effort push of a category transition to the external CRM's own
 * status field, so a counselor working inside atomic-outreach-system
 * directly (not through this app's /team/leads proxy) also sees the signal.
 * The outreach API only supports PATCH-by-leadId, and there's no local
 * record of which outreach lead corresponds to which Student (the two apps
 * share no FK) — so this fetches the lead list and matches by contact
 * email/phone. Never throws: a CRM outage or an unmatched student must
 * never break the student-facing flow that triggered the category change.
 */
export async function syncCategoryToOutreach(studentId: string, category: LeadCategory | null): Promise<void> {
  if (category !== "HOT_LEAD" && category !== "CONVERTED") return;
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { user: { select: { email: true, phone: true } } },
    });
    if (!student) return;

    const leads = await getOutreachLeads();
    const match = leads.find(
      (l) =>
        (student.user.email && l.contact.email === student.user.email) ||
        (student.user.phone && l.contact.phone === student.user.phone)
    );
    if (!match) return;

    const status = category === "CONVERTED" ? "CONVERTED" : "HOT";
    if (match.status === status) return; // already reflects this category
    await updateOutreachLead(match.id, { status });
  } catch {
    // Best-effort — a CRM outage should never surface to the student flow
    // that triggered this (a search, a batch view, a checkout click).
  }
}
