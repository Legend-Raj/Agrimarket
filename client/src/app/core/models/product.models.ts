/**
 * Product Models for AgriMarket E-commerce
 * Matches backend ProductResponseDto exactly
 */

// ============================================
// Product Models
// ============================================

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  minimumQuantity: number;
  deliveryRadius: number;
  status: ProductStatus;
  sku?: string;
  categoryId?: string;
  category?: ProductCategory | null;
  sellerId: string;
  seller?: ProductSeller | null;
  unit?: string;
  isActive: boolean;
  imageUrl?: string | null;
  stock: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  parent?: ProductCategory | null;
  children?: ProductCategory[];
}

export interface ProductSeller {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
}

export enum ProductStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  DRAFT = 'Draft',
  OUT_OF_STOCK = 'OutOfStock',
}

// ============================================
// Pagination Models
// ============================================

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Filter Models
// ============================================

export interface ProductFilters {
  search?: string;
  /** Single category ID (for backward compatibility) */
  categoryId?: string;
  /** Multiple category IDs - uses OR logic within same filter */
  categoryIds?: string[];
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'price' | 'name';
  sortOrder?: 'ASC' | 'DESC';
  /** Single seller ID (for backward compatibility) */
  sellerId?: string;
  /** Multiple seller IDs - uses OR logic within same filter */
  sellerIds?: string[];
  manufacturer?: string;
}

/**
 * Dynamic filter options loaded from the backend.
 * Used to populate the filter sidebar dynamically.
 */
export interface FilterOptions {
  categories: { id: string; name: string; slug: string; productCount: number }[];
  priceRange: { min: number; max: number };
  sellers: { id: string; companyName: string | null; productCount: number }[];
  totalProducts: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if product is in stock.
 * Treats null/undefined stock as "in stock" (product may not have an inventory record yet).
 * Only marks as out-of-stock when stock is explicitly 0.
 */
export function isProductInStock(product: Product): boolean {
  // null/undefined stock = assume available (product may not have inventory record)
  if (product.stock === null || product.stock === undefined) {
    return true;
  }
  return product.stock > 0;
}

/**
 * Get formatted price
 */
export function formatPrice(product: Product): string {
  return `${product.currency} ${product.price.toLocaleString()}`;
}

/**
 * Get stock status text
 */
export function getStockStatus(product: Product): string {
  if (product.stock === null) return 'Stock unknown';
  if (product.stock === 0) return 'Out of stock';
  if (product.stock < 10) return `Only ${product.stock} left`;
  return `${product.stock} in stock`;
}
