import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AuthService, DashboardService } from '../../core/services';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { Product, UserResponse } from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { NotificationDropdownComponent } from '../../shared/components/notification-dropdown/notification-dropdown.component';

/**
 * Products Component
 * 
 * Displays all available products for redemption.
 * Shows product details, stock status, and enables redemption.
 * 
 * Features:
 * - Real-time user points display
 * - Product cards with status indicators
 * - Redemption flow with validation
 * - Points balance auto-update after redemption
 * 
 * Security: All redemption validations are performed server-side.
 * Frontend validations are for UX only.
 */
@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink, FooterComponent, NotificationDropdownComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // User State
  readonly userName = signal<string>('');
  readonly userEmail = signal<string>('');
  readonly userId = signal<string>('');
  readonly userFirstName = signal<string>('');

  // Points State
  readonly totalPoints = signal<number>(0);
  readonly availablePoints = signal<number>(0);
  readonly lockedPoints = signal<number>(0);

  // Products State
  readonly products = signal<Product[]>([]);
  readonly searchQuery = signal<string>('');

  // Filtered products based on search
  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const allProducts = this.products();
    
    if (!query) {
      return allProducts;
    }
    
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  });

  // UI State
  readonly isLoading = signal<boolean>(true);
  readonly isRedeeming = signal<boolean>(false);
  readonly redeemingProductId = signal<string | null>(null);
  readonly isProfileDropdownOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // Confirmation Modal State
  readonly showConfirmModal = signal<boolean>(false);
  readonly productToRedeem = signal<Product | null>(null);
  readonly quantityToRedeem = signal<number>(1);
  readonly quantityError = signal<string>('');

  // Maximum quantity per redemption (matches backend)
  readonly maxQuantityPerRequest = 99;

  // Toast State
  readonly showToast = signal<boolean>(false);
  readonly toastMessage = signal<string>('');
  readonly toastType = signal<'success' | 'error' | 'info'>('info');


  // Computed values
  readonly userInitial = computed(() => {
    const name = this.userFirstName() || this.userName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  readonly activeProductsCount = computed(() => 
    this.filteredProducts().filter(p => p.isActive).length
  );

  // Computed total points for quantity
  readonly totalPointsForQuantity = computed(() => {
    const product = this.productToRedeem();
    const quantity = this.quantityToRedeem();
    if (!product) return 0;
    return product.pointsCost * quantity;
  });

  // Check if user can afford the selected quantity
  readonly canAffordQuantity = computed(() => {
    return this.availablePoints() >= this.totalPointsForQuantity();
  });

  // Get max quantity user can afford for the selected product
  readonly maxAffordableQuantity = computed(() => {
    const product = this.productToRedeem();
    if (!product || product.pointsCost <= 0) return 0;
    return Math.floor(this.availablePoints() / product.pointsCost);
  });

  // Get max quantity based on stock
  readonly maxStockQuantity = computed(() => {
    const product = this.productToRedeem();
    if (!product) return 0;
    return product.stock ?? this.maxQuantityPerRequest;
  });

  // Method to handle search input
  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // Clear search
  clearSearch(): void {
    this.searchQuery.set('');
  }

  readonly currentYear = new Date().getFullYear();

  // Expose Math for template usage
  readonly Math = Math;

  // Navigation items - Products is active
  readonly navItems = [
    { label: 'Home', route: '/dashboard', icon: 'home', active: false },
    { label: 'Events', route: '/events', icon: 'calendar', active: false },
    { label: 'Products', route: '/products', icon: 'gift', active: true },
    { label: 'Transactions', route: '/transactions', icon: 'receipt', active: false }
  ];

  ngOnInit(): void {
    this.loadUserInfo();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-menu-container')) {
      this.isProfileDropdownOpen.set(false);
    }
    if (!target.closest('.notifications-container')) {
      this.isNotificationsOpen.set(false);
    }
  }

  private loadUserInfo(): void {
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: CurrentUserResponse) => {
          this.userName.set(user.name || user.email.split('@')[0]);
          this.userEmail.set(user.email);
          this.userId.set(user.userId);
          const nameParts = user.name?.split(' ') || [];
          this.userFirstName.set(nameParts[0] || user.email.split('@')[0]);
          this.loadUserBalance(user.userId);
          this.loadProducts();
        },
        error: (error) => {
          console.error('Failed to load user info:', error);
          const cachedUser = this.authService.user();
          if (cachedUser) {
            this.userName.set(cachedUser.email.split('@')[0]);
            this.userEmail.set(cachedUser.email);
            this.userId.set(cachedUser.id);
          }
          this.loadProducts();
        }
      });
  }

  private loadUserBalance(userId: string): void {
    this.dashboardService.getUserById(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: UserResponse) => {
          this.totalPoints.set(user.totalPoints);
          this.availablePoints.set(user.availablePoints);
          this.lockedPoints.set(user.lockedPoints);
        },
        error: (error) => {
          console.error('Failed to load user balance:', error);
        }
      });
  }

  private loadProducts(): void {
    this.isLoading.set(true);
    this.dashboardService.getProducts(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products: Product[]) => {
          // Sort by active first, then by points cost
          const sorted = products.sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return a.pointsCost - b.pointsCost;
          });
          this.products.set(sorted);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load products:', error);
          this.products.set([]);
          this.isLoading.set(false);
          this.displayToast('Failed to load products. Please try again.', 'error');
        }
      });
  }

  /**
   * Check if user can redeem a product
   * Note: This is for UI indication only. Actual validation is done server-side.
   */
  canRedeem(product: Product): boolean {
    return product.isActive && 
           this.availablePoints() >= product.pointsCost &&
           this.isInStock(product);
  }

  /**
   * Check if product has insufficient points for redemption
   */
  hasInsufficientPoints(product: Product): boolean {
    return product.isActive && 
           this.availablePoints() < product.pointsCost &&
           this.isInStock(product);
  }

  /**
   * Check if product is in stock
   */
  isInStock(product: Product): boolean {
    return product.stock === null || product.stock > 0;
  }

  /**
   * Get stock display text
   */
  getStockDisplay(product: Product): string {
    if (product.stock === null) return 'Unlimited';
    if (product.stock === 0) return 'Out of Stock';
    if (product.stock <= 5) return `Only ${product.stock} left`;
    return `${product.stock} available`;
  }

  /**
   * Get stock status class
   */
  getStockClass(product: Product): string {
    if (product.stock === null) return 'stock-unlimited';
    if (product.stock === 0) return 'stock-out';
    if (product.stock <= 5) return 'stock-low';
    return 'stock-available';
  }

  /**
   * Handle redeem button click - show confirmation modal
   */
  onRedeem(product: Product): void {
    // Don't proceed if already redeeming or cannot redeem
    if (this.isRedeeming() || !this.canRedeem(product)) {
      return;
    }

    const userId = this.userId();
    if (!userId) {
      this.displayToast('Please log in to redeem products.', 'error');
      return;
    }

    // Reset quantity and error state
    this.quantityToRedeem.set(1);
    this.quantityError.set('');
    
    // Show confirmation modal
    this.productToRedeem.set(product);
    this.showConfirmModal.set(true);
  }

  /**
   * Handle quantity input change with validation
   */
  onQuantityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Clear previous error
    this.quantityError.set('');
    
    // Parse the value
    const quantity = parseInt(value, 10);
    
    // Validate
    if (isNaN(quantity) || !Number.isInteger(quantity)) {
      this.quantityError.set('Please enter a whole number.');
      this.quantityToRedeem.set(1);
      return;
    }
    
    if (quantity <= 0) {
      this.quantityError.set('Quantity must be at least 1.');
      this.quantityToRedeem.set(1);
      return;
    }
    
    if (quantity > this.maxQuantityPerRequest) {
      this.quantityError.set(`Maximum ${this.maxQuantityPerRequest} items per request.`);
      this.quantityToRedeem.set(this.maxQuantityPerRequest);
      return;
    }
    
    const product = this.productToRedeem();
    if (product) {
      // Check stock limit
      if (product.stock !== null && quantity > product.stock) {
        this.quantityError.set(`Only ${product.stock} in stock.`);
        this.quantityToRedeem.set(product.stock);
        return;
      }
      
      // Check points limit
      const totalCost = product.pointsCost * quantity;
      if (totalCost > this.availablePoints()) {
        const maxAffordable = Math.floor(this.availablePoints() / product.pointsCost);
        this.quantityError.set(`Insufficient points. Max you can afford: ${maxAffordable}`);
        this.quantityToRedeem.set(Math.max(1, maxAffordable));
        return;
      }
    }
    
    this.quantityToRedeem.set(quantity);
  }

  /**
   * Increment quantity
   */
  incrementQuantity(): void {
    const current = this.quantityToRedeem();
    const product = this.productToRedeem();
    if (!product) return;
    
    const maxStock = product.stock ?? this.maxQuantityPerRequest;
    const maxAffordable = Math.floor(this.availablePoints() / product.pointsCost);
    const max = Math.min(maxStock, maxAffordable, this.maxQuantityPerRequest);
    
    if (current < max) {
      this.quantityToRedeem.set(current + 1);
      this.quantityError.set('');
    }
  }

  /**
   * Decrement quantity
   */
  decrementQuantity(): void {
    const current = this.quantityToRedeem();
    if (current > 1) {
      this.quantityToRedeem.set(current - 1);
      this.quantityError.set('');
    }
  }

  /**
   * Cancel redemption - close modal
   */
  cancelRedeem(): void {
    this.showConfirmModal.set(false);
    this.productToRedeem.set(null);
    this.quantityToRedeem.set(1);
    this.quantityError.set('');
  }

  /**
   * Confirm redemption - actually submit the request
   */
  confirmRedeem(): void {
    const product = this.productToRedeem();
    if (!product) return;

    const quantity = this.quantityToRedeem();
    
    // Final validation before submitting
    if (quantity <= 0 || quantity > this.maxQuantityPerRequest) {
      this.quantityError.set('Invalid quantity.');
      return;
    }
    
    if (!this.canAffordQuantity()) {
      this.quantityError.set('Insufficient points for this quantity.');
      return;
    }

    const userId = this.userId();
    if (!userId) {
      this.displayToast('Please log in to redeem products.', 'error');
      this.cancelRedeem();
      return;
    }

    this.showConfirmModal.set(false);
    this.isRedeeming.set(true);
    this.redeemingProductId.set(product.id);

    this.dashboardService.submitRedemptionRequest(userId, product.id, quantity)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isRedeeming.set(false);
          this.redeemingProductId.set(null);
        })
      )
      .subscribe({
        next: (response) => {
          const message = quantity > 1 
            ? `Successfully requested ${quantity}x "${product.name}"! Your request is being processed.`
            : `Successfully requested "${product.name}"! Your request is being processed.`;
          this.displayToast(message, 'success');
          // Refresh user balance (points will be locked)
          this.loadUserBalance(userId);
          // Optionally refresh products to update stock
          this.loadProducts();
          // Clear the product to redeem
          this.productToRedeem.set(null);
          this.quantityToRedeem.set(1);
        },
        error: (error) => {
          console.error('Redemption failed:', error);
          let errorMessage = 'Failed to submit redemption request. Please try again.';
          
          // Parse error response - check detail first (ProblemDetails format)
          if (error.error?.detail) {
            errorMessage = error.error.detail;
          } else if (error.error?.error) {
            errorMessage = error.error.error;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (typeof error.error === 'string') {
            errorMessage = error.error;
          }

          this.displayToast(errorMessage, 'error');
        }
      });
  }

  /**
   * Display toast notification
   */
  private displayToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.showToast.set(true);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.showToast.set(false);
    }, 5000);
  }

  /**
   * Close toast manually
   */
  closeToast(): void {
    this.showToast.set(false);
  }

  formatPoints(points: number): string {
    return points.toLocaleString('en-US');
  }

  // UI Toggle methods
  toggleProfileDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileDropdownOpen.update(v => !v);
    this.isNotificationsOpen.set(false);
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.isNotificationsOpen.update(v => !v);
    this.isProfileDropdownOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  onLogout(): void {
    this.isProfileDropdownOpen.set(false);
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  onProfile(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/profile']);
  }

  onChangePassword(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/change-password']);
  }
}
