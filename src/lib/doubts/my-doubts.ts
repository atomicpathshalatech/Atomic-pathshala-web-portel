import "server-only";
import { prisma } from "@/lib/db";

/**
 * Everything a student has asked, in one list: doubts from the doubt form,
 * doubts asked from a recorded class, and questions asked inside a live
 * class (chat messages marked as a question, and photo doubts sent with a
 * raised hand) — each tagged with its subject so the page can group them.
 */

export type MyDoubtKind = "ASKED" | "RECORDED_CLASS" | "LIVE_CLASS";

export type MyDoubtItem = {
  id: string;
  kind: MyDoubtKind;
  subject: string;
  body: string;
  imageUrl: string | null;
  /** OPEN / RESOLVED / FLAGGED for doubts; ASKED / ANSWERED for live-class questions. */
  status: string;
  createdAt: string;
  classTitle: string | null;
  videoTimestampSec: number | null;
  answer: string | null;
  answeredBy: string | null;
  /** Detail page, when there is one. */
  href: string | null;
  /** Only the student's own doubt-form entries can be deleted. */
  deletable: boolean;
};

const SUBJECT_ALIASES: [RegExp, string][] = [
  [/chem/i, "Chemistry"],
  [/phys/i, "Physics"],
  [/bio|botany|zoology/i, "Biology"],
  [/math/i, "Mathematics"],
];

export function canonicalSubject(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "General";
  for (const [re, name] of SUBJECT_ALIASES) if (re.test(s)) return name;
  if (/general|foundation/i.test(s)) return "General";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type ScheduleBits = { title: string; subject: string | null; chapter: { subject: { title: string } } | null } | null | undefined;
const classSubject = (s: ScheduleBits) => s?.chapter?.subject.title ?? s?.subject ?? null;

const scheduleSelect = { select: { title: true, subject: true, chapter: { select: { subject: { select: { title: true } } } } } } as const;

export async function loadMyDoubts(studentId: string, userId: string): Promise<MyDoubtItem[]> {
  const [doubts, questions, photoDoubts] = await Promise.all([
    prisma.doubt.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        subject: true,
        body: true,
        attachmentUrl: true,
        status: true,
        createdAt: true,
        expertExplanation: true,
        videoTimestampSec: true,
        sourceMessageId: true,
        resolvedBy: { select: { name: true } },
        batchSchedule: scheduleSelect,
        whiteboardSession: { select: { batchSchedule: scheduleSelect } },
      },
    }),
    prisma.whiteboardMessage.findMany({
      where: { authorUserId: userId, flaggedAsQuestion: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        body: true,
        createdAt: true,
        whiteboardSession: { select: { batchSchedule: scheduleSelect } },
        replies: {
          where: { deletedAt: null, authorRole: { not: "STUDENT" } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { body: true, authorName: true },
        },
      },
    }),
    prisma.handRaiseEvent.findMany({
      where: { studentId, imageUrl: { not: null } },
      orderBy: { raisedAt: "desc" },
      take: 100,
      select: {
        id: true,
        imageUrl: true,
        status: true,
        raisedAt: true,
        whiteboardSession: { select: { batchSchedule: scheduleSelect } },
      },
    }),
  ]);

  // A live-class question the teacher turned into a doubt shows once, as the doubt.
  const converted = new Set(doubts.map((d) => d.sourceMessageId).filter(Boolean));

  const items: MyDoubtItem[] = [
    ...doubts.map((d): MyDoubtItem => {
      const liveSchedule = d.whiteboardSession?.batchSchedule;
      const kind: MyDoubtKind = d.batchSchedule ? "RECORDED_CLASS" : liveSchedule ? "LIVE_CLASS" : "ASKED";
      const sched = d.batchSchedule ?? liveSchedule;
      return {
        id: d.id,
        kind,
        subject: canonicalSubject(classSubject(sched) ?? d.subject),
        body: d.body,
        imageUrl: d.attachmentUrl,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        classTitle: sched?.title ?? null,
        videoTimestampSec: d.videoTimestampSec,
        answer: d.expertExplanation,
        answeredBy: d.resolvedBy?.name ?? null,
        href: `/doubts/${d.id}`,
        deletable: kind === "ASKED",
      };
    }),
    ...questions
      .filter((q) => !converted.has(q.id))
      .map((q): MyDoubtItem => {
        const sched = q.whiteboardSession.batchSchedule;
        const reply = q.replies[0];
        return {
          id: `q_${q.id}`,
          kind: "LIVE_CLASS",
          subject: canonicalSubject(classSubject(sched)),
          body: q.body,
          imageUrl: null,
          status: reply ? "ANSWERED" : "ASKED",
          createdAt: q.createdAt.toISOString(),
          classTitle: sched?.title ?? null,
          videoTimestampSec: null,
          answer: reply?.body ?? null,
          answeredBy: reply?.authorName ?? null,
          href: null,
          deletable: false,
        };
      }),
    ...photoDoubts.map((h): MyDoubtItem => {
      const sched = h.whiteboardSession.batchSchedule;
      return {
        id: `h_${h.id}`,
        kind: "LIVE_CLASS",
        subject: canonicalSubject(classSubject(sched)),
        body: "Photo doubt sent in class",
        imageUrl: h.imageUrl,
        // Taken up by the teacher in class = answered there.
        status: h.status === "APPROVED" || h.status === "RESOLVED" ? "ANSWERED" : "ASKED",
        createdAt: h.raisedAt.toISOString(),
        classTitle: sched?.title ?? null,
        videoTimestampSec: null,
        answer: null,
        answeredBy: null,
        href: null,
        deletable: false,
      };
    }),
  ];

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
