import { prisma } from "@/lib/prisma";

export interface BankAccountInput {
  accountName: string;
  bankName: string;
  branchName?: string;
  accountType?: "CURRENT" | "SAVINGS" | "ESCROW";
  accountNumber: string; // Full raw number provided on input
  ifscCode: string;
  upiId?: string;
  purpose?: "REVENUE" | "PAYROLL" | "OPERATING" | "TAX";
  isPrimary?: boolean;
  initialBalance?: number;
  notes?: string;
}

/**
 * Utility to mask account numbers (e.g. 1234567890 -> ••••••••7890)
 */
export function maskAccountNumber(acc: string): string {
  const clean = acc.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `••••••••${last4}`;
}

/**
 * Utility to mask PAN (e.g. ABCDE1234F -> •••••1234F)
 */
export function maskPan(pan: string): string {
  const clean = pan.trim().toUpperCase();
  if (clean.length < 5) return clean;
  return `•••••${clean.slice(5)}`;
}

/**
 * Creates a business bank account record with masked storage.
 * GUARANTEE: Never stores online passwords, PINs, or OTPs.
 */
export async function createBusinessBankAccount(input: BankAccountInput) {
  const {
    accountName,
    bankName,
    branchName,
    accountType = "CURRENT",
    accountNumber,
    ifscCode,
    upiId,
    purpose = "OPERATING",
    isPrimary = false,
    initialBalance = 0,
    notes,
  } = input;

  if (!accountNumber || accountNumber.length < 6) {
    throw new Error("Invalid bank account number");
  }

  if (!ifscCode || ifscCode.length !== 11) {
    throw new Error("Invalid IFSC code (must be 11 characters)");
  }

  const masked = maskAccountNumber(accountNumber);

  // If this is set as primary, unset other primaries
  if (isPrimary) {
    await prisma.businessBankAccount.updateMany({
      where: { isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const account = await prisma.businessBankAccount.create({
    data: {
      accountName,
      bankName,
      branchName,
      accountType,
      accountNumberMasked: masked,
      ifscCode: ifscCode.trim().toUpperCase(),
      upiId,
      purpose,
      isPrimary,
      currentBalance: initialBalance,
      notes,
    },
  });

  return account;
}

/**
 * List all business bank accounts with masked presentation.
 */
export async function listBusinessBankAccounts() {
  return prisma.businessBankAccount.findMany({
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });
}
