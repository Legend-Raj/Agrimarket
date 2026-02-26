import { Component, inject, OnInit, OnDestroy, signal, computed, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { 
  NotificationResponse, 
  NotificationType,
  formatNotificationTime,
  isRecentNotification 
} from '../../../core/models/notification.models';

/**
 * Notification Dropdown Component
 * 
 * A reusable notification dropdown that displays user notifications.
 * Features:
 * - Real-time unread count badge
 * - Mark as read (single/all)
 * - Time-relative formatting
 * - Click outside to close
 * - Keyboard accessible (Escape to close)
 * - Consistent design with existing dropdowns
 * 
 * Usage:
 * <app-notification-dropdown 
 *   [isOpen]="isNotificationsOpen()" 
 *   (toggle)="toggleNotifications($event)"
 *   (closed)="onNotificationsClosed()">
 * </app-notification-dropdown>
 */
@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.css'
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly elementRef = inject(ElementRef);
  private readonly destroy$ = new Subject<void>();

  // Input/Output for controlling visibility from parent
  @Output() toggle = new EventEmitter<MouseEvent>();
  @Output() closed = new EventEmitter<void>();

  // Internal state
  readonly isOpen = signal<boolean>(false);
  readonly isMarkingAllRead = signal<boolean>(false);
  readonly isLoadingMore = signal<boolean>(false);
  readonly hasMoreNotifications = signal<boolean>(true);

  // Delegate to service signals
  readonly notifications = this.notificationService.notifications;
  readonly unreadCount = this.notificationService.unreadCount;
  readonly isLoading = this.notificationService.isLoading;
  readonly hasUnread = this.notificationService.hasUnread;
  readonly unreadBadgeText = this.notificationService.unreadBadgeText;

  // Computed values
  readonly recentNotifications = computed(() => {
    return this.notifications().slice(0, 10);
  });

  readonly hasNotifications = computed(() => {
    return this.notifications().length > 0;
  });

  ngOnInit(): void {
    // Start polling for unread count
    this.notificationService.startPolling(30000);
    
    // Load initial notifications
    this.notificationService.loadInitial()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle escape key to close dropdown
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  /**
   * Handle click outside to close dropdown
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  /**
   * Toggle dropdown visibility
   */
  onToggle(event: MouseEvent): void {
    event.stopPropagation();
    
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
    
    this.toggle.emit(event);
  }

  /**
   * Open the dropdown and refresh notifications
   */
  open(): void {
    this.isOpen.set(true);
    this.notificationService.refresh();
  }

  /**
   * Close the dropdown
   */
  close(): void {
    this.isOpen.set(false);
    this.closed.emit();
  }

  /**
   * Mark a single notification as read
   */
  markAsRead(notification: NotificationResponse, event: MouseEvent): void {
    event.stopPropagation();
    
    if (notification.isRead) {
      return;
    }
    
    this.notificationService.markAsRead(notification.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(event: MouseEvent): void {
    event.stopPropagation();
    
    if (!this.hasUnread()) {
      return;
    }
    
    this.isMarkingAllRead.set(true);
    
    this.notificationService.markAllAsRead()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isMarkingAllRead.set(false);
        },
        error: () => {
          this.isMarkingAllRead.set(false);
        }
      });
  }

  /**
   * Load more notifications (pagination)
   */
  loadMore(event: MouseEvent): void {
    event.stopPropagation();
    
    if (this.isLoadingMore()) {
      return;
    }
    
    this.isLoadingMore.set(true);
    
    this.notificationService.loadMore()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoadingMore.set(false);
          this.hasMoreNotifications.set(response.items.length > 0);
        },
        error: () => {
          this.isLoadingMore.set(false);
        }
      });
  }

  /**
   * Handle notification click
   */
  onNotificationClick(notification: NotificationResponse): void {
    // Mark as read if unread
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }
    
    // TODO: Navigate to related entity if applicable
    // For now, just close the dropdown
    this.close();
  }

  /**
   * Format notification time for display
   */
  formatTime(timestamp: string): string {
    return formatNotificationTime(timestamp);
  }

  /**
   * Check if notification is recent (within last hour)
   */
  isRecent(notification: NotificationResponse): boolean {
    return isRecentNotification(notification);
  }

  /**
   * Get icon SVG path based on notification type
   */
  getIconPath(type: NotificationType): string {
    switch (type) {
      case 'PointsEarned':
        return 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
      case 'RedemptionApproved':
        return 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3';
      case 'RedemptionRejected':
        return 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM15 9l-6 6M9 9l6 6';
      case 'RedemptionDelivered':
        return 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12';
      case 'EventReminder':
      case 'EventStarted':
      case 'EventEnded':
        return 'M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M1 10h22';
      case 'SystemAnnouncement':
      default:
        return 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0';
    }
  }

  /**
   * Get notification type CSS class
   */
  getTypeClass(type: NotificationType): string {
    switch (type) {
      case 'PointsEarned':
        return 'type-points';
      case 'RedemptionApproved':
      case 'RedemptionDelivered':
        return 'type-success';
      case 'RedemptionRejected':
        return 'type-error';
      case 'EventReminder':
      case 'EventStarted':
        return 'type-info';
      case 'EventEnded':
        return 'type-warning';
      case 'SystemAnnouncement':
      default:
        return 'type-default';
    }
  }
}
