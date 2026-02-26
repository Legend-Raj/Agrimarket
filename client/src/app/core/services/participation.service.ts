import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  EventParticipationResponse,
  ParticipationStatusResponse,
  ParticipantCountResponse,
  PagedParticipationsResponse,
  BulkEarnWithTeamResponse,
  EarnPointsWithTeamRequest,
  EarnPointsForParticipantsRequest,
  ParticipantUserResponse,
  AllocatePointsRequest,
  BulkAllocatePointsRequest
} from '../models/participation.models';

/**
 * Raw API response for participation status check.
 * Matches backend ParticipationStatusResponse exactly.
 * Note: Backend uses 'hasParticipated' while frontend model uses 'isParticipating'.
 */
interface ParticipationStatusApiResponse {
  eventId: string;
  userId: string;
  hasParticipated: boolean;
  participatedAt: string | null;
}

/**
 * ParticipationService - Handles all event participation-related API calls
 * 
 * Responsibilities:
 * - Participate in events
 * - Cancel participation
 * - Check participation status
 * - Get user's participations
 * - Admin: Get event participants
 * - Admin: Award points with team support
 * 
 * Security:
 * - User endpoints are user-scoped via JWT token
 * - Admin endpoints require AdminOnly authorization
 * 
 * All methods return Observables for proper async handling
 */
@Injectable({
  providedIn: 'root'
})
export class ParticipationService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;
  
  // Reactive state using signals for tracking participation status
  private readonly _participationCache = signal<Map<string, ParticipationStatusResponse>>(new Map());
  private readonly _isLoading = signal<boolean>(false);
  
  // Public readonly signals
  readonly isLoading = this._isLoading.asReadonly();

  // ============================================
  // User Endpoints
  // ============================================

  /**
   * Participate in an event
   * @param eventId - The event ID to participate in
   */
  participateInEvent(eventId: string): Observable<EventParticipationResponse> {
    this._isLoading.set(true);
    
    return this.http.post<EventParticipationResponse>(
      `${this.API_URL}/events/${eventId}/participate`,
      {}
    ).pipe(
      tap(response => {
        // Update cache
        this._participationCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(eventId, {
            isParticipating: true,
            participationId: response.id,
            participatedAt: response.participatedAt,
            status: response.status
          });
          return newCache;
        });
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        console.error('ParticipationService: Failed to participate in event', error);
        throw error;
      })
    );
  }

  /**
   * Cancel participation in an event
   * @param eventId - The event ID to cancel participation for
   */
  cancelParticipation(eventId: string): Observable<void> {
    this._isLoading.set(true);
    
    return this.http.delete<void>(
      `${this.API_URL}/events/${eventId}/participate`
    ).pipe(
      tap(() => {
        // Update cache
        this._participationCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(eventId, {
            isParticipating: false,
            participationId: null,
            participatedAt: null,
            status: null
          });
          return newCache;
        });
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        console.error('ParticipationService: Failed to cancel participation', error);
        throw error;
      })
    );
  }

  /**
   * Get participation status for a specific event
   * @param eventId - The event ID to check
   */
  getParticipationStatus(eventId: string): Observable<ParticipationStatusResponse> {
    // Check cache first
    const cached = this._participationCache().get(eventId);
    if (cached !== undefined) {
      return of(cached);
    }
    
    // Fetch from API and transform response to match frontend model
    return this.http.get<ParticipationStatusApiResponse>(
      `${this.API_URL}/events/${eventId}/my-participation`
    ).pipe(
      map(apiResponse => this.transformParticipationStatus(apiResponse)),
      tap(normalizedResponse => {
        // Update cache with normalized response
        this._participationCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(eventId, normalizedResponse);
          return newCache;
        });
      }),
      catchError(error => {
        console.error('ParticipationService: Failed to get participation status', error);
        // Return default response on error
        return of({
          isParticipating: false,
          participationId: null,
          participatedAt: null,
          status: null
        });
      })
    );
  }

  /**
   * Get all user's event participations with pagination
   * @param skip - Number of records to skip
   * @param take - Number of records to take
   */
  getMyParticipations(
    skip: number = 0,
    take: number = 50
  ): Observable<PagedParticipationsResponse> {
    return this.http.get<PagedParticipationsResponse>(
      `${this.API_URL}/events/my-participations?skip=${skip}&take=${take}`
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to get participations', error);
        return of({ items: [], totalCount: 0, skip, take });
      })
    );
  }

  /**
   * Check if user is participating in event (from cache or API)
   * @param eventId - The event ID to check
   */
  isParticipating(eventId: string): Observable<boolean> {
    return this.getParticipationStatus(eventId).pipe(
      map(status => status.isParticipating)
    );
  }

  /**
   * Clear participation cache
   * Called when user logs out or when we need fresh data
   */
  clearCache(): void {
    this._participationCache.set(new Map());
  }

  /**
   * Invalidate cache for a specific event
   * @param eventId - The event ID to invalidate
   */
  invalidateCache(eventId: string): void {
    this._participationCache.update(cache => {
      const newCache = new Map(cache);
      newCache.delete(eventId);
      return newCache;
    });
  }

  // ============================================
  // Admin Endpoints
  // ============================================

  /**
   * Get participants for an event (admin only)
   * @param eventId - The event ID
   * @param skip - Number of records to skip
   * @param take - Number of records to take
   */
  getEventParticipants(
    eventId: string,
    skip: number = 0,
    take: number = 100
  ): Observable<PagedParticipationsResponse> {
    return this.http.get<PagedParticipationsResponse>(
      `${this.API_URL}/admin/events/${eventId}/participants?skip=${skip}&take=${take}`
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to get event participants', error);
        return of({ items: [], totalCount: 0, skip, take });
      })
    );
  }

  /**
   * Get participant count for an event (admin only)
   * @param eventId - The event ID
   */
  getParticipantCount(eventId: string): Observable<ParticipantCountResponse> {
    return this.http.get<ParticipantCountResponse>(
      `${this.API_URL}/admin/events/${eventId}/participants/count`
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to get participant count', error);
        return of({ eventId, count: 0 });
      })
    );
  }

  /**
   * Get participant user IDs for an event (admin only)
   * @param eventId - The event ID
   */
  getParticipantIds(eventId: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.API_URL}/admin/events/${eventId}/participants/ids`
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to get participant IDs', error);
        return of([]);
      })
    );
  }

  /**
   * Get participant users with details for an event (admin only)
   * Includes user info and whether they've received points for this event.
   * @param eventId - The event ID
   */
  getParticipantUsers(eventId: string): Observable<ParticipantUserResponse[]> {
    return this.http.get<ParticipantUserResponse[]>(
      `${this.API_URL}/admin/events/${eventId}/participants/users`
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to get participant users', error);
        return of([]);
      })
    );
  }

  /**
   * Remove a participant from an event (admin only)
   * Only allowed for upcoming events.
   * @param eventId - The event ID
   * @param userId - The user ID to remove
   */
  removeParticipant(eventId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.API_URL}/admin/events/${eventId}/participants/${userId}`
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to remove participant', error);
        throw error;
      })
    );
  }

  /**
   * Award points with team name support (admin only)
   * @param request - The bulk earn request with team info
   */
  earnPointsWithTeam(request: EarnPointsWithTeamRequest): Observable<BulkEarnWithTeamResponse> {
    return this.http.post<BulkEarnWithTeamResponse>(
      `${this.API_URL}/admin/points/earn-team`,
      request
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to earn points with team', error);
        throw error;
      })
    );
  }

  /**
   * Award points to all event participants (admin only)
   * @param request - The earn for participants request
   */
  earnPointsForParticipants(request: EarnPointsForParticipantsRequest): Observable<BulkEarnWithTeamResponse> {
    return this.http.post<BulkEarnWithTeamResponse>(
      `${this.API_URL}/admin/points/earn-participants`,
      request
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to earn points for participants', error);
        throw error;
      })
    );
  }

  /**
   * Allocate points to a single participant (admin only)
   * Uses the new event-first workflow with duplicate prevention.
   * @param request - The allocation request
   */
  allocatePointsToParticipant(request: AllocatePointsRequest): Observable<BulkEarnWithTeamResponse> {
    return this.http.post<BulkEarnWithTeamResponse>(
      `${this.API_URL}/admin/points/allocate`,
      request
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to allocate points to participant', error);
        throw error;
      })
    );
  }

  /**
   * Bulk allocate points to participants (admin only)
   * Supports both Individual (each gets full amount) and Total (divided evenly) allocation.
   * @param request - The bulk allocation request
   */
  bulkAllocatePointsToParticipants(request: BulkAllocatePointsRequest): Observable<BulkEarnWithTeamResponse> {
    return this.http.post<BulkEarnWithTeamResponse>(
      `${this.API_URL}/admin/points/allocate-bulk`,
      request
    ).pipe(
      catchError(error => {
        console.error('ParticipationService: Failed to bulk allocate points', error);
        throw error;
      })
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Transform raw API response to frontend model.
   * Maps backend 'hasParticipated' to frontend 'isParticipating'.
   * @param apiResponse - Raw response from backend API
   * @returns Normalized ParticipationStatusResponse for frontend consumption
   */
  private transformParticipationStatus(apiResponse: ParticipationStatusApiResponse): ParticipationStatusResponse {
    return {
      isParticipating: apiResponse.hasParticipated,
      participationId: null, // Not provided by this endpoint
      participatedAt: apiResponse.participatedAt,
      status: apiResponse.hasParticipated ? 'Registered' : null
    };
  }
}
