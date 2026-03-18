/**
 * Promotion Models for AgriMarket E-commerce
 * Matches backend Promotion and Bundle entities
 */

// ============================================
// Promotion Models
// ============================================

export enum DiscountType {
  PERCENTAGE = 'Percentage',
  FIXED = 'Fixed',
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minimumOrderAmount?: number;
  maximumDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usageCount: number;
  isActive: boolean;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bundle {
  id: string;
  name: string;
  description?: string;
  bundlePrice: number;
  productIds: string[];
  isActive: boolean;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Promotion Validation
// ============================================

export interface ValidationResult {
  valid: boolean;
  message: string;
  discount?: number;
  promotion?: Promotion;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if promotion is currently active
 */
export function isPromotionActive(promotion: Promotion): boolean {
  const now = new Date();
  const start = new Date(promotion.startDate);
  const end = new Date(promotion.endDate);

  return (
    promotion.isActive &&
    start <= now &&
    end >= now &&
    promotion.usageCount < promotion.usageLimit
  );
}

/**
 * Get formatted discount text
 */
export function getDiscountText(promotion: Promotion): string {
  if (promotion.discountType === DiscountType.PERCENTAGE) {
    return `${promotion.discountValue}% OFF`;
  }
  return `$${promotion.discountValue} OFF`;
}

/**
 * Get promotion validity text
 */
export function getValidityText(promotion: Promotion): string {
  const end = new Date(promotion.endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Valid for ${days} days`;
}
