import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { forgotPasswordEmailSchema } from "@/lib/validation/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

// Shown when the email has no account, or has one but never set a security
// question at registration (it was optional client-side) — so the
// response shape never reveals account existence. Carrying on with this
// generic question just means the verify step fails at the next step,
// same as any other wrong answer would.
const GENERIC_QUESTION = "What is your favorite subject?";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = forgotPasswordEmailSchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { securityQuestion: true },
    });

    return apiSuccess({ securityQuestion: user?.securityQuestion ?? GENERIC_QUESTION });
  } catch (error) {
    return handleApiError(error);
  }
}
