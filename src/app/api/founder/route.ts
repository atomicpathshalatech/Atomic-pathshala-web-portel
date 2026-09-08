import { getActiveFounder } from "@/lib/founder";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Public endpoint — returns the founder profile only when an admin has
 * marked it active, otherwise `{ founder: null }`. The website/app render
 * nothing rather than a broken section when it's null.
 */
export async function GET() {
  try {
    const founder = await getActiveFounder();
    return apiSuccess({ founder });
  } catch (error) {
    return handleApiError(error);
  }
}
