import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService, DashboardService } from '../../core/services';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { 
  UserRedemptionRequestResponse, 
  RedemptionRequestStatus,
  PagedResponse,
  normalizeStatus,
  normalizeLedgerType,
  LedgerEntry,
  UnifiedTransaction,
  UnifiedTransactionType,
  Event as RewardEvent
} from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { NotificationDropdownComponent } from '../../shared/components/notification-dropdown/notification-dropdown.component';

/**
 * Transactions Component
 * 
 * Displays the authenticated user's complete transaction history,
 * including both earning transactions (from events) and redemption transactions.
 * Shows transaction type, source/product, points, date/time, and status for redemptions.
 * 
 * Security: This page fetches data from secure endpoints that
 * determine user identity from the JWT token - no user ID is passed
 * as a parameter, preventing IDOR attacks.
 */
@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, RouterLink, FooterComponent, NotificationDropdownComponent],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.css'
})
export class TransactionsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // User State
  readonly userName = signal<string>('');
  readonly userEmail = signal<string>('');
  readonly userFirstName = signal<string>('');

  // Transactions State - Unified transactions combining earning and redemption
  readonly transactions = signal<UnifiedTransaction[]>([]);
  readonly totalCount = signal<number>(0);
  readonly currentPage = signal<number>(1);
  readonly pageSize = 10;
  readonly typeFilter = signal<string>('');  // 'Earn', 'Redeem', or '' for all
  readonly statusFilter = signal<string>('');

  // Cache for events (to display event names for earning transactions)
  private eventsCache = signal<Map<string, RewardEvent>>(new Map());

  // UI State
  readonly isLoading = signal<boolean>(true);
  readonly isProfileDropdownOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // Computed values
  readonly userInitial = computed(() => {
    const name = this.userFirstName() || this.userName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  readonly totalPages = computed(() => 
    Math.ceil(this.totalCount() / this.pageSize) || 1
  );

  readonly hasNextPage = computed(() => 
    this.currentPage() < this.totalPages()
  );

  readonly hasPrevPage = computed(() => 
    this.currentPage() > 1
  );

  readonly currentYear = new Date().getFullYear();

  // Navigation items - Transactions is now active
  readonly navItems = [
    { label: 'Home', route: '/dashboard', icon: 'home', active: false },
    { label: 'Events', route: '/events', icon: 'calendar', active: false },
    { label: 'Products', route: '/products', icon: 'gift', active: false },
    { label: 'Transactions', route: '/transactions', icon: 'receipt', active: true }
  ];

  // Type filter options
  readonly typeOptions = [
    { value: '', label: 'All Transactions' },
    { value: 'Earn', label: 'Earnings Only' },
    { value: 'Redeem', label: 'Redemptions Only' }
  ];

  // Status filter options (applies to redemptions only)
  readonly statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Canceled', label: 'Canceled' }
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
          const nameParts = user.name?.split(' ') || [];
          this.userFirstName.set(nameParts[0] || user.email.split('@')[0]);
          this.loadTransactions();
        },
        error: (error) => {
          console.error('Failed to load user info:', error);
          const cachedUser = this.authService.user();
          if (cachedUser) {
            this.userName.set(cachedUser.email.split('@')[0]);
            this.userEmail.set(cachedUser.email);
          }
          this.loadTransactions();
        }
      });
  }

  /**
   * Load transactions from secure API endpoints.
   * Fetches both earning history and redemption requests,
   * then combines and sorts them chronologically.
   * The API identifies the user from the JWT token.
   */
  loadTransactions(): void {
    this.isLoading.set(true);
    const status = this.statusFilter() || undefined;
    const typeFilter = this.typeFilter();

    // Fetch all data we need (using max page size of 100 to comply with backend limits)
    forkJoin({
      // Fetch earning history (ledger entries)
      earningHistory: this.dashboardService.getMyPointsHistory(0, 100).pipe(
        catchError(() => of({ items: [], totalCount: 0, skip: 0, take: 100 }))
      ),
      // Fetch redemption requests
      redemptionHistory: this.dashboardService.getMyRedemptionRequests(0, 100, status).pipe(
        catchError(() => of({ items: [], totalCount: 0, skip: 0, take: 100 }))
      ),
      // Fetch events for event names
      events: this.dashboardService.getEvents(false).pipe(
        catchError(() => of([]))
      )
    }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ earningHistory, redemptionHistory, events }) => {
        // Cache events for lookup
        const eventsMap = new Map<string, RewardEvent>();
        events.forEach(event => eventsMap.set(event.id, event));
        this.eventsCache.set(eventsMap);

        // Convert earning transactions (only 'Earn' type entries)
        const earningTransactions: UnifiedTransaction[] = earningHistory.items
          .filter(entry => normalizeLedgerType(entry.type) === 'Earn')
          .map(entry => ({
            id: entry.id,
            type: 'Earn' as UnifiedTransactionType,
            points: entry.points,
            timestamp: entry.timestamp,
            eventId: entry.eventId,
            eventName: entry.eventId ? eventsMap.get(entry.eventId)?.name || 'Event' : 'Bonus'
          }));

        // Convert redemption transactions
        const redemptionTransactions: UnifiedTransaction[] = redemptionHistory.items.map(req => ({
          id: req.requestId,
          type: 'Redeem' as UnifiedTransactionType,
          points: req.pointsCost,
          timestamp: req.requestedAt,
          redemptionRequestId: req.requestId,
          productId: req.productId,
          productName: req.productName,
          productDescription: req.productDescription,
          productImageUrl: req.productImageUrl,
          redemptionStatus: req.status,
          approvedAt: req.approvedAt,
          deliveredAt: req.deliveredAt,
          quantity: req.quantity ?? 1,
          totalPointsCost: req.totalPointsCost ?? req.pointsCost
        }));

        // Combine and filter by type
        // IMPORTANT: If a status filter is applied, only show redemptions (status doesn't apply to earnings)
        let allTransactions: UnifiedTransaction[] = [];
        const hasStatusFilter = !!status;
        
        if (typeFilter === 'Earn') {
          // Only earnings - but if status filter is set, show nothing (status doesn't apply to earnings)
          allTransactions = hasStatusFilter ? [] : earningTransactions;
        } else if (typeFilter === 'Redeem') {
          allTransactions = redemptionTransactions;
        } else {
          // All transactions - but if status filter is set, only show redemptions
          allTransactions = hasStatusFilter 
            ? redemptionTransactions 
            : [...earningTransactions, ...redemptionTransactions];
        }

        // Sort by timestamp ascending (oldest first as per requirement)
        allTransactions.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Apply pagination
        const skip = (this.currentPage() - 1) * this.pageSize;
        const paginatedTransactions = allTransactions.slice(skip, skip + this.pageSize);

        this.transactions.set(paginatedTransactions);
        this.totalCount.set(allTransactions.length);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load transactions:', error);
        this.transactions.set([]);
        this.totalCount.set(0);
        this.isLoading.set(false);
      }
    });
  }

  onTypeFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.typeFilter.set(select.value);
    // Reset status filter when switching to Earn-only (status doesn't apply to earnings)
    if (select.value === 'Earn') {
      this.statusFilter.set('');
    }
    this.currentPage.set(1);
    this.loadTransactions();
  }

  onStatusFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value);
    this.currentPage.set(1);
    this.loadTransactions();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadTransactions();
    }
  }

  nextPage(): void {
    if (this.hasNextPage()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  prevPage(): void {
    if (this.hasPrevPage()) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  /**
   * Normalize status to string (handles both numeric and string values from API)
   */
  getStatusText(status: RedemptionRequestStatus): string {
    return normalizeStatus(status);
  }

  /**
   * Get CSS class for status badge
   */
  getStatusClass(status: RedemptionRequestStatus): string {
    const normalizedStatus = normalizeStatus(status);
    switch (normalizedStatus) {
      case 'Pending':
        return 'status-pending';
      case 'Approved':
        return 'status-approved';
      case 'Delivered':
        return 'status-delivered';
      case 'Rejected':
        return 'status-rejected';
      case 'Canceled':
        return 'status-canceled';
      default:
        return '';
    }
  }

  /**
   * Check if status matches a specific value (handles numeric/string)
   */
  isStatus(status: RedemptionRequestStatus, expected: string): boolean {
    return normalizeStatus(status) === expected;
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(transaction: UnifiedTransaction): string {
    if (transaction.type === 'Earn') {
      return 'Points earned';
    }
    if (!transaction.redemptionStatus) {
      return '';
    }
    const normalizedStatus = normalizeStatus(transaction.redemptionStatus);
    switch (normalizedStatus) {
      case 'Pending':
        return 'Awaiting approval';
      case 'Approved':
        return 'Approved, awaiting delivery';
      case 'Delivered':
        return 'Successfully delivered';
      case 'Rejected':
        return 'Request was rejected';
      case 'Canceled':
        return 'Request was canceled';
      default:
        return '';
    }
  }

  /**
   * Get the transaction source display text
   */
  getTransactionSource(transaction: UnifiedTransaction): string {
    if (transaction.type === 'Earn') {
      return transaction.eventName || 'Event Reward';
    }
    return transaction.productName || 'Product Redemption';
  }

  /**
   * Check if transaction is earning type
   */
  isEarning(transaction: UnifiedTransaction): boolean {
    return transaction.type === 'Earn';
  }

  /**
   * Check if transaction is redemption type
   */
  isRedemption(transaction: UnifiedTransaction): boolean {
    return transaction.type === 'Redeem';
  }

  /**
   * Get the display points value for a transaction.
   * Always shows the actual transaction amount regardless of status.
   * - Earning: show actual points
   * - Redemption (all statuses): show total points cost (quantity × unit price)
   */
  getDisplayPoints(transaction: UnifiedTransaction): number {
    if (transaction.type === 'Redeem' && transaction.totalPointsCost != null) {
      return transaction.totalPointsCost;
    }
    return transaction.points;
  }

  /**
   * Get the points prefix (+/-) for display.
   * - Earning: +
   * - Redemption Canceled/Rejected: (no prefix - points were refunded/never deducted)
   * - Redemption Pending/Approved/Delivered: -
   */
  getPointsPrefix(transaction: UnifiedTransaction): string {
    if (transaction.type === 'Earn') {
      return '+';
    }
    // For canceled/rejected redemptions, no prefix - these are informational only
    // (points were either refunded or never deducted)
    if (transaction.redemptionStatus) {
      const status = normalizeStatus(transaction.redemptionStatus);
      if (status === 'Canceled' || status === 'Rejected') {
        return '';
      }
    }
    return '-';
  }

  /**
   * Get the CSS class for points display based on transaction type and status.
   * - Earning: green (points-earned)
   * - Redemption Pending: yellow/warning (points-pending)
   * - Redemption Canceled: dark yellow (points-canceled)
   * - Redemption Rejected: dark yellow (points-canceled) 
   * - Redemption Approved/Delivered: red (points-redeemed)
   */
  getPointsClass(transaction: UnifiedTransaction): string {
    if (transaction.type === 'Earn') {
      return 'points-earned';
    }
    
    if (transaction.redemptionStatus) {
      const status = normalizeStatus(transaction.redemptionStatus);
      switch (status) {
        case 'Pending':
          return 'points-pending';
        case 'Canceled':
        case 'Rejected':
          return 'points-canceled';
        default:
          return 'points-redeemed';
      }
    }
    return 'points-redeemed';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
