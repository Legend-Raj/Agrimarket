/**
 * User roles in the AgriMarket platform
 */
export enum UserRole {
  GROWER = 'Grower',
  RETAILER = 'Retailer',
  MANUFACTURER = 'Manufacturer',
  ADMIN = 'Admin',
}

/**
 * Order status values
 */
export enum OrderStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  PROCESSING = 'Processing',
  SHIPPED = 'Shipped',
  DELIVERED = 'Delivered',
  CANCELLED = 'Cancelled',
  REFUNDED = 'Refunded',
}

/**
 * Cart status values
 */
export enum CartStatus {
  ACTIVE = 'Active',
  CHECKED_OUT = 'CheckedOut',
  ABANDONED = 'Abandoned',
}

/**
 * Product status values
 */
export enum ProductStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  DRAFT = 'Draft',
  OUT_OF_STOCK = 'OutOfStock',
}

/**
 * Notification types
 */
export enum NotificationType {
  ORDER_CREATED = 'OrderCreated',
  ORDER_STATUS_CHANGED = 'OrderStatusChanged',
  NEW_PROMOTION = 'NewPromotion',
  PRODUCT_AVAILABLE = 'ProductAvailable',
  LOW_STOCK_WARNING = 'LowStockWarning',
}

/**
 * Notification channel
 */
export enum NotificationChannel {
  IN_APP = 'InApp',
  EMAIL = 'Email',
}
