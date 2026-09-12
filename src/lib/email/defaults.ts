// NOTE: deliberately no `import "server-only"` here — this file is pure
// data (no secrets, no DB access) and is imported by prisma/seed.ts, which
// runs as a plain Node script outside Next's bundler where the
// server-only guard throws unconditionally.
import type { EmailCategory } from "@prisma/client";

/**
 * The 10 default templates the spec names. Seeded as editable EmailTemplate
 * rows (see prisma/seed.ts) so an Admin can change wording without a
 * deploy — these objects are also the code-level fallback dispatch.ts
 * callers use if the DB row is ever missing or deactivated, so a template
 * being deleted/disabled can never silently break a transactional email.
 *
 * `{{token}}` placeholders are filled by lib/email/render.ts. Each entry's
 * `variables` list is exactly what the template editor shows as available
 * for that template — keep it in sync with what callers actually pass.
 */
export type DefaultEmailTemplate = {
  key: string;
  name: string;
  category: EmailCategory;
  subject: string;
  bodyHtml: string;
  variables: string[];
};

const WRAP = (inner: string) => `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    ${inner}
  </div>`;

const FOOTER = `
    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0">
      {{institute_name}} · This is an automated message.
    </p>`;

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    key: "registration_credentials",
    name: "Registration Credentials",
    category: "CREDENTIALS",
    subject: "Welcome to {{institute_name}} — Your Registration is Successful",
    variables: [
      "recipient_name",
      "email",
      "login_id",
      "password",
      "login_url",
      "enrollment_number_row",
      "batch_row",
      "institute_name",
    ],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">Welcome to {{institute_name}}, {{recipient_name}}! 🎉</h2>
    <p style="color:#475569;margin:0 0 16px">Your registration has been successfully completed. Your account is now ready to use.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Login ID</td><td style="padding:6px 0;font-weight:600">{{login_id}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Password</td><td style="padding:6px 0;font-weight:600;font-family:monospace">{{password}}</td></tr>
      {{enrollment_number_row}}
      {{batch_row}}
    </table>
    <p style="margin:0 0 20px">
      <a href="{{login_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Log In to {{institute_name}}</a>
    </p>
    <p style="color:#64748b;font-size:13px;margin:0">
      Keep these credentials safe and change your password after your first login.
    </p>
    ${FOOTER}`),
  },
  {
    key: "staff_approval_credentials",
    name: "Staff Approval — Credentials",
    category: "CREDENTIALS",
    subject: "You're approved — Welcome to {{institute_name}}",
    variables: ["recipient_name", "role_label", "department", "email", "login_id", "password", "login_url", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">Congratulations, {{recipient_name}}!</h2>
    <p style="color:#475569;margin:0 0 16px">Your application to join {{institute_name}} has been approved.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Role / Position</td><td style="padding:6px 0;font-weight:600">{{role_label}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Department</td><td style="padding:6px 0;font-weight:600">{{department}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Login ID</td><td style="padding:6px 0;font-weight:600">{{login_id}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Temporary Password</td><td style="padding:6px 0;font-weight:600;font-family:monospace">{{password}}</td></tr>
    </table>
    <p style="margin:0 0 20px">
      <a href="{{login_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Log In to {{institute_name}}</a>
    </p>
    <p style="color:#64748b;font-size:13px;margin:0">
      For your security, please change this password after your first login. Never share it with anyone.
    </p>
    ${FOOTER}`),
  },
  {
    key: "password_reset_confirmation",
    name: "Password Reset",
    category: "PASSWORD_RESET",
    subject: "Your {{institute_name}} password was changed",
    variables: ["recipient_name", "login_id", "login_url", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">Password changed</h2>
    <p style="color:#475569;margin:0 0 16px">Hi {{recipient_name}}, your password for login ID <b>{{login_id}}</b> was just changed. Your previous password no longer works.</p>
    <p style="margin:0 0 20px">
      <a href="{{login_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Log In</a>
    </p>
    <p style="color:#64748b;font-size:13px;margin:0">
      If you didn't request this change, contact your Founder, Coordinator, or Administrator immediately.
    </p>
    ${FOOTER}`),
  },
  {
    key: "welcome_enrollment",
    name: "Welcome / Enrollment",
    category: "ENROLLMENT",
    subject: "Welcome to {{course_name}}, {{student_name}}!",
    variables: ["student_name", "course_name", "teacher_name", "enrollment_date", "start_date", "login_url", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">You're enrolled, {{student_name}}! 🎉</h2>
    <p style="color:#475569;margin:0 0 16px">You now have access to <b>{{course_name}}</b>{{teacher_name_line}}.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Enrolled on</td><td style="padding:6px 0;font-weight:600">{{enrollment_date}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Starts</td><td style="padding:6px 0;font-weight:600">{{start_date}}</td></tr>
    </table>
    <p style="margin:0 0 20px">
      <a href="{{login_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Go to Dashboard</a>
    </p>
    ${FOOTER}`),
  },
  {
    key: "batch_enrollment",
    name: "Batch Enrollment",
    category: "ENROLLMENT",
    subject: "You're enrolled in {{batch_name}}",
    variables: ["student_name", "batch_name", "teacher_name", "enrollment_date", "start_date", "login_url", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">Welcome to {{batch_name}}, {{student_name}}! 🎉</h2>
    <p style="color:#475569;margin:0 0 16px">You've been enrolled in the batch <b>{{batch_name}}</b>{{teacher_name_line}}.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Enrolled on</td><td style="padding:6px 0;font-weight:600">{{enrollment_date}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Batch starts</td><td style="padding:6px 0;font-weight:600">{{start_date}}</td></tr>
    </table>
    <p style="margin:0 0 20px">
      <a href="{{login_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Go to Dashboard</a>
    </p>
    ${FOOTER}`),
  },
  {
    key: "test_series_enrollment",
    name: "Test Series Enrollment",
    category: "ENROLLMENT",
    subject: "You're enrolled in {{test_series_name}}",
    variables: ["student_name", "test_series_name", "enrollment_date", "login_url", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">Test Series unlocked, {{student_name}}! 📝</h2>
    <p style="color:#475569;margin:0 0 16px">You now have access to <b>{{test_series_name}}</b>, effective {{enrollment_date}}.</p>
    <p style="margin:0 0 20px">
      <a href="{{login_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Start Practicing</a>
    </p>
    ${FOOTER}`),
  },
  {
    key: "upgrade_confirmation",
    name: "Upgrade Confirmation",
    category: "ENROLLMENT",
    subject: "Your upgrade to {{batch_name}} is confirmed",
    variables: ["student_name", "batch_name", "course_name", "enrollment_date", "login_url", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">Upgrade confirmed, {{student_name}}! 🚀</h2>
    <p style="color:#475569;margin:0 0 16px">You've been upgraded to <b>{{batch_name}}</b>, effective {{enrollment_date}}. Your new plan is already active.</p>
    <p style="margin:0 0 20px">
      <a href="{{login_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Go to Dashboard</a>
    </p>
    ${FOOTER}`),
  },
  {
    key: "promotional_email",
    name: "Promotional Email",
    category: "PROMOTIONAL",
    subject: "{{subject_line}}",
    variables: ["recipient_name", "subject_line", "body_content", "cta_label", "cta_url", "institute_name"],
    bodyHtml: WRAP(`
    <p style="margin:0 0 16px">Hi {{recipient_name}},</p>
    <div style="margin:0 0 20px">{{body_content}}</div>
    <p style="margin:0 0 20px">
      <a href="{{cta_url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">{{cta_label}}</a>
    </p>
    ${FOOTER}`),
  },
  {
    key: "festival_greeting",
    name: "Festival Greeting",
    category: "ANNOUNCEMENT",
    subject: "{{festival_name}} greetings from {{institute_name}}!",
    variables: ["recipient_name", "festival_name", "body_content", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">Happy {{festival_name}}, {{recipient_name}}! 🎉</h2>
    <div style="color:#475569;margin:0 0 16px">{{body_content}}</div>
    <p style="margin:0">— The {{institute_name}} Team</p>
    ${FOOTER}`),
  },
  {
    key: "birthday_greeting",
    name: "Birthday Greeting",
    category: "BIRTHDAY",
    subject: "🎂 Happy Birthday, {{recipient_name}}!",
    variables: ["recipient_name", "body_content", "institute_name"],
    bodyHtml: WRAP(`
    <h2 style="margin:0 0 4px">🎂 Happy Birthday, {{recipient_name}}! 🎉</h2>
    <div style="color:#475569;white-space:pre-line;margin:0 0 16px">{{body_content}}</div>
    <p style="margin:0">— The {{institute_name}} Team</p>
    ${FOOTER}`),
  },
  {
    key: "custom_announcement",
    name: "Custom Announcement",
    category: "ANNOUNCEMENT",
    subject: "{{subject_line}}",
    variables: ["recipient_name", "subject_line", "body_content", "institute_name"],
    bodyHtml: WRAP(`
    <p style="margin:0 0 16px">Hi {{recipient_name}},</p>
    <div style="margin:0 0 20px">{{body_content}}</div>
    <p style="margin:0">— The {{institute_name}} Team</p>
    ${FOOTER}`),
  },
];

export function getDefaultTemplate(key: string): DefaultEmailTemplate | undefined {
  return DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key);
}
