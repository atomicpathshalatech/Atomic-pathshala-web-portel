/**
 * ATOMIC PATHSHALA — BATCH PRICING & DISCOUNT UTILITIES
 *
 * Implements strict, zero-division-safe pricing calculations and formatting
 * according to the Atomic Pathshala commerce specification.
 */

export type PricingStatus = "FREE" | "PAID";

export interface BatchPricingInput {
  status?: PricingStatus;
  price?: number | null;
  originalPrice?: number | null;
  isPurchasable?: boolean;
}

export interface BatchPricingDetails {
  pricingStatus: PricingStatus;
  isFree: boolean;
  isPaid: boolean;
  isUnpriced: boolean;
  isEnrollmentOpen: boolean;
  sellingPrice: number;
  originalPrice: number;
  discountPercentage: number;
  hasDiscount: boolean;
  formattedSellingPrice: string;
  formattedOriginalPrice: string;
}

/**
 * Calculates discount percentage using:
 * ((Original Price - Selling Price) / Original Price) * 100
 *
 * - Handles Original Price <= 0 without division by zero errors (returns 0).
 * - Selling Price = 0 with Original Price > 0 returns 100 (100% OFF / FREE).
 * - Selling Price >= Original Price returns 0.
 * - Negative prices return 0.
 */
export function calculateDiscountPercentage(
  originalPrice: number | null | undefined,
  sellingPrice: number | null | undefined
): number {
  const orig = typeof originalPrice === "number" && !isNaN(originalPrice) ? Math.max(0, originalPrice) : 0;
  const sell = typeof sellingPrice === "number" && !isNaN(sellingPrice) ? Math.max(0, sellingPrice) : 0;

  if (orig <= 0) return 0;
  if (sell <= 0) return 100;
  if (sell >= orig) return 0;

  const raw = ((orig - sell) / orig) * 100;
  return Math.round(raw);
}

/**
 * Formats a currency number in INR (Indian Rupee format)
 */
export function formatInr(amount: number | null | undefined): string {
  const n = typeof amount === "number" && !isNaN(amount) ? Math.round(amount) : 0;
  return `₹${n.toLocaleString("en-IN")}`;
}

/**
 * Computes full pricing breakdown and presentation state for any batch.
 */
export function getBatchPricingDetails(batch: {
  price?: number | null;
  originalPrice?: number | null;
  isPurchasable?: boolean | null;
}): BatchPricingDetails {
  const isUnpriced = batch.price == null;
  const isFree = batch.price === 0;
  const isPaid = typeof batch.price === "number" && batch.price > 0;
  const isEnrollmentOpen = batch.isPurchasable !== false;

  const sellingPrice = isFree ? 0 : typeof batch.price === "number" ? Math.max(0, Math.round(batch.price)) : 0;
  const originalPrice =
    typeof batch.originalPrice === "number" && batch.originalPrice > 0
      ? Math.round(batch.originalPrice)
      : sellingPrice;

  const discountPercentage = calculateDiscountPercentage(originalPrice, sellingPrice);
  const hasDiscount = discountPercentage > 0;

  return {
    pricingStatus: isFree ? "FREE" : "PAID",
    isFree,
    isPaid,
    isUnpriced,
    isEnrollmentOpen,
    sellingPrice,
    originalPrice,
    discountPercentage,
    hasDiscount,
    formattedSellingPrice: isFree ? "FREE" : formatInr(sellingPrice),
    formattedOriginalPrice: formatInr(originalPrice),
  };
}

/**
 * Validates batch pricing before creating or updating a batch.
 */
export function validateBatchPricingInput(input: {
  isFree?: boolean;
  price?: number | null;
  originalPrice?: number | null;
}): { price: number | null; originalPrice: number | null; error?: string } {
  if (input.isFree) {
    const orig = typeof input.originalPrice === "number" && input.originalPrice > 0 ? Math.round(input.originalPrice) : null;
    return { price: 0, originalPrice: orig };
  }

  // If price is specified for a paid batch:
  if (input.price !== undefined && input.price !== null) {
    if (input.price < 0) {
      return { price: null, originalPrice: null, error: "Selling Price cannot be negative." };
    }

    const price = Math.round(input.price);
    let originalPrice =
      typeof input.originalPrice === "number" && input.originalPrice > 0
        ? Math.round(input.originalPrice)
        : null;

    if (originalPrice !== null && price > originalPrice) {
      return {
        price,
        originalPrice,
        error: "Selling Price cannot be greater than Original Price / MRP.",
      };
    }

    return { price, originalPrice };
  }

  return {
    price: input.price ?? null,
    originalPrice: input.originalPrice ?? null,
  };
}
