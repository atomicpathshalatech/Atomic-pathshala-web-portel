import "server-only";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { Prisma, type IdCard, type IdCardKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/email/app-url";
import { getLogoDataUri } from "@/lib/logo";
import { formatEnrollmentNumber } from "@/lib/utils/id-generator";
import {
  academicYearLabel,
  formatCardDate,
  isValidPublicToken,
  maskIdentifier,
  safeImageUrl,
  verificationState,
  type VerificationState,
} from "./format";
import { qrSvg } from "./qr";
import { renderIdCardHtml, type IdCardModel, type IdCardRow } from "./render";

/**
 * Where every value on an ID card comes from (nothing is copied into the
 * IdCard row — it is read live, so a new photo, batch or rank shows at once):
 *
 * Student  name / photo / mobile / email ... User
 *          enrollment no. .................. Student.enrollmentNumber (separators removed for display)
 *          course ........................... latest ACTIVE batch's targetExam, else Student.targetExam
 *          batch ............................ latest ACTIVE BatchEnrollment → Batch.name
 *          academic year .................... that batch's start/end years, else the Apr–Mar session of the enrolment
 *          date of birth .................... Student.dob
 *          member since ..................... Student.createdAt (registration — when the enrollment no. was issued)
 *          rank badge ....................... latest analysed test: live rank among submitted attempts (same rule
 *                                             as the test analysis page); hidden when there is none
 * Team     name / photo ..................... User
 *          employee ID ...................... Teacher.employeeCode, else IdCard.employeeCode (assigned by an admin)
 *          date of birth .................... Teacher.dob (row hidden when not set)
 *          designation ...................... User.position (admin-managed), else "<subjects> Educator" for a teacher
 *          department ....................... User.department, else Teacher.department (unless "Unassigned")
 *          member since ..................... User.contractStart (the joining date HR sets)
 */

export const SIGNATORY_NAME = "Firoz Ali";

const NON_TEAM_ROLES = new Set(["STUDENT", "PARENT", "GUEST"]);

export function newPublicToken(): string {
  return randomBytes(16).toString("base64url"); // 22 chars, 128 bits
}

export function verifyUrlFor(token: string): string {
  return `${getAppBaseUrl()}/verify/${token}`;
}

/** True when the id_cards table has not been migrated yet. */
export function isMissingTable(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022");
}

/** The person's card row, created (with a fresh random token) on first use. Null until the migration has run. */
export async function getOrCreateIdCard(userId: string, kind: IdCardKind): Promise<IdCard | null> {
  try {
    const existing = await prisma.idCard.findUnique({ where: { userId_kind: { userId, kind } } });
    if (existing) return existing;
    try {
      const created = await prisma.idCard.create({
        data: { userId, kind, publicToken: newPublicToken(), showPhotoPublicly: kind === "TEAM" },
      });
      await prisma.auditLog
        .create({ data: { userId, action: "ID_CARD_ISSUED", entityType: "IdCard", entityId: created.id, metadata: { kind } } })
        .catch(() => undefined);
      return created;
    } catch (err) {
      // Two tabs opening the card at once — the other request created it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return prisma.idCard.findUnique({ where: { userId_kind: { userId, kind } } });
      }
      throw err;
    }
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

export type CardRequirement = { key: string; label: string; who: "self" | "admin" };

export type LoadedCard = {
  kind: IdCardKind;
  userId: string;
  /** Null only while the id_cards migration has not been applied. */
  card: IdCard | null;
  /** Hard reasons this person can't have a card at all (not a student / not active staff). */
  ineligible: string | null;
  /** What is still missing before the card can be generated. */
  missing: CardRequirement[];
  /** The card itself — only when eligible, nothing missing and the card row exists. */
  model: IdCardModel | null;
  /** Context shown next to the card (not printed on it). */
  context: { rankSource: string | null };
  name: string;
  photoUrl: string | null;
};

/** Live internal test rank for the student's latest analysed test (never an official NEET rank). */
async function latestTestRank(studentId: string) {
  const latest = await prisma.testAttemptAnalysis.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: { testId: true, score: true, createdAt: true },
  });
  if (!latest) return null;
  const finalized = { testId: latest.testId, status: { in: ["SUBMITTED" as const, "AUTO_SUBMITTED" as const] } };
  const [ahead, total, test] = await Promise.all([
    prisma.attempt.count({ where: { ...finalized, score: { gt: latest.score } } }),
    prisma.attempt.count({ where: finalized }),
    prisma.test.findUnique({ where: { id: latest.testId }, select: { name: true } }),
  ]);
  if (total < 2) return null; // "1 of 1" says nothing
  return { rank: ahead + 1, total, testName: test?.name ?? "Test", date: latest.createdAt };
}

export async function loadStudentCard(where: { userId: string } | { studentId: string }): Promise<LoadedCard | null> {
  const student = await prisma.student.findUnique({
    where: "userId" in where ? { userId: where.userId } : { id: where.studentId },
    select: {
      id: true,
      userId: true,
      enrollmentNumber: true,
      dob: true,
      targetExam: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true, phone: true, photoUrl: true, status: true } },
      batchEnrollments: {
        where: { status: "ACTIVE" },
        orderBy: { enrolledAt: "desc" },
        take: 1,
        select: { enrolledAt: true, batch: { select: { name: true, targetExam: true, startDate: true, endDate: true } } },
      },
    },
  });
  if (!student) return null;

  const photoUrl = safeImageUrl(student.user.photoUrl);
  const ineligible =
    student.user.status !== "ACTIVE"
      ? "This account is not active."
      : student.status === "DROPPED"
      ? "This student is no longer enrolled."
      : null;
  const missing: CardRequirement[] = [];
  if (!photoUrl) missing.push({ key: "photo", label: "Profile photo", who: "self" });

  const [card, rank] = await Promise.all([getOrCreateIdCard(student.userId, "STUDENT"), latestTestRank(student.id).catch(() => null)]);

  const base = { kind: "STUDENT" as const, userId: student.userId, card, ineligible, missing, name: student.user.name, photoUrl };
  const rankSource = rank ? `${rank.testName} · ${formatCardDate(rank.date)} · rank among ${rank.total} who submitted` : null;
  if (ineligible || missing.length || !card) return { ...base, model: null, context: { rankSource } };

  const enrollment = student.batchEnrollments[0];
  const rows: IdCardRow[] = [
    { icon: "cap", label: "Course", value: enrollment?.batch.targetExam || student.targetExam || "—" },
  ];
  if (enrollment) rows.push({ icon: "layers", label: "Batch", value: enrollment.batch.name });
  rows.push({
    icon: "calendar",
    label: "Academic Year",
    value: academicYearLabel({
      batchStart: enrollment?.batch.startDate ?? null,
      batchEnd: enrollment?.batch.endDate ?? null,
      fallbackDate: enrollment?.enrolledAt ?? student.createdAt,
    }),
  });
  const dob = formatCardDate(student.dob);
  if (dob) rows.push({ icon: "gift", label: "Date of Birth", value: dob });
  if (student.user.phone) rows.push({ icon: "phone", label: "Mobile No.", value: student.user.phone });
  rows.push({ icon: "mail", label: "Email", value: student.user.email });
  rows.push({ icon: "calendarCheck", label: "Member Since", value: formatCardDate(student.createdAt) ?? "—" });

  const verifyUrl = verifyUrlFor(card.publicToken);
  return {
    ...base,
    context: { rankSource },
    model: {
      kind: "STUDENT",
      name: student.user.name,
      photoUrl,
      badge: null,
      enrollmentNumber: formatEnrollmentNumber(student.enrollmentNumber),
      rows,
      rank: rank ? { title: "Test Rank", value: `#${rank.rank}`, sub: `of ${rank.total}` } : null,
      verifyUrl,
      qrSvg: qrSvg(verifyUrl),
      revoked: card.status === "REVOKED",
    },
  };
}

export function teamDesignation(position: string | null, subjects: string[] | null | undefined): string | null {
  if (position?.trim()) return position.trim();
  const s = (subjects ?? []).map((x) => x.trim()).filter(Boolean);
  return s.length ? `${s.slice(0, 2).join(" & ")} Educator` : null;
}

export async function loadTeamCard(userId: string): Promise<LoadedCard | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      status: true,
      department: true,
      position: true,
      contractStart: true,
      role: { select: { name: true } },
      teacher: { select: { employeeCode: true, dob: true, department: true, subjects: true } },
    },
  });
  if (!user) return null;

  const photoUrl = safeImageUrl(user.photoUrl);
  const ineligible =
    !user.role || NON_TEAM_ROLES.has(user.role.name)
      ? "Only Atomic Pathshala team members have a team ID card."
      : user.status !== "ACTIVE"
      ? "This team account is not active."
      : null;

  const card = ineligible ? await prisma.idCard.findUnique({ where: { userId_kind: { userId, kind: "TEAM" } } }).catch(() => null) : await getOrCreateIdCard(userId, "TEAM");
  const employeeCode = user.teacher?.employeeCode || card?.employeeCode || null;
  const designation = teamDesignation(user.position, user.teacher?.subjects);
  const department = user.department?.trim() || (user.teacher?.department && user.teacher.department !== "Unassigned" ? user.teacher.department : null);

  const missing: CardRequirement[] = [];
  if (!photoUrl) missing.push({ key: "photo", label: "Profile photo", who: "self" });
  if (!employeeCode) missing.push({ key: "employeeCode", label: "Employee ID", who: "admin" });
  if (!designation) missing.push({ key: "designation", label: "Designation", who: "admin" });
  if (!user.contractStart) missing.push({ key: "joining", label: "Joining date (Member Since)", who: "admin" });

  const base = { kind: "TEAM" as const, userId, card, ineligible, missing, name: user.name, photoUrl, context: { rankSource: null } };
  if (ineligible || missing.length || !card) return { ...base, model: null };

  const rows: IdCardRow[] = [{ icon: "id", label: "Employee ID", value: employeeCode! }];
  const dob = formatCardDate(user.teacher?.dob ?? null);
  if (dob) rows.push({ icon: "gift", label: "Date of Birth", value: dob });
  rows.push({ icon: "briefcase", label: "Designation", value: designation! });
  if (department) rows.push({ icon: "users", label: "Department", value: department });
  rows.push({ icon: "calendarCheck", label: "Member Since", value: formatCardDate(user.contractStart)! });

  const verifyUrl = verifyUrlFor(card.publicToken);
  return {
    ...base,
    model: {
      kind: "TEAM",
      name: user.name,
      photoUrl,
      badge: designation,
      enrollmentNumber: null,
      rows,
      rank: null,
      verifyUrl,
      qrSvg: qrSvg(verifyUrl),
      revoked: card.status === "REVOKED",
    },
  };
}

export function loadCard(kind: IdCardKind, userId: string) {
  return kind === "STUDENT" ? loadStudentCard({ userId }) : loadTeamCard(userId);
}

const SIGNATURE_FILES: [string, string][] = [
  ["signature.png", "image/png"],
  ["signature.webp", "image/webp"],
  ["signature.jpg", "image/jpeg"],
];
let signatureCache: { file: string; dataUri: string } | null | undefined;

/** Firoz Ali's approved signature, public/brand/signature.(png|webp|jpg), read once. */
function signatureFile(): { file: string; dataUri: string } | null {
  if (signatureCache !== undefined) return signatureCache;
  signatureCache = null;
  for (const [file, mime] of SIGNATURE_FILES) {
    const p = path.join(process.cwd(), "public", "brand", file);
    if (fs.existsSync(p)) {
      signatureCache = { file, dataUri: `data:${mime};base64,${fs.readFileSync(p).toString("base64")}` };
      break;
    }
  }
  return signatureCache;
}

/**
 * The signature on the card: the approved image in public/brand (or the
 * ID_CARD_SIGNATURE_URL image); without one, the name is set in a script face.
 */
function signatureSrc(mode: "screen" | "pdf"): string | null {
  const local = signatureFile();
  if (local) return mode === "pdf" ? local.dataUri : `/brand/${local.file}`;
  return safeImageUrl(process.env.ID_CARD_SIGNATURE_URL);
}

export function cardHtml(model: IdCardModel, mode: "screen" | "pdf"): string {
  return renderIdCardHtml(model, {
    mode,
    // The PDF is printed from a blank document, so the logo is inlined; the preview (an srcdoc iframe) resolves the site path.
    logoSrc: mode === "pdf" ? getLogoDataUri() : "/brand/logo.png",
    signatureSrc: signatureSrc(mode),
    signatoryName: SIGNATORY_NAME,
  });
}

export type PublicVerification = {
  kind: IdCardKind;
  state: VerificationState;
  name: string;
  photoUrl: string | null;
  lines: { label: string; value: string }[];
  checkedAt: Date;
};

/**
 * What the public QR page may show — the minimum needed to confirm identity.
 * Never DOB, mobile, email, address or academic records; the student
 * enrollment number is masked; the photo only with the owner's consent.
 */
export async function loadPublicVerification(token: string): Promise<PublicVerification | null> {
  if (!isValidPublicToken(token)) return null;
  let card;
  try {
    card = await prisma.idCard.findUnique({
      where: { publicToken: token },
      select: {
        kind: true,
        status: true,
        showPhotoPublicly: true,
        employeeCode: true,
        user: {
          select: {
            name: true,
            photoUrl: true,
            status: true,
            position: true,
            department: true,
            contractStart: true,
            role: { select: { name: true } },
            teacher: { select: { employeeCode: true, subjects: true, department: true } },
            student: {
              select: {
                enrollmentNumber: true,
                status: true,
                targetExam: true,
                batchEnrollments: {
                  where: { status: "ACTIVE" },
                  orderBy: { enrolledAt: "desc" },
                  take: 1,
                  select: { enrolledAt: true, batch: { select: { name: true, targetExam: true, startDate: true, endDate: true } } },
                },
                createdAt: true,
              },
            },
          },
        },
      },
    });
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
  if (!card) return null;
  const u = card.user;
  const hasRole = Boolean(u.role && !NON_TEAM_ROLES.has(u.role.name));
  const state = verificationState({
    kind: card.kind,
    cardStatus: card.status,
    userStatus: u.status,
    hasRole,
    studentStatus: u.student?.status ?? null,
  });
  const showDetails = state !== "REVOKED";
  const lines: { label: string; value: string }[] = [];
  if (showDetails && card.kind === "TEAM") {
    const designation = teamDesignation(u.position, u.teacher?.subjects);
    const department = u.department?.trim() || (u.teacher?.department && u.teacher.department !== "Unassigned" ? u.teacher.department : null);
    const emp = u.teacher?.employeeCode || card.employeeCode;
    if (designation) lines.push({ label: "Designation", value: designation });
    if (department) lines.push({ label: "Department", value: department });
    if (emp) lines.push({ label: "Employee ID", value: emp });
    const since = formatCardDate(u.contractStart);
    if (since) lines.push({ label: "Member since", value: since });
  }
  if (showDetails && card.kind === "STUDENT" && u.student) {
    const e = u.student.batchEnrollments[0];
    lines.push({ label: "Enrollment no.", value: maskIdentifier(formatEnrollmentNumber(u.student.enrollmentNumber)) });
    lines.push({ label: "Course", value: e?.batch.targetExam || u.student.targetExam || "—" });
    if (e) lines.push({ label: "Batch", value: e.batch.name });
    lines.push({
      label: "Academic year",
      value: academicYearLabel({ batchStart: e?.batch.startDate ?? null, batchEnd: e?.batch.endDate ?? null, fallbackDate: e?.enrolledAt ?? u.student.createdAt }),
    });
  }
  return {
    kind: card.kind,
    state,
    name: u.name,
    photoUrl: showDetails && card.showPhotoPublicly ? safeImageUrl(u.photoUrl) : null,
    lines,
    checkedAt: new Date(),
  };
}
