import "server-only";
import { prisma } from "@/lib/db";
import { renderTemplate } from "./render";
import { getDefaultTemplate } from "./defaults";

const INSTITUTE_NAME = "Atomic Pathshala";

/**
 * Resolves an email template by its stable key — the Admin-edited DB row if
 * one exists and is active, otherwise the built-in default (see
 * lib/email/defaults.ts) so a deleted/deactivated template can never break
 * a transactional email. Renders subject + body with the given variables;
 * `institute_name` is always available without callers having to pass it.
 */
export async function renderEmailTemplate(
  key: string,
  vars: Record<string, string | undefined | null>
): Promise<{ subject: string; html: string; templateId: string | null }> {
  const allVars = { institute_name: INSTITUTE_NAME, ...vars };

  const dbTemplate = await prisma.emailTemplate
    .findUnique({ where: { key } })
    .catch((err) => {
      console.error(`[email] failed to load template "${key}" from DB, using built-in default:`, err);
      return null;
    });

  if (dbTemplate && dbTemplate.isActive) {
    return {
      subject: renderTemplate(dbTemplate.subject, allVars),
      html: renderTemplate(dbTemplate.bodyHtml, allVars),
      templateId: dbTemplate.id,
    };
  }

  const fallback = getDefaultTemplate(key);
  if (!fallback) {
    throw new Error(`No email template registered for key "${key}" (no DB row, no built-in default).`);
  }
  return {
    subject: renderTemplate(fallback.subject, allVars),
    html: renderTemplate(fallback.bodyHtml, allVars),
    templateId: dbTemplate?.id ?? null, // an inactive DB row still gets logged against, if it exists
  };
}
