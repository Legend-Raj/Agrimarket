import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Product,
  ProductCategory,
  PaginatedProducts,
  ProductFilters,
  ProductStatus,
  FilterOptions,
} from '../models/product.models';

/**
 * ProductService - Handles all product-related API calls
 *
 * Responsibilities:
 * - Fetch products with filters
 * - Fetch product categories
 * - Fetch single product
 * - Fetch nearby products
 *
 * All methods return Observables for proper async handling
 */
@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  // ============================================
  // Products
  // ============================================

  /**
   * Get products with filters and pagination
   * @param filters - Optional filters for search, category, price range, etc.
   *
   * Multi-select support:
   * - categoryIds: Array of category IDs (OR logic within)
   * - sellerIds: Array of seller IDs (OR logic within)
   * - Different filters combine with AND logic
   */
  getProducts(filters?: ProductFilters): Observable<PaginatedProducts> {
    let params = new HttpParams();

    if (filters) {
      if (filters.search) params = params.set('search', filters.search);

      // Handle category filters - support both single and array
      if (filters.categoryIds && filters.categoryIds.length > 0) {
        // Multiple categories: send as comma-separated string
        params = params.set('categoryIds', filters.categoryIds.join(','));
      } else if (filters.categoryId) {
        // Single category (backward compatibility)
        params = params.set('categoryId', filters.categoryId);
      }

      if (filters.status) params = params.set('status', filters.status);

      if (filters.minPrice !== undefined) {
        params = params.set('minPrice', filters.minPrice.toString());
      }
      if (filters.maxPrice !== undefined) {
        params = params.set('maxPrice', filters.maxPrice.toString());
      }
      if (filters.page) params = params.set('page', filters.page.toString());
      if (filters.limit) params = params.set('limit', filters.limit.toString());
      if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);

      // Handle seller filters - support both single and array
      if (filters.sellerIds && filters.sellerIds.length > 0) {
        // Multiple sellers: send as comma-separated string
        params = params.set('sellerIds', filters.sellerIds.join(','));
      } else if (filters.sellerId) {
        // Single seller (backward compatibility)
        params = params.set('sellerId', filters.sellerId);
      }

      if (filters.manufacturer) {
        params = params.set('manufacturer', filters.manufacturer);
      }
    }

    return this.http.get<PaginatedProducts>(`${this.API_URL}/products`, { params });
  }

  /**
   * Get dynamic filter options from the backend.
   * Used to populate the filter sidebar with real data.
   */
  getFilterOptions(): Observable<FilterOptions> {
    return this.http.get<FilterOptions>(`${this.API_URL}/products/filters`);
  }

  /**
   * Get featured products (latest active products)
   * @param limit - Maximum number of products to return
   */
  getFeaturedProducts(limit: number = 8): Observable<Product[]> {
    return this.getProducts({
      status: ProductStatus.ACTIVE,
      page: 1,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    }).pipe(map((response) => response.data));
  }

  /**
   * Get single product by ID
   * @param id - Product UUID
   */
  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.API_URL}/products/${id}`);
  }

  /**
   * Get products by category
   * @param categoryId - Category UUID
   * @param limit - Maximum number of products
   */
  getProductsByCategory(categoryId: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('categoryId', categoryId);
    if (limit) params = params.set('limit', limit.toString());

    return this.http
      .get<PaginatedProducts>(`${this.API_URL}/products`, { params })
      .pipe(map((response) => response.data));
  }

  /**
   * Get nearby products based on user location
   * @param latitude - User latitude
   * @param longitude - User longitude
   * @param limit - Maximum number of products
   */
  getNearbyProducts(
    latitude: number,
    longitude: number,
    limit: number = 20
  ): Observable<Product[]> {
    const params = new HttpParams()
      .set('latitude', latitude.toString())
      .set('longitude', longitude.toString())
      .set('limit', limit.toString());

    return this.http
      .get<PaginatedProducts>(`${this.API_URL}/products/nearby`, { params })
      .pipe(map((response) => response.data));
  }

  /**
   * Search products
   * @param query - Search query string
   * @param limit - Maximum number of products
   */
  searchProducts(query: string, limit: number = 20): Observable<Product[]> {
    return this.getProducts({
      search: query,
      status: ProductStatus.ACTIVE,
      limit,
    }).pipe(map((response) => response.data));
  }

  // ============================================
  // Categories
  // ============================================

  /**
   * Get all product categories
   */
  getCategories(): Observable<ProductCategory[]> {
    return this.http.get<ProductCategory[]>(`${this.API_URL}/products/categories`);
  }

  /**
   * Get single category by ID
   * @param id - Category UUID
   */
  getCategoryById(id: string): Observable<ProductCategory> {
    return this.http.get<ProductCategory>(`${this.API_URL}/products/categories/${id}`);
  }
}
