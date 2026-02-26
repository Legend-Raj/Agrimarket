import { Component, inject, Input, Output, EventEmitter, signal, computed, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CurrentUserResponse } from '../../../core/models/auth.models';

/**
 * Navigation item interface
 */
export interface AdminNavItem {
  label: string;
  route: string;
  icon?: string;
  exact: boolean;
}

/**
 * Admin Header Component
 * 
 * A reusable header component for all admin pages that provides:
 * - Consistent navigation across admin section
 * - Profile dropdown with ALL admin options (Profile, Add Admin, Change Password, Logout)
 * - Notifications dropdown
 * - Mobile responsive menu
 * 
 * This component eliminates duplication and ensures consistency across
 * admin-dashboard, admin-users, admin-events, admin-products, admin-points,
 * admin-redemptions, and admin-add-admin pages.
 * 
 * Usage:
 * <app-admin-header
 *   [pendingRequests]="pendingRequests()"
 *   (notificationClick)="onNotificationClick()">
 * </app-admin-header>
 */
@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-header.component.html',
  styleUrl: './admin-header.component.css'
})
export class AdminHeaderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Optional input for showing pending notification count
  @Input() pendingRequests: number = 0;

  // Event emitters for parent component interactions
  @Output() notificationClick = new EventEmitter<void>();

  // User State
  readonly userName = signal<string>('');
  readonly userEmail = signal<string>('');
  readonly userFirstName = signal<string>('');

  // UI State
  readonly isProfileDropdownOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // Computed values
  readonly userInitial = computed(() => {
    const name = this.userFirstName() || this.userName();
    return name ? name.charAt(0).toUpperCase() : 'A';
  });

  // Navigation items for admin - consistent across all admin pages
  readonly navItems: AdminNavItem[] = [
    { label: 'Home', route: '/admin', icon: 'home', exact: true },
    { label: 'Users', route: '/admin/users', icon: 'users', exact: false },
    { label: 'Events', route: '/admin/events', icon: 'calendar', exact: false },
    { label: 'Products', route: '/admin/products', icon: 'gift', exact: false },
    { label: 'Points', route: '/admin/points', icon: 'points', exact: false },
    { label: 'Requests', route: '/admin/redemptions', icon: 'requests', exact: false }
  ];

  ngOnInit(): void {
    this.loadUserData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load current user data for display
   */
  private loadUserData(): void {
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: CurrentUserResponse) => {
          this.userName.set(user.name || user.email.split('@')[0]);
          this.userEmail.set(user.email);
          const nameParts = user.name?.split(' ') || [];
          this.userFirstName.set(nameParts[0] || user.email.split('@')[0]);
        },
        error: (error) => {
          console.error('Failed to load user info:', error);
          // Fallback to cached user data
          const cachedUser = this.authService.user();
          if (cachedUser) {
            this.userName.set(cachedUser.email.split('@')[0]);
            this.userEmail.set(cachedUser.email);
          }
        }
      });
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
   * Toggle profile dropdown
   */
  toggleProfileDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileDropdownOpen.update(v => !v);
    this.isNotificationsOpen.set(false);
  }

  /**
   * Toggle notifications panel
   */
  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.isNotificationsOpen.update(v => !v);
    this.isProfileDropdownOpen.set(false);
  }

  /**
   * Toggle mobile menu
   */
  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  /**
   * Navigate to profile page
   */
  onProfile(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/admin/profile']);
  }

  /**
   * Navigate to add admin page
   * This option is ALWAYS visible for admin users
   */
  onAddAdmin(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/admin/users/create-admin']);
  }

  /**
   * Navigate to change password page
   */
  onChangePassword(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/admin/change-password']);
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
   * Handle notification item click - navigates to redemptions
   */
  onNotificationItemClick(): void {
    this.isNotificationsOpen.set(false);
    this.notificationClick.emit();
    this.router.navigate(['/admin/redemptions']);
  }
}
