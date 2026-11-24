import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getFinancialSummary } from "@/lib/finance/ledger-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_READ);

    const { searchParams } = new URL(request.url);
    const dateFromStr = searchParams.get("dateFrom");
    const dateToStr = searchParams.get("dateTo");

    const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
    const dateTo = dateToStr ? new Date(dateToStr) : undefined;

    const summary = await getFinancialSummary(dateFrom, dateTo);

    // Recent ledger entries
    const recentLedger = await prisma.financeLedgerEntry.findMany({
      take: 20,
      orderBy: { entryDate: "desc" },
    });

    return apiSuccess({
      summary,
      recentLedger,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
