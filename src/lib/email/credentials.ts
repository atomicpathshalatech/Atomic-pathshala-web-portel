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
};

/**
 * Section 1 of the spec: registration -> credential email. Never throws —
 * a failure here must not roll back the account that was just created.
 */
export async function sendCredentialsEmail(input: CredentialsEmailInput) {
  const { subject, html, templateId } = await renderEmailTemplate("registration_credentials", {
    recipient_name: input.fullName,
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
    recipientType: input.recipientType,
    emailType: "CREDENTIALS",
    subject,
    html,
    templateId,
  });
}
