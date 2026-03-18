// AgriMarket Core Models barrel export

// Auth models (no conflicts)
export * from './auth.models';

// Dashboard models (legacy)
export * from './dashboard.models';

// Notification models
export * from './notification.models';

// Participation models
export * from './participation.models';

// Product models - using export type for interfaces
export type {
  ProductCategory,
  ProductSeller,
  ProductStatus,
  PaginatedProducts,
  ProductFilters,
} from './product.models';

export {
  isProductInStock,
  formatPrice,
  getStockStatus,
} from './product.models';

// NOTE: 'Product' interface should be imported directly from './product.models'
// to avoid conflict with the legacy 'Product' from dashboard.models

// Promotion models
export * from './promotion.models';
