/**
 * Dashboard Models
 * Matches backend DTOs exactly for type safety
 */

// ============================================
// User & Balance Models
// ============================================

export interface UserResponse {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  employeeId: string;
  isActive: boolean;
  isAdmin: boolean;
  role: string; // Explicit role string from database (e.g., "Admin", "User")
  totalPoints: number;
  lockedPoints: number;
  availablePoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserBalanceInfo {
  totalPoints: number;
  lockedPoints: number;
  availablePoints: number;
}

// ============================================
// Event Models
// ============================================

/**
 * Represents the temporal status of an event.
 * Matches backend EventStatus enum.
 */
export type EventStatus = 'Upcoming' | 'Ongoing' | 'Ended';

export interface Event {
  id: string;
  name: string;
  description: string | null;
  occursAt: string;
  endsAt: string | null;
  isActive: boolean;
}

/**
 * Extended event interface with computed status for UI display.
 */
export interface EventWithStatus extends Event {
  status: EventStatus;
  /** Time remaining until event ends (for ongoing events) or starts (for upcoming events) */
  timeRemaining?: string;
}

/**
 * Calculate the current status of an event based on current time.
 */
export function getEventStatus(event: Event): EventStatus {
  const now = new Date();
  const occursAt = new Date(event.occursAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;

  if (now < occursAt) {
    return 'Upcoming';
  }

  if (endsAt && now > endsAt) {
    return 'Ended';
  }

  // If no endsAt set and occursAt is in the past, consider it ended
  if (!endsAt && now > occursAt) {
    return 'Ended';
  }

  return 'Ongoing';
}

/**
 * Check if an event is currently ongoing (clickable).
 */
export function isEventOngoing(event: Event): boolean {
  return getEventStatus(event) === 'Ongoing';
}

// ============================================
// Product Models
// ============================================

export interface Product {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  imageUrl: string | null;
  stock: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Points & Ledger Models
// ============================================

/**
 * Ledger entry type.
 * Note: Backend may send as string ("Earn") or number (0) depending on serialization settings.
 * Frontend should handle both formats.
 */
export type LedgerEntryType = 'Earn' | 'Redeem' | 0 | 1;

/**
 * Map numeric ledger type values to their string equivalents.
 * Used when the API returns enum as integer.
 */
export const LedgerTypeMap: Record<number, string> = {
  0: 'Earn',
  1: 'Redeem'
};

/**
 * Helper function to normalize ledger entry type to string.
 * Handles both numeric and string type values from API.
 */
export function normalizeLedgerType(type: LedgerEntryType): string {
  if (typeof type === 'number') {
    return LedgerTypeMap[type] || 'Unknown';
  }
  return type;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  type: LedgerEntryType;
  points: number;
  timestamp: string;
  eventId: string | null;
  redemptionRequestId: string | null;
}

// ============================================
// Pagination Models
// ============================================

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  skip: number;
  take: number;
}

// ============================================
// Redemption Models
// ============================================

/**
 * Redemption request status.
 * Note: Backend may send as string ("Pending") or number (0) depending on serialization settings.
 * Frontend should handle both formats.
 */
export type RedemptionRequestStatus = 
  | 'Pending' 
  | 'Approved' 
  | 'Delivered' 
  | 'Rejected' 
  | 'Canceled'
  | 0 | 1 | 2 | 3 | 4;  // Support numeric values from API

/**
 * Map numeric status values to their string equivalents.
 * Used when the API returns enum as integer.
 */
export const RedemptionStatusMap: Record<number, string> = {
  0: 'Pending',
  1: 'Approved',
  2: 'Delivered',
  3: 'Rejected',
  4: 'Canceled'
};

/**
 * Helper function to normalize status value to string.
 * Handles both numeric and string status values from API.
 */
export function normalizeStatus(status: RedemptionRequestStatus): string {
  if (typeof status === 'number') {
    return RedemptionStatusMap[status] || 'Unknown';
  }
  return status;
}

export interface RedemptionRequest {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  status: RedemptionRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  deliveredAt: string | null;
}

export interface SubmitRedemptionRequest {
  userId: string;
  productId: string;
  quantity: number;
}

/**
 * User-facing redemption request response.
 * Used for the user's transaction history page.
 * Matches the backend UserRedemptionRequestResponse DTO.
 */
export interface UserRedemptionRequestResponse {
  requestId: string;
  productId: string;
  productName: string;
  productDescription: string | null;
  productImageUrl: string | null;
  pointsCost: number;
  quantity: number;
  totalPointsCost: number;
  status: RedemptionRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  deliveredAt: string | null;
}

// ============================================
// Dashboard-specific DTOs
// ============================================

export interface DashboardData {
  user: UserResponse | null;
  recentEvents: Event[];
  newArrivals: Product[];
  pointsHistory: LedgerEntry[];
}

export interface TopEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  totalPoints: number;
  availablePoints: number;
}

// ============================================
// Activity Log Models (Admin Dashboard)
// ============================================

/**
 * Activity type enum values.
 * Matches backend ActivityType enum.
 */
export type ActivityType =
  | 'UserCreated'
  | 'UserUpdated'
  | 'UserDeactivated'
  | 'AdminCreated'
  | 'EventCreated'
  | 'EventUpdated'
  | 'EventDeactivated'
  | 'ProductCreated'
  | 'ProductUpdated'
  | 'ProductDeactivated'
  | 'PointsAwarded'
  | 'PointsAwardedBulk'
  | 'RedemptionRequested'
  | 'RedemptionApproved'
  | 'RedemptionDelivered'
  | 'RedemptionRejected'
  | 'RedemptionCanceled';

/**
 * Activity log entry from the API.
 * Matches backend ActivityLogDto.
 */
export interface ActivityLogItem {
  id: string;
  activityType: ActivityType;
  actorName: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  occurredAt: string;
}

/**
 * Get icon name for activity type (for UI display).
 */
export function getActivityIcon(activityType: ActivityType): string {
  const iconMap: Record<string, string> = {
    UserCreated: 'user-plus',
    UserUpdated: 'user-edit',
    UserDeactivated: 'user-minus',
    AdminCreated: 'shield-plus',
    EventCreated: 'calendar-plus',
    EventUpdated: 'calendar-edit',
    EventDeactivated: 'calendar-minus',
    ProductCreated: 'package-plus',
    ProductUpdated: 'package-edit',
    ProductDeactivated: 'package-minus',
    PointsAwarded: 'coins',
    PointsAwardedBulk: 'coins-stacked',
    RedemptionRequested: 'shopping-cart',
    RedemptionApproved: 'check-circle',
    RedemptionDelivered: 'truck',
    RedemptionRejected: 'x-circle',
    RedemptionCanceled: 'ban'
  };
  return iconMap[activityType] || 'activity';
}

/**
 * Get color class for activity type (for UI display).
 */
export function getActivityColorClass(activityType: ActivityType): string {
  if (activityType.includes('Created') || activityType.includes('Approved') || activityType.includes('Delivered')) {
    return 'activity-success';
  }
  if (activityType.includes('Deactivated') || activityType.includes('Rejected') || activityType.includes('Canceled')) {
    return 'activity-warning';
  }
  if (activityType.includes('Points')) {
    return 'activity-info';
  }
  return 'activity-default';
}

// ============================================
// Unified Transaction Models
// ============================================

/**
 * Unified transaction type for displaying all user transactions.
 * Supports both earning transactions (from ledger) and redemption transactions.
 */
export type UnifiedTransactionType = 'Earn' | 'Redeem';

/**
 * Unified transaction interface combining earning and redemption data.
 * Used for the complete transaction history display.
 */
export interface UnifiedTransaction {
  id: string;
  type: UnifiedTransactionType;
  points: number;
  timestamp: string;
  // For earning transactions
  eventId?: string | null;
  eventName?: string | null;
  // For redemption transactions
  redemptionRequestId?: string | null;
  productId?: string | null;
  productName?: string | null;
  productDescription?: string | null;
  productImageUrl?: string | null;
  redemptionStatus?: RedemptionRequestStatus | null;
  approvedAt?: string | null;
  deliveredAt?: string | null;
  quantity?: number | null;
  totalPointsCost?: number | null;
}
