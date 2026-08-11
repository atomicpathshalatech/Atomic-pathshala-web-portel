import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/guard";
import { SubscriptionError } from "@/server/services/subscription-service";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: string; issues?: Record<string, string[]> };

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json<ApiFailure>({ success: false, error: message }, { status });
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

  if (error instanceof Error) {
    // Log full detail server-side; never expose internals to the client.
    console.error("[api_error]", error);
    return apiError("Something went wrong. Please try again.", 500);
  }

  console.error("[api_error:unknown]", error);
  return apiError("An unexpected error occurred.", 500);
}
