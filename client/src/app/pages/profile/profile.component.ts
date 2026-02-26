import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { AuthService, DashboardService } from '../../core/services';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { UserResponse } from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { NotificationDropdownComponent } from '../../shared/components/notification-dropdown/notification-dropdown.component';

/**
 * Profile Component
 * 
 * Displays user profile information in a clean, read-only format.
 * Data is fetched from existing backend APIs - no redundant calls.
 * 
 * REUSABLE: Works for both User and Admin contexts.
 * Context is determined by route data: { context: 'admin' | 'user' }
 * 
 * Displayed Information:
 * - Full Name
 * - Email
 * - Employee ID
 * - Active Status
 * - Role
 * - Account Creation Date
 * - Points Summary (only for user context, not admin)
 * 
 * Security: All data comes from authenticated API endpoints.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FooterComponent, NotificationDropdownComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Context - determines role-based layout
  readonly isAdminContext = signal<boolean>(false);
  readonly roleContext = signal<string>('grower');

  // User State - from /auth/me
  readonly userId = signal<string>('');
  readonly fullName = signal<string>('');
  readonly email = signal<string>('');
  readonly employeeId = signal<string>('N/A');
  readonly isActive = signal<boolean>(false);
  readonly role = signal<string>('');
  readonly isAdmin = signal<boolean>(false);

  // Extended User Data - from /users/{id}
  readonly firstName = signal<string>('');
  readonly middleName = signal<string | null>(null);
  readonly lastName = signal<string>('');
  readonly createdAt = signal<string>('');
  readonly updatedAt = signal<string>('');

  // Points Summary
  readonly totalPoints = signal<number>(0);
  readonly availablePoints = signal<number>(0);
  readonly lockedPoints = signal<number>(0);

  // UI State
  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly isProfileDropdownOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // Computed values
  readonly userInitial = computed(() => {
    const name = this.firstName() || this.fullName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  readonly formattedCreatedAt = computed(() => {
    const date = this.createdAt();
    return date ? this.formatDate(date) : '—';
  });

  readonly formattedUpdatedAt = computed(() => {
    const date = this.updatedAt();
    return date ? this.formatDate(date) : '—';
  });

  readonly memberSince = computed(() => {
    const date = this.createdAt();
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  readonly currentYear = new Date().getFullYear();

  // Dynamic navigation items based on context
  readonly navItems = computed(() => {
    if (this.isAdminContext()) {
      return [
        { label: 'Home', route: '/admin', icon: 'home', exact: true },
        { label: 'Users', route: '/admin/users', icon: 'users', exact: false },
        { label: 'Events', route: '/admin/events', icon: 'calendar', exact: false },
        { label: 'Products', route: '/admin/products', icon: 'gift', exact: false },
        { label: 'Points', route: '/admin/points', icon: 'star', exact: false },
        { label: 'Requests', route: '/admin/redemptions', icon: 'receipt', exact: false }
      ];
    }
    return [
      { label: 'Home', route: '/dashboard', icon: 'home', exact: true },
      { label: 'Events', route: '/events', icon: 'calendar', exact: false },
      { label: 'Products', route: '/products', icon: 'gift', exact: false },
      { label: 'Transactions', route: '/transactions', icon: 'receipt', exact: false }
    ];
  });

  // Dynamic routes based on context
  readonly homeRoute = computed(() => `/${this.roleContext()}`);
  readonly profileRoute = computed(() => `/${this.roleContext()}/profile`);
  readonly changePasswordRoute = computed(() => `/${this.roleContext()}/change-password`);

  ngOnInit(): void {
    // Determine context from route data (grower, retailer, manufacturer)
    const context = this.route.snapshot.data['context'] || 'grower';
    this.roleContext.set(context);
    this.isAdminContext.set(false);
    
    this.loadProfileData();
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
    
    if (!target.closest('.profile-menu-container')) {
      this.isProfileDropdownOpen.set(false);
    }
    
    if (!target.closest('.notifications-container')) {
      this.isNotificationsOpen.set(false);
    }
  }

  /**
   * Load profile data from backend APIs
   * Uses existing endpoints - no redundant API calls
   */
  loadProfileData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    // First get current user from /auth/me
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (authUser: CurrentUserResponse) => {
          // Set basic info from auth endpoint
          this.userId.set(authUser.userId);
          this.fullName.set(authUser.name || '');
          this.email.set(authUser.email);
          this.isActive.set(authUser.isActive);
          this.role.set(authUser.role);

          // Load extended user data with points
          this.loadExtendedUserData(authUser.userId);
        },
        error: (error) => {
          console.error('Failed to load user auth info:', error);
          this.hasError.set(true);
          this.errorMessage.set('Failed to load profile information. Please try again.');
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Load extended user data including points and timestamps
   */
  private loadExtendedUserData(userId: string): void {
    this.dashboardService.getUserById(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: UserResponse) => {
          this.firstName.set(user.firstName);
          this.middleName.set(user.middleName);
          this.lastName.set(user.lastName);
          this.createdAt.set(user.createdAt);
          this.updatedAt.set(user.updatedAt);
          this.totalPoints.set(user.totalPoints);
          this.availablePoints.set(user.availablePoints);
          this.lockedPoints.set(user.lockedPoints);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load extended user data:', error);
          // Don't show error - we have basic data from auth
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format points with thousand separators
   */
  formatPoints(points: number): string {
    return points.toLocaleString('en-US');
  }

  /**
   * Get role display name
   */
  getRoleDisplay(): string {
    const roleMap: Record<string, string> = {
      'Admin': 'Administrator',
      'Employee': 'Employee',
      'Manager': 'Manager',
      'Supervisor': 'Supervisor'
    };
    return roleMap[this.role()] || this.role();
  }

  /**
   * Toggle dropdowns
   */
  toggleProfileDropdown(event: Event): void {
    event.stopPropagation();
    this.isProfileDropdownOpen.update(v => !v);
    this.isNotificationsOpen.set(false);
  }

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.isNotificationsOpen.update(v => !v);
    this.isProfileDropdownOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  /**
   * Logout user
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Navigate back to dashboard (context-aware)
   */
  goToDashboard(): void {
    this.router.navigate([this.homeRoute()]);
  }

  /**
   * Navigate to change password (context-aware)
   */
  onChangePassword(): void {
    this.router.navigate([this.changePasswordRoute()]);
  }

  /**
   * Navigate to add admin (admin context only)
   */
  onAddAdmin(): void {
    this.router.navigate(['/admin/users/create-admin']);
  }
}
