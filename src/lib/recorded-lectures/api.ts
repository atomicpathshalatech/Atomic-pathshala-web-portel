import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { RecordedStorageNotConfiguredError } from "./storage";
import { RecordedLectureError } from "./service";
import { SummaryUnavailableError } from "./summary";

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/** Recorded-lecture errors as clear API responses; everything else as usual. */
export function recordedApiError(error: unknown) {
  if (error instanceof RecordedStorageNotConfiguredError) {
    return apiError(
      "Recorded-lecture storage is not set up yet, so uploads are turned off. Ask the Super Admin to add the RECORDED_R2_* settings.",
      503,
      { code: "RECORDED_STORAGE_NOT_CONFIGURED", details: { problems: error.problems } }
    );
  }
  if (error instanceof RecordedLectureError) return apiError(error.message, error.status, error.code ? { code: error.code } : undefined);
  if (error instanceof SummaryUnavailableError) {
    const status = error.code === "AI_NOT_CONFIGURED" ? 503 : error.code === "INSUFFICIENT" ? 422 : error.code === "TIMEOUT" ? 504 : 502;
    return apiError(error.message, status, { code: error.code });
  }
  return handleApiError(error);
}
