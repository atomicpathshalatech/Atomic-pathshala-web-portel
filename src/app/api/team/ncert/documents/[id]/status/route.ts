import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NCERTDocumentStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    if (!status || !Object.values(NCERTDocumentStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updated = await prisma.ncertDocument.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error: any) {
    console.error("[Team NCERT Status API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update status" }, { status: 500 });
  }
}
