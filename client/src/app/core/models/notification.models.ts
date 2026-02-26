/**
 * Notification Models
 * Matches backend DTOs exactly for type safety
 */

// ============================================
// Notification Type Enum
// ============================================

/**
 * Type of notification.
 * Matches backend NotificationType enum.
 */
export type NotificationType = 
  | 'PointsEarned'
  | 'RedemptionApproved'
  | 'RedemptionRejected'
  | 'RedemptionDelivered'
  | 'EventReminder'
  | 'EventStarted'
  | 'EventEnded'
  | 'SystemAnnouncement';

/**
 * Maps notification type to user-friendly display text
 */
export const NotificationTypeLabels: Record<NotificationType, string> = {
  'PointsEarned': 'Points Earned',
  'RedemptionApproved': 'Redemption Approved',
  'RedemptionRejected': 'Redemption Rejected',
  'RedemptionDelivered': 'Redemption Delivered',
  'EventReminder': 'Event Reminder',
  'EventStarted': 'Event Started',
  'EventEnded': 'Event Ended',
  'SystemAnnouncement': 'System Announcement'
};

/**
 * Maps notification type to icon name for display
 */
export const NotificationTypeIcons: Record<NotificationType, string> = {
  'PointsEarned': 'star',
  'RedemptionApproved': 'check-circle',
  'RedemptionRejected': 'x-circle',
  'RedemptionDelivered': 'package',
  'EventReminder': 'calendar',
  'EventStarted': 'play-circle',
  'EventEnded': 'stop-circle',
  'SystemAnnouncement': 'bell'
};

// ============================================
// Notification Response Models
// ============================================

/**
 * Notification response from API.
 * Matches backend NotificationResponse DTO.
 */
export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  createdAt: string;
  readAt: string | null;
}

/**
 * Unread notification count response.
 * Matches backend UnreadNotificationCountResponse DTO.
 */
export interface UnreadNotificationCountResponse {
  unreadCount: number;
}

/**
 * Mark notifications read response.
 * Matches backend MarkNotificationsReadResponse DTO.
 */
export interface MarkNotificationsReadResponse {
  markedCount: number;
}

// ============================================
// Paginated Notification Response
// ============================================

/**
 * Paginated notifications response.
 * Uses existing PagedResponse structure.
 */
export interface PagedNotificationsResponse {
  items: NotificationResponse[];
  totalCount: number;
  skip: number;
  take: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get display label for notification type
 */
export function getNotificationTypeLabel(type: NotificationType): string {
  return NotificationTypeLabels[type] || type;
}

/**
 * Get icon name for notification type
 */
export function getNotificationTypeIcon(type: NotificationType): string {
  return NotificationTypeIcons[type] || 'bell';
}

/**
 * Format notification timestamp for display
 */
export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Check if notification is recent (within last hour)
 */
export function isRecentNotification(notification: NotificationResponse): boolean {
  const date = new Date(notification.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours < 1;
}
