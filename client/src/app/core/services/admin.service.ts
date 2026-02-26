import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Event as RewardEvent,
  Product,
  UserResponse,
  PagedResponse,
  LedgerEntry,
  ActivityLogItem,
} from '../models/dashboard.models';

/**
 * Admin Dashboard Statistics Interface
 */
export interface AdminDashboardStats {
  totalUsers: number;
  pointsDistributed: number;
  pointsGrowth: number;
  activeEvents: number;
  pendingRequests: number;
}

/**
 * Points Statistics Response Interface
 * Matches backend PointsStatsResponse DTO
 */
export interface PointsStatsResponse {
  totalPointsAllocated: number;
  totalTransactions: number;
}

/**
 * Bulk Earn Response Interface
 * Matches backend BulkEarnResponse DTO
 */
export interface BulkEarnResponse {
  successCount: number;
  failureCount: number;
  errors: string[];
}

/**
 * Redemption Request Response Interface
 * Matches backend RedemptionRequestResponse DTO
 */
export interface RedemptionRequestResponse {
  requestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  pointsCost: number;
  quantity: number;
  totalPointsCost: number;
  status: 'Pending' | 'Approved' | 'Delivered' | 'Rejected' | 'Canceled';
  requestedAt: string;
  // Computed for backwards compatibility
  id?: string;
}

/**
 * Recent Activity Item Interface
 */
export interface RecentActivityItem {
  id: string;
  type: 'points_earned' | 'redemption_request' | 'user_registered' | 'event_created';
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * AdminService - Handles all admin-related API calls
 * 
 * Responsibilities:
 * - Fetch admin dashboard statistics
 * - Fetch users with admin privileges
 * - Fetch all events (active and inactive)
 * - Fetch all products
 * - Fetch redemption requests
 * 
 * All methods return Observables for proper async handling
 */
@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  /**
   * Get all users with pagination (admin only)
   * @param skip - Number of records to skip
   * @param take - Number of records to take
   * @param filter - Filter by status ('active', 'notactive', 'all')
   * @param search - Search query to filter by name, email, or employee ID
   */
  getUsers(skip: number = 0, take: number = 50, filter?: string, search?: string): Observable<PagedResponse<UserResponse>> {
    let url = `${this.API_URL}/admin/users?skip=${skip}&take=${take}`;
    if (filter) {
      url += `&filter=${filter}`;
    }
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    return this.http.get<PagedResponse<UserResponse>>(url);
  }

  /**
   * Get total user count
   */
  getTotalUserCount(): Observable<number> {
    return this.getUsers(0, 1, 'all').pipe(
      map(response => response.totalCount),
      catchError(() => of(0))
    );
  }

  /**
   * Get total points distributed across all users
   * Uses the points stats API for accurate allocation data
   */
  getTotalPointsDistributed(): Observable<{ total: number; growth: number }> {
    return this.getPointsStats('all').pipe(
      map(stats => ({
        total: stats.totalPointsAllocated,
        growth: 0 // Growth calculation would need historical data
      })),
      catchError(() => of({ total: 0, growth: 0 }))
    );
  }

  /**
   * Get all events
   * @param onlyActive - If true, returns only active events
   */
  getEvents(onlyActive: boolean = false): Observable<RewardEvent[]> {
    const params = onlyActive ? '?onlyActive=true' : '?onlyActive=false';
    return this.http.get<RewardEvent[]>(`${this.API_URL}/events${params}`);
  }

  /**
   * Get active events count
   */
  getActiveEventsCount(): Observable<number> {
    return this.getEvents(true).pipe(
      map(events => events.length),
      catchError(() => of(0))
    );
  }

  /**
   * Get all products
   * @param onlyActive - If true, returns only active products
   */
  getProducts(onlyActive: boolean = false): Observable<Product[]> {
    const params = onlyActive ? '?onlyActive=true' : '?onlyActive=false';
    return this.http.get<Product[]>(`${this.API_URL}/products${params}`);
  }

  /**
   * Get redemption requests with pagination
   * @param skip - Number of records to skip
   * @param take - Number of records to take
   * @param status - Filter by status
   */
  getRedemptionRequests(
    skip: number = 0,
    take: number = 50,
    status?: string
  ): Observable<PagedResponse<RedemptionRequestResponse>> {
    let url = `${this.API_URL}/redemption-requests?skip=${skip}&take=${take}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.http.get<PagedResponse<RedemptionRequestResponse>>(url);
  }

  /**
   * Get pending redemption requests count
   */
  getPendingRequestsCount(): Observable<number> {
    return this.getRedemptionRequests(0, 1, 'Pending').pipe(
      map(response => response.totalCount),
      catchError(() => of(0))
    );
  }

  /**
   * Load all admin dashboard statistics in parallel
   */
  loadDashboardStats(): Observable<AdminDashboardStats> {
    return forkJoin({
      totalUsers: this.getTotalUserCount(),
      pointsData: this.getTotalPointsDistributed(),
      activeEvents: this.getActiveEventsCount(),
      pendingRequests: this.getPendingRequestsCount()
    }).pipe(
      map(results => ({
        totalUsers: results.totalUsers,
        pointsDistributed: results.pointsData.total,
        pointsGrowth: results.pointsData.growth,
        activeEvents: results.activeEvents,
        pendingRequests: results.pendingRequests
      }))
    );
  }

  /**
   * Get recent activities for the admin dashboard.
   * @param count - Number of activities to retrieve (default: 5, max: 100)
   */
  getRecentActivities(count: number = 7): Observable<ActivityLogItem[]> {
    return this.http.get<ActivityLogItem[]>(
      `${this.API_URL}/admin/activities/recent?count=${count}`
    ).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Create a new event (admin only)
   */
  createEvent(data: {
    name: string;
    description?: string;
    occursAt: string;
    endsAt?: string;
    isActive?: boolean;
  }): Observable<RewardEvent> {
    return this.http.post<RewardEvent>(`${this.API_URL}/admin/events`, data);
  }

  /**
   * Update an existing event (admin only)
   * @param eventId - The event's GUID
   * @param updateData - Fields to update
   */
  updateEvent(eventId: string, updateData: {
    name: string;
    description?: string | null;
    occursAt: string;
    endsAt?: string | null;
  }): Observable<RewardEvent> {
    return this.http.put<RewardEvent>(`${this.API_URL}/admin/events/${eventId}`, updateData);
  }

  /**
   * Set event active/inactive state (admin only)
   * @param eventId - The event's GUID
   * @param isActive - New active state
   */
  setEventActive(eventId: string, isActive: boolean): Observable<RewardEvent> {
    return this.http.post<RewardEvent>(`${this.API_URL}/admin/events/${eventId}/active/${isActive}`, {});
  }

  /**
   * Get events count by filter type
   * @param filter - 'active', 'upcoming', or 'past'
   */
  getEventsCountByFilter(filter: 'active' | 'upcoming' | 'past'): Observable<number> {
    return this.getEvents(false).pipe(
      map(events => {
        const now = new Date();
        return events.filter(event => {
          const occursAt = new Date(event.occursAt);
          const endsAt = event.endsAt ? new Date(event.endsAt) : null;

          switch (filter) {
            case 'active':
              // Active: event is ongoing (started but not ended) and isActive=true
              if (!event.isActive) return false;
              if (now < occursAt) return false; // Not started yet
              if (endsAt && now > endsAt) return false; // Already ended
              return true;
            case 'upcoming':
              // Upcoming: event hasn't started yet and isActive=true
              return event.isActive && now < occursAt;
            case 'past':
              // Past: event has ended
              if (endsAt) return now > endsAt;
              // If no endsAt, consider past if occursAt is in the past
              return now > occursAt && !endsAt;
            default:
              return true;
          }
        }).length;
      }),
      catchError(() => of(0))
    );
  }

  /**
   * Create a new product (admin only)
   */
  createProduct(data: {
    name: string;
    description?: string;
    pointsCost: number;
    imageUrl?: string;
    stock?: number;
    isActive?: boolean;
  }): Observable<Product> {
    return this.http.post<Product>(`${this.API_URL}/admin/products`, data);
  }

  /**
   * Update an existing product (admin only)
   * @param productId - The product's GUID
   * @param updateData - Fields to update (all optional)
   */
  updateProduct(productId: string, updateData: {
    name?: string;
    description?: string | null;
    pointsCost?: number;
    imageUrl?: string | null;
    stock?: number | null;
    isActive?: boolean;
  }): Observable<Product> {
    return this.http.patch<Product>(`${this.API_URL}/admin/products/${productId}`, updateData);
  }

  /**
   * Delete a product (admin only)
   * @param productId - The product's GUID
   */
  deleteProduct(productId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/admin/products/${productId}`);
  }

  /**
   * Get product inventory count based on stock status
   * @param inStock - If true, returns count of products in stock; false returns out of stock count
   */
  getProductInventoryCount(inStock: boolean): Observable<number> {
    return this.getProducts(false).pipe(
      map(products => {
        if (inStock) {
          // In Stock: Products with stock > 0 OR stock is null (unlimited)
          return products.filter(p => p.isActive && (p.stock === null || p.stock > 0)).length;
        } else {
          // Out of Stock: Products with stock === 0
          return products.filter(p => p.isActive && p.stock === 0).length;
        }
      }),
      catchError(() => of(0))
    );
  }

  /**
   * Get points allocation statistics for a specified time period
   * @param period - Time period: 'all', 'day', 'month', or 'year'
   */
  getPointsStats(period: string = 'all'): Observable<PointsStatsResponse> {
    return this.http.get<PointsStatsResponse>(`${this.API_URL}/admin/points/stats?period=${period}`);
  }

  /**
   * Award points to a user (admin only)
   */
  awardPoints(userId: string, eventId: string, points: number): Observable<unknown> {
    return this.http.post(`${this.API_URL}/admin/points/earn`, {
      userId,
      eventId,
      points
    });
  }

  /**
   * Award points to multiple users (admin only)
   */
  awardPointsBulk(userIds: string[], eventId: string, points: number): Observable<BulkEarnResponse> {
    return this.http.post<BulkEarnResponse>(`${this.API_URL}/admin/points/earn-bulk`, {
      userIds,
      eventId,
      points
    });
  }

  /**
   * Create a new user (admin only)
   * @param userData - User data matching CreateUserRequest
   */
  createUser(userData: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    employeeId: string;
    password: string;
  }): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.API_URL}/users`, userData);
  }

  /**
   * Create a new admin user (admin only)
   * @param userData - Admin user data matching CreateAdminUserRequest
   */
  createAdmin(userData: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    employeeId: string;
    password: string;
  }): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.API_URL}/admin/users/create-admin`, userData);
  }

  /**
   * Update an existing user (admin only)
   * @param userId - The user's GUID
   * @param updateData - Fields to update (all optional)
   */
  updateUser(userId: string, updateData: {
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    email?: string;
    employeeId?: string;
    isActive?: boolean;
  }): Observable<UserResponse> {
    return this.http.patch<UserResponse>(`${this.API_URL}/admin/users/${userId}`, updateData);
  }

  // ============================================
  // Redemption Request Management (Admin Only)
  // ============================================

  /**
   * Approve a pending redemption request
   * @param requestId - The redemption request GUID
   */
  approveRedemptionRequest(requestId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/redemption-requests/${requestId}/approve`, {});
  }

  /**
   * Deliver an approved redemption request
   * @param requestId - The redemption request GUID
   */
  deliverRedemptionRequest(requestId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/redemption-requests/${requestId}/deliver`, {});
  }

  /**
   * Reject a pending redemption request
   * @param requestId - The redemption request GUID
   */
  rejectRedemptionRequest(requestId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/redemption-requests/${requestId}/reject`, {});
  }

  /**
   * Cancel a pending redemption request
   * @param requestId - The redemption request GUID
   */
  cancelRedemptionRequest(requestId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/redemption-requests/${requestId}/cancel`, {});
  }

  // ============================================
  // User Transaction History (Admin Only)
  // ============================================

  /**
   * Get a user's complete points transaction history (admin only)
   * Uses the public points history endpoint which requires authentication.
   * @param userId - The user's GUID
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to take (pagination)
   */
  getUserTransactionHistory(
    userId: string,
    skip: number = 0,
    take: number = 50
  ): Observable<PagedResponse<LedgerEntry>> {
    return this.http.get<PagedResponse<LedgerEntry>>(
      `${this.API_URL}/points/history/${userId}?skip=${skip}&take=${take}`
    );
  }

  /**
   * Get all events (for displaying event names in transaction history)
   * @param onlyActive - If true, returns only active events
   */
  getAllEvents(onlyActive: boolean = false): Observable<RewardEvent[]> {
    const params = onlyActive ? '?onlyActive=true' : '?onlyActive=false';
    return this.http.get<RewardEvent[]>(`${this.API_URL}/events${params}`);
  }
}
