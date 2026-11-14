import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { sendAgreementEmail, getAgreementSender } from "@/lib/agreements/email-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const testEmailSchema = z.object({
  testEmail: z.string().email("Please enter a valid recipient email address"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canTest =
      (await hasPermission(session.user.id, PERMISSIONS.CONTRACT_CREATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));
    if (!canTest) {
      throw new UnauthorizedError("You do not have permission to test mail systems.");
    }

    const body = await request.json();
    const input = testEmailSchema.parse(body);

    const from = getAgreementSender();
    const startTime = Date.now();

    const result = await sendAgreementEmail({
      recipientEmail: input.testEmail,
      recipientName: "Test Recipient",
      emailType: "TEST",
      subject: `[Diagnostic Test] Atomic Pathshala Agreement Email Delivery (${new Date().toLocaleTimeString("en-IN")})`,
      html: `
        <div style="font-family:sans-serif;padding:24px;color:#0f172a;max-width:540px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#0284c7;margin:0 0 10px 0;">Transactional Email Verification Test</h2>
          <p style="font-size:14px;color:#334155;">
            This is an official diagnostic test email dispatched from <strong>Atomic Pathshala Agreements Module</strong>.
          </p>
          <div style="background:#f8fafc;padding:12px;border-radius:8px;font-size:12px;font-family:monospace;margin:16px 0;">
            <p style="margin:4px 0;">Configured Sender: ${from}</p>
            <p style="margin:4px 0;">Target Recipient: ${input.testEmail}</p>
            <p style="margin:4px 0;">Dispatched At: ${new Date().toISOString()}</p>
          </div>
          <p style="font-size:12px;color:#64748b;">
            If you received this message, the transactional email transport and domain routing are functioning correctly.
          </p>
        </div>
      `,
      text: `Atomic Pathshala Agreement Email Delivery Test\nDispatched to: ${input.testEmail}\nSender: ${from}\nTime: ${new Date().toISOString()}`,
    });

    const durationMs = Date.now() - startTime;

    return apiSuccess({
      delivered: result.delivered,
      providerUsed: result.provider,
      messageId: result.messageId || null,
      error: result.error || null,
      durationMs,
      senderUsed: from,
      diagnosticNote: result.delivered
        ? `Successfully accepted by mail provider (${result.provider.toUpperCase()}) in ${durationMs}ms.`
        : `Email delivery failed: ${result.error}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
