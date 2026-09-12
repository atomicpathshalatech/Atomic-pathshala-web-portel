import "server-only";
import { randomInt } from "crypto";
import { renderEmailTemplate } from "./templates";
import { dispatchEmail } from "./dispatch";

/**
 * A temporary password to hand to a newly-created account. Login here is by
 * email/phone + password (there is no separate "Login ID" credential in
 * this system) — the email still calls it out as "Login ID" using the
 * user's email, since that IS what they type in, per the spec's wording.
 *
 * bcrypt only ever stores a hash (Student.passwordHash / User.passwordHash
 * — see lib/auth.ts), so the ORIGINAL password a user chose can never be
 * recovered to email later. Every credential email this module sends is
 * therefore for an account whose password we are setting for them right
 * now (admin-created student/staff), never a retroactive "here's your
 * existing password" — that's not something bcrypt allows, by design.
 *
 * Charset avoids visually ambiguous characters (0/O, 1/l/I) since this is
 * read off an email and typed on a phone keyboard. Satisfies the app's
 * existing password rule (8+ chars, an uppercase letter, a digit — see
 * otpRegisterSchema in api/students/register/route.ts) with room to spare.
 */
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[randomInt(0, CHARSET.length)];
  }
  return out;
}

export type CredentialsEmailInput = {
  idempotencyKey: string;
  recipientUserId: string;
  recipientType: "STUDENT" | "STAFF";
  fullName: string;
  email: string;
  password: string;
  loginUrl: string;
  /** Student-only extras — rendered as extra table rows when present, and
   * simply omitted (see renderTemplate()'s "unknown token -> empty string"
   * behaviour) when not. Staff approval never sets these. */
  enrollmentNumber?: string;
  batchName?: string;
};

function tableRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">${label}</td><td style="padding:6px 0;font-weight:600">${value}</td></tr>`;
}

/**
 * Section 1 of the spec: student registration -> credential email. Never
 * throws — a failure here must not roll back the account that was just
 * created. Staff approval uses the separate sendStaffApprovalEmail() below
 * instead, since it needs role/department content this template has no use
 * for.
 */
export async function sendCredentialsEmail(input: CredentialsEmailInput) {
  const { subject, html, templateId } = await renderEmailTemplate("registration_credentials", {
    recipient_name: input.fullName,
    email: input.email,
    login_id: input.email,
    password: input.password,
    login_url: input.loginUrl,
    enrollment_number_row: input.enrollmentNumber ? tableRow("Enrollment Number", input.enrollmentNumber) : "",
    batch_row: input.batchName ? tableRow("Batch", input.batchName) : "",
  });

  return dispatchEmail({
    idempotencyKey: input.idempotencyKey,
    to: input.email,
    recipientName: input.fullName,
    recipientUserId: input.recipientUserId,
    recipientType: input.recipientType,
    emailType: "CREDENTIALS",
    subject,
    html,
    templateId,
  });
}

export type StaffApprovalEmailInput = {
  idempotencyKey: string;
  recipientUserId: string;
  fullName: string;
  email: string;
  password: string;
  loginUrl: string;
  /** The actual role/department the admin assigned — never hard-coded, see
   * the "staff_approval_credentials" template in lib/email/defaults.ts. */
  roleLabel: string;
  department: string;
};

/**
 * Section 2/4 of the spec: the ONE credentials email a staff/teacher
 * account gets, sent exactly once at the genuine APPROVAL_PENDING -> ACTIVE
 * transition (see both call sites: the invitations-approve route and the
 * team/users PATCH route, which share this function and the same
 * idempotency-key convention so only one of them ever actually sends it).
 */
export async function sendStaffApprovalEmail(input: StaffApprovalEmailInput) {
  const { subject, html, templateId } = await renderEmailTemplate("staff_approval_credentials", {
    recipient_name: input.fullName,
    role_label: input.roleLabel,
    department: input.department,
    email: input.email,
    login_id: input.email,
    password: input.password,
    login_url: input.loginUrl,
  });

  return dispatchEmail({
    idempotencyKey: input.idempotencyKey,
    to: input.email,
    recipientName: input.fullName,
    recipientUserId: input.recipientUserId,
    recipientType: "STAFF",
    emailType: "CREDENTIALS",
    subject,
    html,
    templateId,
  });
}
