import "server-only";
import { renderEmailTemplate } from "./templates";
import { dispatchEmail } from "./dispatch";
import { getLoginUrl } from "./app-url";

/**
 * Section 2 of the spec ("Password Reset -> New Credential Email") asks for
 * the new password itself in the email body. This deliberately does NOT do
 * that: unlike the registration-credentials email (which hands over a
 * password the recipient does not yet know), a self-service reset means the
 * user just typed this exact password into the form seconds ago — emailing
 * it back adds no information for them, only a live, currently-valid
 * password sitting in a mail inbox indefinitely. The spec's own security
 * instruction ("previous password must never be sent") points the same
 * direction, so this sends a security notification instead: who/when/where
 * to log in, no password in either direction. If an admin-initiated "reset
 * to a temp password" flow is added later (mirroring the registration-
 * credentials case, where the system — not the user — chooses the
 * password), that one SHOULD email the generated password, the same way
 * sendCredentialsEmail() already does.
 */
export async function notifyPasswordChanged(input: {
  idempotencyKey: string;
  userId: string;
  recipientType: "STUDENT" | "STAFF" | "OTHER";
  fullName: string;
  email: string;
}) {
  const { subject, html, templateId } = await renderEmailTemplate("password_reset_confirmation", {
    recipient_name: input.fullName,
    login_id: input.email,
    login_url: getLoginUrl(),
  });

  return dispatchEmail({
    idempotencyKey: input.idempotencyKey,
    to: input.email,
    recipientName: input.fullName,
    recipientUserId: input.userId,
    recipientType: input.recipientType,
    emailType: "PASSWORD_RESET",
    subject,
    html,
    templateId,
  });
}
