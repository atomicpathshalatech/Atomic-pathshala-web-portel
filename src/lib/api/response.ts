import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/guard";
import { SubscriptionError } from "@/server/services/subscription-service";
import { BatchOrderError } from "@/server/services/batch-order-service";
import { PaymentGatewayError } from "@/lib/payments/razorpay";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = {
  success: false;
  error: string;
  issues?: Record<string, string[]>;
  // Structured machine-readable error identity for business-rule
  // violations (e.g. chapter sequence locks) — a client that needs to
  // branch on *why* a request failed (not just show the message) can key
  // off `code` instead of parsing `error` text.
  code?: string;
  details?: Record<string, unknown>;
};

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, { status });
}

export function apiError(
  message: string,
  status = 400,
  extra?: { code?: string; details?: Record<string, unknown> }
) {
  return NextResponse.json<ApiFailure>(
    { success: false, error: message, code: extra?.code, details: extra?.details },
    { status }
  );
}

/**
 * Central error translator. Every API route handler should wrap its body
 * in try/catch and pass caught errors here for a consistent shape and
 * correct HTTP status code — never leak raw stack traces to the client.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json<ApiFailure>(
      {
        success: false,
        error: "Validation failed",
        issues: error.flatten().fieldErrors as Record<string, string[]>,
      },
      { status: 422 }
    );
  }

  if (error instanceof UnauthorizedError) {
    return apiError(error.message, 401);
  }

  if (error instanceof ForbiddenError) {
    return apiError(error.message, 403);
  }

  if (error instanceof SubscriptionError) {
    return apiError(error.message, 409);
  }

  if (error instanceof BatchOrderError) {
    return apiError(error.message, 409);
  }

  if (error instanceof PaymentGatewayError) {
    return apiError(error.message, 503, { code: "PAYMENT_GATEWAY_NOT_CONFIGURED" });
  }

  // A raw foreign-key-constraint violation (P2003) used to fall through to
  // the generic 500 below with zero indication of what actually happened —
  // an admin trying to delete something would just see "Something went
  // wrong," with no way to tell that it was really "this still has other
  // records referencing it." Every route with real delete power should
  // ideally clean up its own dependents explicitly (see
  // src/lib/team/resource-delete.ts) rather than rely on this, but this is
  // the honest fallback when something wasn't cleaned up.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    console.error("[api_error:fk_constraint]", error);
    return apiError(
      "This couldn't be deleted because other records still reference it.",
      409,
      { code: "FK_CONSTRAINT" }
    );
  }

  if (error instanceof Error) {
    // Log full detail server-side; never expose internals to the client.
    console.error("[api_error]", error);
    return apiError("Something went wrong. Please try again.", 500);
  }

  console.error("[api_error:unknown]", error);
  return apiError("An unexpected error occurred.", 500);
}
