import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { recordLedgerEntry } from "@/lib/finance/ledger-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_READ);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const approvalStatus = searchParams.get("approvalStatus");
    const paymentStatus = searchParams.get("paymentStatus");

    const expenses = await prisma.expense.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(approvalStatus ? { approvalStatus } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
      },
      include: {
        bankAccount: {
          select: {
            accountName: true,
            bankName: true,
            accountNumberMasked: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ expenses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_EXPENSE_MANAGE);

    const body = await request.json();
    const {
      category,
      title,
      description,
      vendorName,
      vendorGstin,
      vendorPan,
      invoiceNumber,
      invoiceDate,
      amount,
      gstAmount = 0,
      tdsAmount = 0,
      paymentMethod = "BANK_TRANSFER",
      bankAccountId,
      receiptUrl,
    } = body;

    if (!title || !vendorName || !amount) {
      return handleApiError(new Error("Title, vendor name, and amount are required"));
    }

    const baseAmount = Number(amount);
    const tax = Number(gstAmount || 0);
    const tds = Number(tdsAmount || 0);
    const totalAmount = Math.round((baseAmount + tax - tds) * 100) / 100;

    // Generate sequence number: EXP-2026-0001
    const count = await prisma.expense.count();
    const year = new Date().getFullYear();
    const expenseNumber = `EXP-${year}-${String(count + 1).padStart(4, "0")}`;

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        category: category || "OTHER",
        title,
        description,
        vendorName,
        vendorGstin,
        vendorPan,
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        amount: baseAmount,
        gstAmount: tax,
        tdsAmount: tds,
        totalAmount,
        paymentMethod,
        paymentStatus: "PENDING",
        approvalStatus: "PENDING",
        bankAccountId,
        receiptUrl,
        createdById: session.user.id,
      },
    });

    return apiSuccess({ expense, message: "Expense submitted for approval" });
  } catch (error) {
    return handleApiError(error);
  }
}
