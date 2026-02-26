import { Component, inject, signal, computed, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { NotificationDropdownComponent } from '../../shared/components/notification-dropdown/notification-dropdown.component';

/**
 * Change Password Component
 * 
 * Allows authenticated users to change their password.
 * Requires current password verification for security.
 * 
 * REUSABLE: Works for both User and Admin contexts.
 * Context is determined by route data: { context: 'admin' | 'user' }
 * 
 * Security features:
 * - Current password verification
 * - Strong password requirements
 * - Clear error messages
 * - All sessions invalidated after password change
 * - Automatic redirect to login on success
 * 
 * User can only change their own password - enforced by backend.
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, FooterComponent, NotificationDropdownComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Context - determines if this is admin or user context
  readonly isAdminContext = signal<boolean>(false);

  // User info
  readonly userName = signal<string>('');
  readonly userEmail = signal<string>('');
  readonly userFirstName = signal<string>('');

  // Form state
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  // UI state
  touched = signal<{ currentPassword: boolean; newPassword: boolean; confirmPassword: boolean }>({ 
    currentPassword: false, 
    newPassword: false, 
    confirmPassword: false 
  });
  success = signal(false);
  isSubmitting = signal(false);
  submitError = signal<string | null>(null);

  // Dropdown states
  readonly isProfileDropdownOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // Current year for copyright
  readonly currentYear = new Date().getFullYear();

  // Computed values
  readonly userInitial = computed(() => {
    const name = this.userFirstName() || this.userName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

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
  readonly homeRoute = computed(() => this.isAdminContext() ? '/admin' : '/dashboard');
  readonly profileRoute = computed(() => this.isAdminContext() ? '/admin/profile' : '/profile');
  readonly changePasswordRoute = computed(() => this.isAdminContext() ? '/admin/change-password' : '/change-password');

  // Password requirements validation
  readonly passwordRequirements = computed(() => {
    const password = this.newPassword();
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'`~]/.test(password)
    };
  });

  readonly allRequirementsMet = computed(() => {
    const reqs = this.passwordRequirements();
    return reqs.minLength && reqs.hasUppercase && reqs.hasLowercase && 
           reqs.hasNumber && reqs.hasSpecial;
  });

  readonly passwordsMatch = computed(() => {
    const password = this.newPassword();
    const confirm = this.confirmPassword();
    return password.length > 0 && confirm.length > 0 && password === confirm;
  });

  readonly isFormValid = computed(() => {
    return this.currentPassword().length > 0 && 
           this.allRequirementsMet() && 
           this.passwordsMatch();
  });

  // Validation error messages
  readonly currentPasswordError = computed(() => {
    if (!this.touched().currentPassword) return null;
    if (!this.currentPassword()) return 'Current password is required';
    return null;
  });

  readonly newPasswordError = computed(() => {
    if (!this.touched().newPassword) return null;
    const password = this.newPassword();
    
    if (!password) return 'New password is required';
    if (!this.allRequirementsMet()) return 'Password does not meet all requirements';
    
    return null;
  });

  readonly confirmPasswordError = computed(() => {
    if (!this.touched().confirmPassword) return null;
    const confirm = this.confirmPassword();
    
    if (!confirm) return 'Please confirm your password';
    if (!this.passwordsMatch()) return 'Passwords do not match';
    
    return null;
  });

  ngOnInit(): void {
    // Determine context from route data
    const context = this.route.snapshot.data['context'];
    this.isAdminContext.set(context === 'admin');
    
    this.loadUserInfo();
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
   * Load current user info
   */
  private loadUserInfo(): void {
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: CurrentUserResponse) => {
          this.userName.set(user.name || user.email.split('@')[0]);
          this.userEmail.set(user.email);
          const nameParts = user.name?.split(' ') || [];
          this.userFirstName.set(nameParts[0] || user.email.split('@')[0]);
        },
        error: () => {
          // If we can't get user info, use cached data
          const cachedUser = this.authService.user();
          if (cachedUser) {
            this.userName.set(cachedUser.email.split('@')[0]);
            this.userEmail.set(cachedUser.email);
          }
        }
      });
  }

  /**
   * Handle current password input change
   */
  onCurrentPasswordChange(value: string): void {
    this.currentPassword.set(value);
    this.submitError.set(null);
  }

  /**
   * Handle new password input change
   */
  onNewPasswordChange(value: string): void {
    this.newPassword.set(value);
    this.submitError.set(null);
  }

  /**
   * Handle confirm password input change
   */
  onConfirmPasswordChange(value: string): void {
    this.confirmPassword.set(value);
    this.submitError.set(null);
  }

  /**
   * Mark field as touched
   */
  onBlur(field: 'currentPassword' | 'newPassword' | 'confirmPassword'): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  /**
   * Toggle password visibility
   */
  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword.update(v => !v);
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  /**
   * Submit password change
   */
  onSubmit(): void {
    // Mark all fields as touched
    this.touched.set({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true
    });

    if (!this.isFormValid() || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.authService.changePassword(
      this.currentPassword(),
      this.newPassword(),
      this.confirmPassword()
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.success.set(true);
        this.isSubmitting.set(false);
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (error: Error) => {
        this.submitError.set(error.message);
        this.isSubmitting.set(false);
      }
    });
  }

  /**
   * Cancel and go back (context-aware)
   */
  onCancel(): void {
    this.router.navigate([this.profileRoute()]);
  }

  /**
   * Navigate to add admin (admin context only)
   */
  onAddAdmin(): void {
    this.router.navigate(['/admin/users/create-admin']);
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
}
