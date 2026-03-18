import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoginRequest, RegisterRequest, ROLE_ROUTE_MAP } from '../../core/models';
import { environment } from '../../../environments/environment';

// Extended validation errors type for signup fields
interface ExtendedValidationErrors {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  signupEmail?: string;
  signupPassword?: string;
  signupConfirmPassword?: string;
}

/**
 * Unified Auth Component
 *
 * Contains both Login and Signup with smooth toggle transition
 * - Email / password authentication
 * - Registration with name, email, password, confirm password
 * - Role selection for signup
 * - Loading states and error handling
 */
@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Mode: 'login' or 'signup'
  mode = signal<'login' | 'signup'>('login');

  // Form state - Login
  email = signal('');
  password = signal('');
  showPassword = signal(false);

  // Form state - Signup
  firstName = signal('');
  lastName = signal('');
  signupEmail = signal('');
  signupPassword = signal('');
  signupConfirmPassword = signal('');
  selectedRole = signal<'Grower' | 'Retailer' | 'Manufacturer'>('Grower');
  showSignupPassword = signal(false);

  // Validation state
  validationErrors = signal<ExtendedValidationErrors>({});
  touched = signal<Record<string, boolean>>({});

  // Loading and error states from auth service
  readonly isLoading = this.authService.isLoading;
  readonly serverError = this.authService.error;

  // Return URL for redirect after login
  private returnUrl: string | null = null;

  // Redirect messages
  readonly redirectMessage = signal<string | null>(null);

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // Roles available for signup
  readonly roles = [
    { value: 'Grower', label: 'Grower', description: 'Farm owner / Farmer' },
    { value: 'Retailer', label: 'Retailer', description: 'Retail business' },
    { value: 'Manufacturer', label: 'Manufacturer', description: 'Product manufacturer' },
  ] as const;

  // ============================================
  // Computed Validation - Login
  // ============================================

  readonly isEmailValid = computed(() => {
    const email = this.email();
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  });

  readonly isPasswordValid = computed(() => {
    return this.password().length >= 6;
  });

  readonly isLoginFormValid = computed(() => {
    return this.isEmailValid() && this.isPasswordValid();
  });

  // ============================================
  // Computed Validation - Signup
  // ============================================

  readonly isFirstNameValid = computed(() => {
    return this.firstName().trim().length >= 2;
  });

  readonly isLastNameValid = computed(() => {
    return this.lastName().trim().length >= 2;
  });

  readonly isSignupEmailValid = computed(() => {
    const email = this.signupEmail();
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  });

  readonly isSignupPasswordValid = computed(() => {
    const pwd = this.signupPassword();
    return pwd.length >= 6;
  });

  readonly isConfirmPasswordValid = computed(() => {
    return this.signupConfirmPassword() === this.signupPassword() && this.signupConfirmPassword().length > 0;
  });

  readonly isSignupFormValid = computed(() => {
    return (
      this.isFirstNameValid() &&
      this.isLastNameValid() &&
      this.isSignupEmailValid() &&
      this.isSignupPasswordValid() &&
      this.isConfirmPasswordValid()
    );
  });

  // Password strength indicator
  readonly passwordStrength = computed(() => {
    const pwd = this.signupPassword();
    if (!pwd) return { level: 0, text: '', color: '' };

    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: score, text: 'Weak', color: '#DC2626' };
    if (score <= 3) return { level: score, text: 'Fair', color: '#F59E0B' };
    if (score <= 4) return { level: score, text: 'Good', color: '#10B981' };
    return { level: score, text: 'Strong', color: '#059669' };
  });

  constructor() {
    this.route.queryParams.subscribe((params) => {
      this.returnUrl = params['returnUrl'] || null;
      const reason = params['reason'];
      if (reason === 'session_expired') {
        this.redirectMessage.set('Your session has expired. Please sign in again.');
      } else if (reason === 'account_inactive') {
        this.redirectMessage.set('Your account has been deactivated. Please contact support.');
      } else {
        this.redirectMessage.set(null);
      }
    });
  }

  // ============================================
  // Mode Toggle
  // ============================================

  switchMode(newMode: 'login' | 'signup'): void {
    this.mode.set(newMode);
    this.authService.clearError();
    this.validationErrors.set({});
    this.touched.set({});
  }

  // ============================================
  // Login Form Handlers
  // ============================================

  onEmailChange(value: string): void {
    this.email.set(value.trim());
    this.authService.clearError();
    this.validateField('email');
  }

  onPasswordChange(value: string): void {
    this.password.set(value);
    this.authService.clearError();
    this.validateField('password');
  }

  onEmailBlur(): void {
    this.touched.update((t) => ({ ...t, email: true }));
    this.validateField('email');
  }

  onPasswordBlur(): void {
    this.touched.update((t) => ({ ...t, password: true }));
    this.validateField('password');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  // ============================================
  // Signup Form Handlers
  // ============================================

  onFirstNameChange(value: string): void {
    this.firstName.set(value.trim());
    this.authService.clearError();
    this.validateField('firstName');
  }

  onLastNameChange(value: string): void {
    this.lastName.set(value.trim());
    this.authService.clearError();
    this.validateField('lastName');
  }

  onSignupEmailChange(value: string): void {
    this.signupEmail.set(value.trim());
    this.authService.clearError();
    this.validateField('signupEmail');
  }

  onSignupPasswordChange(value: string): void {
    this.signupPassword.set(value);
    this.authService.clearError();
    this.validateField('signupPassword');
    // Also validate confirm password when password changes
    if (this.signupConfirmPassword()) {
      this.validateField('signupConfirmPassword');
    }
  }

  onSignupConfirmPasswordChange(value: string): void {
    this.signupConfirmPassword.set(value);
    this.authService.clearError();
    this.validateField('signupConfirmPassword');
  }

  onFirstNameBlur(): void {
    this.touched.update((t) => ({ ...t, firstName: true }));
    this.validateField('firstName');
  }

  onLastNameBlur(): void {
    this.touched.update((t) => ({ ...t, lastName: true }));
    this.validateField('lastName');
  }

  onSignupEmailBlur(): void {
    this.touched.update((t) => ({ ...t, signupEmail: true }));
    this.validateField('signupEmail');
  }

  onSignupPasswordBlur(): void {
    this.touched.update((t) => ({ ...t, signupPassword: true }));
    this.validateField('signupPassword');
  }

  onSignupConfirmPasswordBlur(): void {
    this.touched.update((t) => ({ ...t, signupConfirmPassword: true }));
    this.validateField('signupConfirmPassword');
  }

  toggleSignupPasswordVisibility(): void {
    this.showSignupPassword.update((v) => !v);
  }

  selectRole(role: 'Grower' | 'Retailer' | 'Manufacturer'): void {
    this.selectedRole.set(role);
  }

  // ============================================
  // Validation
  // ============================================

  private validateField(field: string): void {
    const errors: ExtendedValidationErrors = { ...this.validationErrors() };

    switch (field) {
      case 'email':
        const email = this.email();
        if (!email) {
          errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.email = 'Please enter a valid email address';
        } else {
          delete errors.email;
        }
        break;

      case 'password':
        const password = this.password();
        if (!password) {
          errors.password = 'Password is required';
        } else if (password.length < 6) {
          errors.password = 'Password must be at least 6 characters';
        } else {
          delete errors.password;
        }
        break;

      case 'firstName':
        const firstName = this.firstName();
        if (!firstName) {
          errors.firstName = 'First name is required';
        } else if (firstName.length < 2) {
          errors.firstName = 'First name must be at least 2 characters';
        } else {
          delete errors.firstName;
        }
        break;

      case 'lastName':
        const lastName = this.lastName();
        if (!lastName) {
          errors.lastName = 'Last name is required';
        } else if (lastName.length < 2) {
          errors.lastName = 'Last name must be at least 2 characters';
        } else {
          delete errors.lastName;
        }
        break;

      case 'signupEmail':
        const signupEmail = this.signupEmail();
        if (!signupEmail) {
          errors.signupEmail = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) {
          errors.signupEmail = 'Please enter a valid email address';
        } else {
          delete errors.signupEmail;
        }
        break;

      case 'signupPassword':
        const signupPassword = this.signupPassword();
        if (!signupPassword) {
          errors.signupPassword = 'Password is required';
        } else if (signupPassword.length < 6) {
          errors.signupPassword = 'Password must be at least 6 characters';
        } else {
          delete errors.signupPassword;
        }
        break;

      case 'signupConfirmPassword':
        const confirmPassword = this.signupConfirmPassword();
        const newPassword = this.signupPassword();
        if (!confirmPassword) {
          errors.signupConfirmPassword = 'Please confirm your password';
        } else if (confirmPassword !== newPassword) {
          errors.signupConfirmPassword = 'Passwords do not match';
        } else {
          delete errors.signupConfirmPassword;
        }
        break;
    }

    this.validationErrors.set(errors);
  }

  // ============================================
  // Submit - Login
  // ============================================

  onLoginSubmit(form: NgForm): void {
    this.touched.set({ email: true, password: true });
    this.validateField('email');
    this.validateField('password');

    if (!this.isLoginFormValid()) return;

    const credentials: LoginRequest = {
      email: this.email(),
      password: this.password(),
    };

    this.authService.login(credentials).subscribe({
      next: (user) => {
        const defaultRoute = ROLE_ROUTE_MAP[user.role] ?? '/login';
        let targetRoute = defaultRoute;
        if (this.returnUrl) {
          if (this.returnUrl.startsWith(defaultRoute)) {
            targetRoute = this.returnUrl;
          }
        }
        this.router.navigate([targetRoute]);
      },
      error: (error) => {
        console.error('Login failed:', error.message);
      },
    });
  }

  // ============================================
  // Submit - Signup
  // ============================================

  onSignupSubmit(form: NgForm): void {
    this.touched.set({
      firstName: true,
      lastName: true,
      signupEmail: true,
      signupPassword: true,
      signupConfirmPassword: true,
    });
    this.validateField('firstName');
    this.validateField('lastName');
    this.validateField('signupEmail');
    this.validateField('signupPassword');
    this.validateField('signupConfirmPassword');

    if (!this.isSignupFormValid()) return;

    const data: RegisterRequest = {
      firstName: this.firstName(),
      lastName: this.lastName(),
      email: this.signupEmail(),
      password: this.signupPassword(),
      role: this.selectedRole(),
    };

    this.authService.register(data).subscribe({
      next: (user) => {
        const defaultRoute = ROLE_ROUTE_MAP[user.role] ?? '/login';
        this.router.navigate([defaultRoute]);
      },
      error: (error) => {
        console.error('Registration failed:', error.message);
      },
    });
  }
}
