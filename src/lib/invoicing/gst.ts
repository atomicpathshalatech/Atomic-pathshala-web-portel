/**
 * GST Calculation & Tax Compliance Utility for Atomic Pathshala
 * SAC Code: 999293 (Commercial training and coaching services)
 * Standard GST Rate: 18% (9% CGST + 9% SGST for Intra-state or 18% IGST for Inter-state)
 */

export const COMPANY_GST_DETAILS = {
  legalName: "Atomic Pathshala Education Private Limited",
  brandName: "Atomic Pathshala",
  gstin: process.env.COMPANY_GSTIN || "07AAACA1234A1Z5",
  pan: process.env.COMPANY_PAN || "AAACA1234A",
  sacCode: "999293",
  sacDescription: "Higher Education & Competitive Coaching Services",
  address: "Plot 42, Knowledge Park III, Institutional Area, Greater Noida, UP - 201308, India",
  supportEmail: "billing@atomicpathshala.com",
  stateCode: "07",
  stateName: "Delhi NCR",
};

export type GstBreakdown = {
  grossAmount: number;
  taxableAmount: number;
  gstRatePercent: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  isInterState: boolean;
};

export function calculateGstBreakdown(
  totalInclusiveAmount: number,
  customerStateCode?: string | null
): GstBreakdown {
  const isInterState = Boolean(customerStateCode && customerStateCode !== COMPANY_GST_DETAILS.stateCode);
  const gstRatePercent = 18;

  // Base taxable amount = Total / (1 + 0.18)
  const taxableAmount = Math.round((totalInclusiveAmount / 1.18) * 100) / 100;
  const totalTax = Math.round((totalInclusiveAmount - taxableAmount) * 100) / 100;

  if (isInterState) {
    return {
      grossAmount: totalInclusiveAmount,
      taxableAmount,
      gstRatePercent,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 18,
      igstAmount: totalTax,
      isInterState: true,
    };
  }

  // Intra-state split 9% CGST + 9% SGST
  const cgstAmount = Math.round((totalTax / 2) * 100) / 100;
  const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

  return {
    grossAmount: totalInclusiveAmount,
    taxableAmount,
    gstRatePercent,
    cgstRate: 9,
    cgstAmount,
    sgstRate: 9,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    isInterState: false,
  };
}
