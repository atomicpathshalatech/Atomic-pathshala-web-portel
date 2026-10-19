import { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { allMatchingIds, facetValues, parseLibraryFilters, queryLibrary, type LibrarySort } from "@/lib/pyq/library-query";

/**
 * GET /api/team/pyq/library?exam=<id,id>&years=2023,2024&yearFrom=&yearTo=
 *   &subject=&chapter=&topic=&session=&shift=&paper=&verification=VERIFIED|UNVERIFIED|ALL
 *   &job=<importId>&q=<text>&usable=1&page=1&pageSize=20&sort=year_desc
 *   &mode=ids   -> every matching question id (Select all N matching)
 *   &mode=facets-> values for the dropdowns
 * All filtering happens in the database; the browser only gets one page.
 */
export async function GET(request: NextRequest) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_READ);
    const sp = request.nextUrl.searchParams;
    const filters = parseLibraryFilters(sp);
    const mode = sp.get("mode");
    if (mode === "ids") return apiSuccess(await allMatchingIds(filters));
    if (mode === "facets") return apiSuccess(await facetValues(filters));
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(sp.get("pageSize") || "20", 10) || 20));
    const sort = (["year_desc", "year_asc", "recent", "chapter"].includes(sp.get("sort") || "") ? sp.get("sort") : "year_desc") as LibrarySort;
    return apiSuccess({ filters, ...(await queryLibrary(filters, page, pageSize, sort)) });
  } catch (error) {
    return handleApiError(error);
  }
}
