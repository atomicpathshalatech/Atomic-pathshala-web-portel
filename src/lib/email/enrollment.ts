import "server-only";
import { renderEmailTemplate } from "./templates";
import { dispatchEmail } from "./dispatch";
import { getLoginUrl } from "./app-url";

export type EnrollmentKind = "BATCH" | "TEST_SERIES" | "UPGRADE" | "GENERAL";

const TEMPLATE_KEY_BY_KIND: Record<EnrollmentKind, string> = {
  BATCH: "batch_enrollment",
  TEST_SERIES: "test_series_enrollment",
  UPGRADE: "upgrade_confirmation",
  GENERAL: "welcome_enrollment",
};

export type NotifyEnrollmentInput = {
  /** Unique per real-world event — e.g. `enrollment:<batchEnrollmentId>`, `enrollment:<subscriptionId>`. Reusing the same key on a retry is what makes this idempotent. */
  idempotencyKey: string;
  kind: EnrollmentKind;
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  /** The actual enrolled product's name, pulled from the DB record that triggered this — never hard-coded by the caller. */
  productName: string;
  teacherName?: string | null;
  courseName?: string | null;
  enrollmentDate?: Date;
  startDate?: Date | null;
};

const dateFmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Section 3 of the spec: one trigger for every "the student just gained
 * access to something" event (batch enrollment/purchase, test series,
 * course, upgrade, teacher assignment). Callers pass a `kind` to pick the
 * right template and the actual enrolled name from whatever record
 * triggered the call — this function never invents a product name.
 */
export async function notifyEnrollment(input: NotifyEnrollmentInput) {
  if (!input.studentEmail) {
    console.info(`[email] enrollment notify skipped — no email on file (${input.idempotencyKey})`);
    return { outcome: "skipped" as const, reason: "NO_EMAIL" };
  }

  const templateKey = TEMPLATE_KEY_BY_KIND[input.kind];
  const enrollmentDate = input.enrollmentDate ?? new Date();

  const vars = {
    student_name: input.studentName,
    batch_name: input.productName,
    test_series_name: input.productName,
    course_name: input.courseName ?? input.productName,
    teacher_name: input.teacherName ?? undefined,
    teacher_name_line: input.teacherName ? ` with ${input.teacherName}` : "",
    enrollment_date: dateFmt(enrollmentDate),
    start_date: input.startDate ? dateFmt(input.startDate) : "Immediately",
    login_url: getLoginUrl(),
  };

  const { subject, html, templateId } = await renderEmailTemplate(templateKey, vars);

  return dispatchEmail({
    idempotencyKey: input.idempotencyKey,
    to: input.studentEmail,
    recipientName: input.studentName,
    recipientUserId: input.studentUserId,
    recipientType: "STUDENT",
    emailType: "ENROLLMENT",
    subject,
    html,
    templateId,
  });
}
