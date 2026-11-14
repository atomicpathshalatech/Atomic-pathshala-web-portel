import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  getAgreementByInvitationToken,
  submitEducatorSignature,
} from "@/lib/agreements/agreement-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const submitSignSchema = z.object({
  signedName: z.string().min(2, "Full legal name is required"),
  signatureDataUrl: z.string().optional(),
  signatureMethod: z
    .enum(["ELECTRONIC_DRAWN", "ELECTRONIC_TYPED", "ELECTRONIC_UPLOADED"])
    .default("ELECTRONIC_DRAWN"),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must check the box to confirm you have read and agreed to the terms.",
  }),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const result = await getAgreementByInvitationToken(params.token);
    if (!result.valid || !result.agreement) {
      return apiError(result.error || "Invalid or expired signing link.", 403);
    }

    return apiSuccess({
      agreement: {
        id: result.agreement.id,
        agreementNumber: result.agreement.agreementNumber,
        title: result.agreement.title,
        status: result.agreement.status,
        effectiveDate: result.agreement.effectiveDate,
        expiryDate: result.agreement.expiryDate,
        annualSalary: result.agreement.annualSalary,
        monthlySalary: result.agreement.monthlySalary,
        teachingHoursMonthly: result.agreement.teachingHoursMonthly,
        noticePeriodDays: result.agreement.noticePeriodDays,
        workLocation: result.agreement.workLocation,
        address: result.agreement.address,
        panNumber: result.agreement.panNumber,
        bodyText: result.currentVersion?.contentSnapshot || "",
        stamp: result.agreement.stamp
          ? {
              certificateNumber: result.agreement.stamp.certificateNumber,
              issuingState: result.agreement.stamp.issuingState,
              stampDutyAmount: result.agreement.stamp.stampDutyAmount,
              instrumentCategory: result.agreement.stamp.instrumentCategory,
            }
          : null,
      },
      signer: {
        id: result.signer?.id,
        signerName: result.signer?.signerName,
        signerEmail: result.signer?.signerEmail,
        status: result.signer?.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json();
    const input = submitSignSchema.parse(body);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || undefined;

    await submitEducatorSignature({
      rawToken: params.token,
      signedName: input.signedName.trim(),
      signatureDataUrl: input.signatureDataUrl,
      signatureMethod: input.signatureMethod,
      ipAddress,
      userAgent,
    });

    return apiSuccess({
      message:
        "Agreement successfully signed! It has been submitted to Atomic Pathshala for Director countersignature.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
