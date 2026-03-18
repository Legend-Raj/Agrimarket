import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { PromotionService } from '../../core/services/promotion.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { GrowerNavbarComponent } from '../../shared/components/grower-navbar/grower-navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { FilterSidebarComponent } from '../../shared/components/filter-sidebar/filter-sidebar.component';
import { AiChatbotComponent } from '../../shared/components/ai-chatbot/ai-chatbot.component';
import { Product, isProductInStock, ProductStatus } from '../../core/models/product.models';
import { Promotion, isPromotionActive, getDiscountText, getValidityText } from '../../core/models/promotion.models';

/**
 * Grower Dashboard Component
 *
 * Main dashboard for Farmer/Grower users showing:
 * - Marketplace navbar with categories
 * - Featured products (from backend API)
 * - Current promotions (from backend API)
 * - User greeting
 */
@Component({
  selector: 'app-grower-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, GrowerNavbarComponent, FooterComponent, FilterSidebarComponent, AiChatbotComponent],
  templateUrl: './grower-dashboard.component.html',
  styleUrl: './grower-dashboard.component.css',
})
export class GrowerDashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly promotionService = inject(PromotionService);
  private readonly filterState = inject(FilterStateService);
  private subscriptions = new Subscription();

  // User state
  readonly userName = signal<string>('');
  readonly isLoading = signal<boolean>(true);
  readonly isInitialized = signal<boolean>(false);

  // Data from API
  readonly products = signal<Product[]>([]);
  readonly promotions = signal<Promotion[]>([]);

  // Error states
  readonly productsError = signal<boolean>(false);
  readonly promotionsError = signal<boolean>(false);

  // Computed values
  readonly userFirstName = computed(() => {
    const name = this.userName();
    return name.split(' ')[0] || 'Grower';
  });

  // Check if products are loaded
  readonly hasProducts = computed(() => this.products().length > 0);

  // Check if promotions are loaded
  readonly hasPromotions = computed(() => this.promotions().length > 0);

  ngOnInit(): void {
    console.log('[GrowerDashboard] ngOnInit - Setting up filter subscription');

    // Subscribe to filter changes from the filter sidebar
    // Use debounceTime to prevent rapid API calls when multiple filters change
    const filterSub = this.filterState.filtersChanged$.pipe(
      debounceTime(300) // Wait 300ms after last change before loading
    ).subscribe({
      next: () => {
        console.log('[GrowerDashboard] Filter change detected');
        this.onFiltersChanged();
      },
      error: (err) => {
        console.error('[GrowerDashboard] Filter subscription error:', err);
      }
    });

    this.subscriptions.add(filterSub);

    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    console.log('[GrowerDashboard] ngOnDestroy - Cleaning up subscriptions');
    this.subscriptions.unsubscribe();
  }

  private loadDashboardData(): void {
    console.log('[GrowerDashboard] Loading dashboard data...');
    this.isLoading.set(true);

    // Load user data first
    this.subscriptions.add(
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          console.log('[GrowerDashboard] User loaded:', user.name);
          this.userName.set(user.name || user.email.split('@')[0]);
        },
        error: (err) => {
          console.warn('[GrowerDashboard] User load error (using cached):', err);
          const cached = this.authService.user();
          this.userName.set(cached?.name ?? 'Grower');
        },
      })
    );

    // Load products and promotions in parallel
    this.loadProducts();
    this.loadPromotions();

    // Mark as initialized after a short delay
    // This ensures the subscription is active before any filter changes can happen
    setTimeout(() => {
      console.log('[GrowerDashboard] Dashboard initialized');
      this.isInitialized.set(true);
    }, 200);
  }

  private loadProducts(): void {
    console.log('[GrowerDashboard] Loading products...');
    this.productsError.set(false);

    const filters = {
      status: ProductStatus.ACTIVE,
      page: 1,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'DESC' as const,
    };

    // Apply search from filter state
    const search = this.filterState.searchQuery();
    if (search.trim()) {
      (filters as any).search = search.trim();
    }

    // Apply category filter - support multiple selections (OR logic)
    const selectedCats = this.filterState.selectedCategories();
    console.log('[GrowerDashboard] Selected categories:', selectedCats);
    if (selectedCats.length > 0) {
      // Send array for multiple categories with OR logic
      (filters as any).categoryIds = selectedCats;
    }

    // Apply manufacturer/seller filter - support multiple selections (OR logic)
    const selectedSellers = this.filterState.selectedSellerIds();
    console.log('[GrowerDashboard] Selected sellers:', selectedSellers);
    if (selectedSellers.length > 0) {
      // Send array for multiple sellers with OR logic
      (filters as any).sellerIds = selectedSellers;
    }

    // Apply price range filters
    const minPrice = this.filterState.minPrice();
    const maxPrice = this.filterState.maxPrice();
    if (minPrice !== undefined && minPrice > 0) {
      (filters as any).minPrice = minPrice;
    }
    if (maxPrice !== undefined && maxPrice > 0) {
      (filters as any).maxPrice = maxPrice;
    }

    console.log('[GrowerDashboard] API filters:', filters);

    this.subscriptions.add(
      this.productService.getProducts(filters).subscribe({
        next: (response) => {
          console.log('[GrowerDashboard] Products loaded:', response.data.length, 'items');
          let products = response.data;

          // Additional client-side filter: if "show only available" is on, filter out out-of-stock
          if (this.filterState.showOnlyAvailable()) {
            products = products.filter(p => isProductInStock(p));
          }

          this.products.set(products);
          this.isLoading.set(false);

          if (products.length === 0) {
            console.log('[GrowerDashboard] No products match the current filters');
          }
        },
        error: (err) => {
          console.error('[GrowerDashboard] Failed to load products:', err);
          this.productsError.set(true);
          this.products.set([]);
          this.isLoading.set(false);
        },
      })
    );
  }

  private loadPromotions(): void {
    console.log('[GrowerDashboard] Loading promotions...');
    this.promotionsError.set(false);
    this.subscriptions.add(
      this.promotionService.getActivePromotions().subscribe({
        next: (promotions) => {
          console.log('[GrowerDashboard] Promotions loaded:', promotions.length);
          // Filter to only show active promotions
          const activePromotions = promotions.filter(isPromotionActive);
          this.promotions.set(activePromotions.slice(0, 6)); // Limit to 6 promotions
        },
        error: (err) => {
          console.error('[GrowerDashboard] Failed to load promotions:', err);
          this.promotionsError.set(true);
          this.promotions.set([]);
        },
      })
    );
  }

  /**
   * Handle filter changes from filter sidebar.
   * This method is called when filters change via the RxJS subscription.
   */
  onFiltersChanged(): void {
    console.log('[GrowerDashboard] onFiltersChanged called, isInitialized:', this.isInitialized(), 'isLoading:', this.isLoading());

    // Always reload products when filters change (even during initial load)
    // The initial loadProducts() in ngOnInit will set isLoading, preventing double-calls
    if (!this.isLoading()) {
      console.log('[GrowerDashboard] Triggering product reload due to filter change');
      this.loadProducts();
    } else {
      console.log('[GrowerDashboard] Skipping reload - already loading');
    }
  }

  /**
   * Refresh products data
   */
  refreshProducts(): void {
    this.loadProducts();
  }

  /**
   * Search products using the filter state
   */
  onSearch(query: string): void {
    this.filterState.setSearch(query);
    // The subscription will handle the reload via onFiltersChanged
  }

  /**
   * Get greeting based on time of day
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Check if product is in stock
   */
  checkStock(product: Product): boolean {
    return isProductInStock(product);
  }

  /**
   * Get formatted price for display
   */
  formatPrice(price: number, currency: string = 'USD'): string {
    return `${currency} ${price.toLocaleString()}`;
  }

  /**
   * Get discount text for promotion
   */
  getDiscount(promotion: Promotion): string {
    return getDiscountText(promotion);
  }

  /**
   * Get validity text for promotion
   */
  getValidity(promotion: Promotion): string {
    return getValidityText(promotion);
  }

  /**
   * Get category name from product
   */
  getCategoryName(product: Product): string {
    return product.category?.name ?? 'General';
  }

  /**
   * Get seller name from product
   */
  getSellerName(product: Product): string {
    if (product.seller?.companyName) {
      return product.seller.companyName;
    }
    if (product.seller) {
      return `${product.seller.firstName} ${product.seller.lastName}`;
    }
    return 'Unknown Seller';
  }
}
