import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Promotion, Bundle, ValidationResult } from '../models/promotion.models';

/**
 * PromotionService - Handles all promotion-related API calls
 *
 * Responsibilities:
 * - Fetch active promotions
 * - Fetch bundles
 * - Validate promotion codes
 *
 * All methods return Observables for proper async handling
 */
@Injectable({
  providedIn: 'root',
})
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  // ============================================
  // Promotions
  // ============================================

  /**
   * Get all active promotions
   */
  getActivePromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(`${this.API_URL}/promotions`);
  }

  /**
   * Get single promotion by code
   * @param code - Promotion code
   */
  getPromotionByCode(code: string): Observable<Promotion> {
    return this.http.get<Promotion>(`${this.API_URL}/promotions/${code}`);
  }

  /**
   * Validate a promotion code
   * @param code - Promotion code to validate
   * @param orderAmount - Optional order amount for minimum order validation
   */
  validatePromotion(code: string, orderAmount?: number): Observable<ValidationResult> {
    return this.http.post<ValidationResult>(`${this.API_URL}/promotions/validate`, {
      code,
      ...(orderAmount !== undefined && { orderAmount }),
    });
  }

  // ============================================
  // Bundles
  // ============================================

  /**
   * Get all active bundles
   */
  getActiveBundles(): Observable<Bundle[]> {
    return this.http.get<Bundle[]>(`${this.API_URL}/promotions/bundles`);
  }

  /**
   * Get single bundle by ID
   * @param id - Bundle UUID
   */
  getBundleById(id: string): Observable<Bundle> {
    return this.http.get<Bundle>(`${this.API_URL}/promotions/bundles/${id}`);
  }
}
