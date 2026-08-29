import { NextResponse } from "next/server";
import { requireCurrentUser, UnauthorizedError } from "@/lib/ai-chat/auth";
import { computeDashboardStats } from "@/lib/ai-chat/dashboardStats";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const stats = await computeDashboardStats(user.id);
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    console.error("[Dashboard Stats API]", error);
    return NextResponse.json({ error: "Could not load dashboard stats." }, { status: 500 });
  }
}
