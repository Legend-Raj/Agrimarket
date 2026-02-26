import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subject, timer } from 'rxjs';
import { map, catchError, tap, takeUntil, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  NotificationResponse,
  UnreadNotificationCountResponse,
  MarkNotificationsReadResponse,
  PagedNotificationsResponse
} from '../models/notification.models';

/**
 * NotificationService - Handles all notification-related API calls
 * 
 * Responsibilities:
 * - Fetch user notifications (paginated)
 * - Get unread notification count
 * - Mark notifications as read (single or all)
 * - Auto-refresh unread count periodically
 * 
 * Security:
 * - All endpoints are user-scoped via JWT token
 * - No user ID passed in URL - determined server-side
 * 
 * All methods return Observables for proper async handling
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;
  
  // Reactive state using signals
  private readonly _unreadCount = signal<number>(0);
  private readonly _notifications = signal<NotificationResponse[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  
  // Auto-refresh control - use a new Subject for each polling session
  private pollingDestroy$: Subject<void> | null = null;
  private isPolling = false;
  
  // Public readonly signals
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  
  // Computed signals
  readonly hasUnread = computed(() => this._unreadCount() > 0);
  readonly unreadBadgeText = computed(() => {
    const count = this._unreadCount();
    if (count === 0) return '';
    if (count > 99) return '99+';
    return count.toString();
  });

  /**
   * Get user's notifications with pagination
   * @param skip - Number of records to skip
   * @param take - Number of records to take
   * @param unreadOnly - If true, returns only unread notifications
   */
  getNotifications(
    skip: number = 0,
    take: number = 20,
    unreadOnly: boolean = false
  ): Observable<PagedNotificationsResponse> {
    let url = `${this.API_URL}/notifications?skip=${skip}&take=${take}`;
    if (unreadOnly) {
      url += '&unreadOnly=true';
    }
    
    this._isLoading.set(true);
    this._error.set(null);
    
    return this.http.get<PagedNotificationsResponse>(url).pipe(
      tap(response => {
        if (skip === 0) {
          this._notifications.set(response.items);
        } else {
          // Append for pagination
          this._notifications.update(current => [...current, ...response.items]);
        }
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._error.set('Failed to load notifications');
        this._isLoading.set(false);
        console.error('NotificationService: Failed to get notifications', error);
        return of({ items: [], totalCount: 0, skip, take });
      })
    );
  }

  /**
   * Get unread notification count
   * Updates the internal signal automatically
   */
  getUnreadCount(): Observable<UnreadNotificationCountResponse> {
    return this.http.get<UnreadNotificationCountResponse>(
      `${this.API_URL}/notifications/unread-count`
    ).pipe(
      tap(response => {
        this._unreadCount.set(response.unreadCount);
      }),
      catchError(error => {
        console.error('NotificationService: Failed to get unread count', error);
        return of({ unreadCount: 0 });
      })
    );
  }

  /**
   * Mark a single notification as read
   * @param notificationId - The notification ID to mark as read
   */
  markAsRead(notificationId: string): Observable<void> {
    return this.http.post<void>(
      `${this.API_URL}/notifications/${notificationId}/read`,
      {}
    ).pipe(
      tap(() => {
        // Update local state
        this._notifications.update(notifications =>
          notifications.map(n =>
            n.id === notificationId
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          )
        );
        // Decrement unread count
        this._unreadCount.update(count => Math.max(0, count - 1));
      }),
      catchError(error => {
        console.error('NotificationService: Failed to mark notification as read', error);
        throw error;
      })
    );
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Observable<MarkNotificationsReadResponse> {
    return this.http.post<MarkNotificationsReadResponse>(
      `${this.API_URL}/notifications/read-all`,
      {}
    ).pipe(
      tap(response => {
        // Update local state - mark all as read
        const now = new Date().toISOString();
        this._notifications.update(notifications =>
          notifications.map(n => ({ ...n, isRead: true, readAt: n.readAt || now }))
        );
        // Reset unread count
        this._unreadCount.set(0);
      }),
      catchError(error => {
        console.error('NotificationService: Failed to mark all as read', error);
        throw error;
      })
    );
  }

  /**
   * Start polling for unread notification count
   * Polls every 30 seconds for real-time updates
   * @param intervalMs - Polling interval in milliseconds (default: 30000)
   */
  startPolling(intervalMs: number = 30000): void {
    if (this.isPolling) {
      return; // Already polling
    }
    
    this.isPolling = true;
    
    // Create a fresh Subject for this polling session
    this.pollingDestroy$ = new Subject<void>();
    
    // Initial fetch of unread count
    this.getUnreadCount().subscribe();
    
    // Start periodic polling
    timer(intervalMs, intervalMs)
      .pipe(
        takeUntil(this.pollingDestroy$),
        switchMap(() => this.getUnreadCount())
      )
      .subscribe();
  }

  /**
   * Stop polling for notifications
   */
  stopPolling(): void {
    if (this.pollingDestroy$) {
      this.pollingDestroy$.next();
      this.pollingDestroy$.complete();
      this.pollingDestroy$ = null;
    }
    this.isPolling = false;
  }

  /**
   * Refresh notifications - reload from server
   */
  refresh(): void {
    this.getNotifications(0, 20).subscribe();
    this.getUnreadCount().subscribe();
  }

  /**
   * Clear local notification state
   * Called on logout
   */
  clearState(): void {
    this._notifications.set([]);
    this._unreadCount.set(0);
    this._error.set(null);
    this.stopPolling();
  }

  /**
   * Load initial notifications (first page) and unread count
   */
  loadInitial(): Observable<PagedNotificationsResponse> {
    // Also fetch unread count when loading initial notifications
    this.getUnreadCount().subscribe();
    return this.getNotifications(0, 20);
  }

  /**
   * Load more notifications (pagination)
   */
  loadMore(): Observable<PagedNotificationsResponse> {
    const currentCount = this._notifications().length;
    return this.getNotifications(currentCount, 20);
  }
}
