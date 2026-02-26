import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, DashboardService } from '../../core/services';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { Event as RewardEvent, Product, UserResponse, LedgerEntry } from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { NotificationDropdownComponent } from '../../shared/components/notification-dropdown/notification-dropdown.component';

/**
 * User Dashboard Component
 * 
 * Main dashboard for employees showing:
 * - Navigation header with profile dropdown
 * - Points balance overview (Total, Available, Locked)
 * - Recent Events list
 * - New Arrivals (Products) grid
 * 
 * All data is fetched from real backend APIs.
 */
@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FooterComponent, NotificationDropdownComponent],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.css'
})
export class UserDashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // User State
  readonly userName = signal<string>('');
  readonly userEmail = signal<string>('');
  readonly userId = signal<string>('');
  readonly userFirstName = signal<string>('');

  // Points Balance State
  readonly totalPoints = signal<number>(0);
  readonly availablePoints = signal<number>(0);
  readonly lockedPoints = signal<number>(0);

  // Dashboard Data State
  readonly recentEvents = signal<RewardEvent[]>([]);
  readonly newArrivals = signal<Product[]>([]);
  readonly pointsHistory = signal<LedgerEntry[]>([]);

  // UI State
  readonly isLoading = signal<boolean>(true);
  readonly isProfileDropdownOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // Computed values
  readonly userInitial = computed(() => {
    const name = this.userFirstName() || this.userName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  readonly currentYear = new Date().getFullYear();

  // Navigation items
  readonly navItems = [
    { label: 'Home', route: '/dashboard', icon: 'home', active: true },
    { label: 'Events', route: '/events', icon: 'calendar' },
    { label: 'Products', route: '/products', icon: 'gift' },
    { label: 'Transactions', route: '/transactions', icon: 'receipt' },

  ];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Close dropdowns when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Close profile dropdown if clicking outside
    if (!target.closest('.profile-menu-container')) {
      this.isProfileDropdownOpen.set(false);
    }
  }

  /**
   * Load all dashboard data from backend APIs
   */
  private loadDashboardData(): void {
    this.isLoading.set(true);

    // First, get current user info
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: CurrentUserResponse) => {
          this.userName.set(user.name || user.email.split('@')[0]);
          this.userEmail.set(user.email);
          this.userId.set(user.userId);
          
          // Extract first name from full name
          const nameParts = user.name?.split(' ') || [];
          this.userFirstName.set(nameParts[0] || user.email.split('@')[0]);

          // Load additional dashboard data
          this.loadUserBalance(user.userId);
          this.loadRecentEvents();
          this.loadNewArrivals();
          this.loadPointsHistory(user.userId);
        },
        error: (error) => {
          console.error('Failed to load user info:', error);
          // Use cached user info if available
          const cachedUser = this.authService.user();
          if (cachedUser) {
            this.userName.set(cachedUser.email.split('@')[0]);
            this.userEmail.set(cachedUser.email);
            this.userId.set(cachedUser.id);
          }
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Load user balance data
   */
  private loadUserBalance(userId: string): void {
    this.dashboardService.getUserById(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: UserResponse) => {
          this.totalPoints.set(user.totalPoints);
          this.availablePoints.set(user.availablePoints);
          this.lockedPoints.set(user.lockedPoints);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load user balance:', error);
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Load recent events
   */
  private loadRecentEvents(): void {
    this.dashboardService.getRecentEvents(5)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events: RewardEvent[]) => {
          this.recentEvents.set(events);
        },
        error: (error) => {
          console.error('Failed to load events:', error);
        }
      });
  }

  /**
   * Load new product arrivals
   */
  private loadNewArrivals(): void {
    this.dashboardService.getNewArrivals(4)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products: Product[]) => {
          this.newArrivals.set(products);
        },
        error: (error) => {
          console.error('Failed to load products:', error);
        }
      });
  }

  /**
   * Load points history
   */
  private loadPointsHistory(userId: string): void {
    this.dashboardService.getRecentPointsHistory(userId, 5)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history: LedgerEntry[]) => {
          this.pointsHistory.set(history);
        },
        error: (error) => {
          console.error('Failed to load points history:', error);
        }
      });
  }

  /**
   * Toggle profile dropdown
   */
  toggleProfileDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileDropdownOpen.update(v => !v);
  }

  /**
   * Toggle mobile menu
   */
  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  /**
   * Handle logout
   */
  onLogout(): void {
    this.isProfileDropdownOpen.set(false);
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  /**
   * Navigate to profile page
   */
  onProfile(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/profile']);
  }

  /**
   * Navigate to change password
   */
  onChangePassword(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/change-password']);
  }

  /**
   * Format date for display
   */
  formatEventDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Format points number with commas
   */
  formatPoints(points: number): string {
    return points.toLocaleString('en-US');
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
}
