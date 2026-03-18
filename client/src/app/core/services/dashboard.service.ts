import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Event as RewardEvent,
  Product,
  UserResponse,
  LedgerEntry,
  PagedResponse,
  DashboardData,
  TopEmployee,
  UserRedemptionRequestResponse,
  SubmitRedemptionRequest
} from '../models/dashboard.models';

/**
 * DashboardService - Handles all dashboard-related API calls
 * 
 * Responsibilities:
 * - Fetch user balance and profile data
 * - Fetch events (recent/active)
 * - Fetch products (new arrivals)
 * - Fetch points history
 * 
 * All methods return Observables for proper async handling
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  /**
   * Get user by ID with balance information
   * @param userId - The user's GUID
   */
  getUserById(userId: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.API_URL}/users/${userId}`);
  }

  /**
   * Get top 3 employees with highest rewards
   */
  getTopEmployees(): Observable<TopEmployee[]> {
    return this.http.get<TopEmployee[]>(`${this.API_URL}/users/top-3`);
  }

  /**
   * Get active events
   * @param onlyActive - If true, returns only active events
   */
  getEvents(onlyActive: boolean = true): Observable<RewardEvent[]> {
    const params = onlyActive ? '?onlyActive=true' : '?onlyActive=false';
    return this.http.get<RewardEvent[]>(`${this.API_URL}/events${params}`);
  }

  /**
   * Get all events (including past/inactive) for the events page.
   * Returns events sorted by status (ongoing first, then upcoming, then ended).
   */
  getAllEvents(): Observable<RewardEvent[]> {
    return this.getEvents(false);
  }

  /**
   * Get recent events (sorted by date, most recent first)
   * @param limit - Maximum number of events to return
   */
  getRecentEvents(limit: number = 5): Observable<RewardEvent[]> {
    return this.getEvents(true).pipe(
      map(events => {
        // Sort by occursAt descending (most recent first)
        return events
          .sort((a, b) => new Date(b.occursAt).getTime() - new Date(a.occursAt).getTime())
          .slice(0, limit);
      })
    );
  }

  /**
   * Get active products
   * @param onlyActive - If true, returns only active products
   */
  getProducts(onlyActive: boolean = true): Observable<Product[]> {
    const params = onlyActive ? '?onlyActive=true' : '?onlyActive=false';
    return this.http.get<{ data: Product[]; total: number; page: number; limit: number; totalPages: number }>(`${this.API_URL}/products${params}`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get new arrivals (most recently added products)
   * @param limit - Maximum number of products to return
   */
  getNewArrivals(limit: number = 4): Observable<Product[]> {
    return this.getProducts(true).pipe(
      map(products => {
        // Sort by createdAt descending (newest first)
        return products
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit);
      })
    );
  }

  /**
   * Get points history for a user
   * @param userId - The user's GUID
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to take (pagination)
   */
  getPointsHistory(
    userId: string,
    skip: number = 0,
    take: number = 10
  ): Observable<PagedResponse<LedgerEntry>> {
    return this.http.get<PagedResponse<LedgerEntry>>(
      `${this.API_URL}/points/history/${userId}?skip=${skip}&take=${take}`
    );
  }

  /**
   * Get recent points history for a user (most recent transactions)
   * @param userId - The user's GUID
   * @param limit - Maximum number of entries to return
   */
  getRecentPointsHistory(userId: string, limit: number = 5): Observable<LedgerEntry[]> {
    return this.getPointsHistory(userId, 0, limit).pipe(
      map(response => response.items)
    );
  }

  /**
   * Load all dashboard data in parallel
   * @param userId - The user's GUID
   */
  loadDashboardData(userId: string): Observable<DashboardData> {
    return forkJoin({
      user: this.getUserById(userId).pipe(catchError(() => of(null))),
      recentEvents: this.getRecentEvents(5).pipe(catchError(() => of([]))),
      newArrivals: this.getNewArrivals(4).pipe(catchError(() => of([]))),
      pointsHistory: this.getRecentPointsHistory(userId, 5).pipe(catchError(() => of([])))
    });
  }

  // ============================================
  // User Transactions / Redemption History
  // ============================================

  /**
   * Get the authenticated user's points history (earning transactions).
   * This endpoint is secure - user ID is determined server-side from the JWT token.
   * No user ID parameter is needed as the backend identifies the user from auth context.
   * 
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to take (pagination)
   */
  getMyPointsHistory(
    skip: number = 0,
    take: number = 50
  ): Observable<PagedResponse<LedgerEntry>> {
    return this.http.get<PagedResponse<LedgerEntry>>(
      `${this.API_URL}/points/my-history?skip=${skip}&take=${take}`
    );
  }

  /**
   * Get the authenticated user's redemption request history.
   * This endpoint is secure - user ID is determined server-side from the JWT token.
   * No user ID parameter is needed as the backend identifies the user from auth context.
   * 
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to take (pagination)
   * @param status - Optional status filter (Pending, Approved, Delivered, Rejected, Canceled)
   */
  getMyRedemptionRequests(
    skip: number = 0,
    take: number = 20,
    status?: string
  ): Observable<PagedResponse<UserRedemptionRequestResponse>> {
    let url = `${this.API_URL}/redemption-requests/my?skip=${skip}&take=${take}`;
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }
    return this.http.get<PagedResponse<UserRedemptionRequestResponse>>(url);
  }

  /**
   * Get recent redemption requests for the user (convenience method)
   * @param limit - Maximum number of entries to return
   */
  getRecentRedemptionRequests(limit: number = 5): Observable<UserRedemptionRequestResponse[]> {
    return this.getMyRedemptionRequests(0, limit).pipe(
      map(response => response.items)
    );
  }

  // ============================================
  // Product Redemption
  // ============================================

  /**
   * Submit a redemption request for a product with specified quantity.
   * The backend validates:
   * - User has sufficient available points for total cost (pointsCost * quantity)
   * - Product is active and has sufficient stock
   * - No duplicate pending request for same product
   * - Quantity is positive and not exceeding maximum (99)
   * 
   * @param userId - The authenticated user's ID
   * @param productId - The product to redeem
   * @param quantity - The quantity to redeem (default: 1)
   * @returns Observable with the created request ID
   */
  submitRedemptionRequest(userId: string, productId: string, quantity: number = 1): Observable<{ Id: string }> {
    const request: SubmitRedemptionRequest = { userId, productId, quantity };
    return this.http.post<{ Id: string }>(`${this.API_URL}/redemption-requests`, request);
  }

  /**
   * Get all products (including inactive for admin views)
   * @param onlyActive - If true, returns only active products
   */
  getAllProducts(onlyActive: boolean = false): Observable<Product[]> {
    const params = `?onlyActive=${onlyActive}`;
    return this.http.get<{ data: Product[]; total: number; page: number; limit: number; totalPages: number }>(`${this.API_URL}/products${params}`).pipe(
      map(response => response.data)
    );
  }
}
