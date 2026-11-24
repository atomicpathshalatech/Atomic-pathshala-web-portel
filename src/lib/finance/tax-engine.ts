import { prisma } from "@/lib/prisma";

export interface TaxCalculationInput {
  baseAmount: number; // In Rupees
  studentStateCode?: string; // 2-digit GST state code e.g. "09" (UP), "07" (Delhi), "27" (MH)
  sacHsnCode?: string; // Defaults to educational coaching SAC "999293"
  pricingMode?: "INCLUSIVE" | "EXCLUSIVE";
}

export interface TaxCalculationResult {
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
  isInterState: boolean;
  isGstActive: boolean;
  registrationStatus: string;
  businessGstin: string | null;
  sacHsnCode: string;
  invoiceType: "TAX_INVOICE" | "BILL_OF_SUPPLY";
  explanation: string;
}

export const STATE_CODES_MAP: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "19": "West Bengal",
  "23": "Madhya Pradesh",
  "27": "Maharashtra",
  "29": "Karnataka",
  "33": "Tamil Nadu",
  "36": "Telangana",
};

/**
 * Dynamic Tax Engine for Atomic Pathshala
 * Strictly adheres to Indian GST Law:
 * - If GST status is PENDING, NOT_REGISTERED, or SUSPENDED: Tax rate is 0%, Bill of Supply is issued.
 * - If GST status is ACTIVE: calculates CGST+SGST for intra-state (same state) or IGST for inter-state.
 * - Supports both Inclusive and Exclusive pricing modes without hardcoded rates.
 */
export async function calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
  const {
    baseAmount,
    studentStateCode = "09", // default UP if unknown
    sacHsnCode = "999293",
    pricingMode = "EXCLUSIVE"
  } = input;

  // 1. Fetch current GST Configuration
  let gstSetting = null;
  try {
    gstSetting = await prisma.gstSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    // Fail-safe: if DB is unreachable, default to PENDING (0% tax collection lock)
    gstSetting = null;
  }

  // Default fallback if no settings exist in DB yet
  const status = gstSetting?.registrationStatus || "PENDING";
  const businessStateCode = gstSetting?.gstStateCode || "09";
  const businessGstin = gstSetting?.gstin || null;

  // CRITICAL COMPLIANCE SAFETY LOCK:
  // If status is NOT 'ACTIVE', GST collection is strictly prohibited!
  if (status !== "ACTIVE") {
    return {
      taxableAmount: Math.round(baseAmount * 100) / 100,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTax: 0,
      totalAmount: Math.round(baseAmount * 100) / 100,
      isInterState: false,
      isGstActive: false,
      registrationStatus: status,
      businessGstin: null, // Masked/hidden when not active
      sacHsnCode,
      invoiceType: "BILL_OF_SUPPLY",
      explanation: `GST Registration Status is ${status}. Bill of Supply generated with 0% tax.`,
    };
  }

  // 2. Fetch applicable Tax Rule for SAC code
  const now = new Date();
  const taxRule = await prisma.taxRule.findFirst({
    where: {
      sacHsnCode,
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [
        { effectiveUntil: null },
        { effectiveUntil: { gte: now } }
      ]
    },
    orderBy: { effectiveFrom: "desc" }
  });

  const isExempt = taxRule?.isExempt ?? false;
  const cgstRate = isExempt ? 0 : Number(taxRule?.cgstRate ?? 9.0);
  const sgstRate = isExempt ? 0 : Number(taxRule?.sgstRate ?? 9.0);
  const igstRate = isExempt ? 0 : Number(taxRule?.igstRate ?? 18.0);

  const cleanStudentState = studentStateCode.trim().padStart(2, "0");
  const isInterState = cleanStudentState !== businessStateCode;

  const effectiveTotalRate = isInterState ? igstRate : (cgstRate + sgstRate);

  let taxableAmount = 0;
  let totalTax = 0;
  let totalAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (effectiveTotalRate === 0 || isExempt) {
    taxableAmount = baseAmount;
    totalAmount = baseAmount;
  } else if (pricingMode === "INCLUSIVE") {
    // Base amount already includes GST: taxable = gross / (1 + rate/100)
    taxableAmount = Math.round((baseAmount / (1 + effectiveTotalRate / 100)) * 100) / 100;
    totalAmount = baseAmount;
    totalTax = Math.round((totalAmount - taxableAmount) * 100) / 100;

    if (isInterState) {
      igstAmount = totalTax;
    } else {
      cgstAmount = Math.round((totalTax / 2) * 100) / 100;
      sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
    }
  } else {
    // EXCLUSIVE: Base amount is net taxable amount
    taxableAmount = baseAmount;
    if (isInterState) {
      igstAmount = Math.round((taxableAmount * (igstRate / 100)) * 100) / 100;
      totalTax = igstAmount;
    } else {
      cgstAmount = Math.round((taxableAmount * (cgstRate / 100)) * 100) / 100;
      sgstAmount = Math.round((taxableAmount * (sgstRate / 100)) * 100) / 100;
      totalTax = Math.round((cgstAmount + sgstAmount) * 100) / 100;
    }
    totalAmount = Math.round((taxableAmount + totalTax) * 100) / 100;
  }

  return {
    taxableAmount,
    cgstRate: isInterState ? 0 : cgstRate,
    cgstAmount,
    sgstRate: isInterState ? 0 : sgstRate,
    sgstAmount,
    igstRate: isInterState ? igstRate : 0,
    igstAmount,
    totalTax,
    totalAmount,
    isInterState,
    isGstActive: true,
    registrationStatus: "ACTIVE",
    businessGstin,
    sacHsnCode,
    invoiceType: "TAX_INVOICE",
    explanation: isInterState
      ? `Inter-State Supply to State Code ${cleanStudentState}. IGST applied at ${igstRate}%.`
      : `Intra-State Supply in State Code ${businessStateCode}. CGST (${cgstRate}%) + SGST (${sgstRate}%) applied.`,
  };
}

/**
 * Generates sequential financial year invoice numbers: e.g. "INV/2026-27/0001"
 */
export async function generateSequentialInvoiceNumber(prefix: string = "INV"): Promise<{ invoiceNumber: string; sequence: number }> {
  const currentGst = await prisma.gstSetting.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const fy = currentGst?.currentFinancialYear || "2026-27";
  const seq = currentGst?.nextInvoiceSequence || 1;
  const pfx = currentGst?.invoicePrefix || prefix;

  const paddedSeq = String(seq).padStart(4, "0");
  const invoiceNumber = `${pfx}/${fy}/${paddedSeq}`;

  // Increment sequence counter
  if (currentGst) {
    await prisma.gstSetting.update({
      where: { id: currentGst.id },
      data: { nextInvoiceSequence: seq + 1 },
    });
  }

  return { invoiceNumber, sequence: seq };
}

/**
 * Generates sequential credit note numbers: e.g. "CN/2026-27/0001"
 */
export async function generateSequentialCreditNoteNumber(prefix: string = "CN"): Promise<{ creditNoteNumber: string; sequence: number }> {
  const currentGst = await prisma.gstSetting.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const fy = currentGst?.currentFinancialYear || "2026-27";
  const seq = currentGst?.nextCreditNoteSequence || 1;
  const pfx = currentGst?.creditNotePrefix || prefix;

  const paddedSeq = String(seq).padStart(4, "0");
  const creditNoteNumber = `${pfx}/${fy}/${paddedSeq}`;

  if (currentGst) {
    await prisma.gstSetting.update({
      where: { id: currentGst.id },
      data: { nextCreditNoteSequence: seq + 1 },
    });
  }

  return { creditNoteNumber, sequence: seq };
}
