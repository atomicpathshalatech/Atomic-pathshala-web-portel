import { apiSuccess } from "@/lib/api/response";

/** Re-attempts are practice: proctoring events are accepted but not recorded. */
export async function POST() {
  return apiSuccess({ recorded: false });
}
