import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoginRequest, ValidationErrors, ROLE_ROUTE_MAP } from '../../core/models';
import { DEMO_CREDENTIALS, DemoCredential } from '../../core/mock/mock-data';
import { environment } from '../../../environments/environment';

/**
 * Login Component
 *
 * Marketplace-branded login page with:
 * - Email / password authentication
 * - Demo credentials table for testing
 * - Role-based redirect after login
 * - Loading states and error handling
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Form state
  email = signal('');
  password = signal('');
  showPassword = signal(false);

  // Validation state
  validationErrors = signal<ValidationErrors>({});
  touched = signal<{ email: boolean; password: boolean }>({ email: false, password: false });

  // Loading and error states from auth service
  readonly isLoading = this.authService.isLoading;
  readonly serverError = this.authService.error;

  // Return URL for redirect after login
  private returnUrl: string | null = null;

  // Redirect messages
  readonly redirectMessage = signal<string | null>(null);

  // Demo credentials (only shown when useMockApi is true)
  readonly showDemoCredentials = environment.useMockApi;
  readonly demoCredentials: DemoCredential[] = DEMO_CREDENTIALS;

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // Computed validation
  readonly isEmailValid = computed(() => {
    const email = this.email();
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  });

  readonly isPasswordValid = computed(() => {
    return this.password().length >= 6;
  });

  readonly isFormValid = computed(() => {
    return this.isEmailValid() && this.isPasswordValid();
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
  // Form Handlers
  // ============================================

  onEmailChange(value: string): void {
    this.email.set(value.trim());
    this.authService.clearError();
    this.validateEmail();
  }

  onPasswordChange(value: string): void {
    this.password.set(value);
    this.authService.clearError();
    this.validatePassword();
  }

  onEmailBlur(): void {
    this.touched.update((t) => ({ ...t, email: true }));
    this.validateEmail();
  }

  onPasswordBlur(): void {
    this.touched.update((t) => ({ ...t, password: true }));
    this.validatePassword();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  /**
   * Fill in demo credentials when user clicks a row
   */
  useDemoCredential(cred: DemoCredential): void {
    this.email.set(cred.email);
    this.password.set(cred.password);
    this.touched.set({ email: true, password: true });
    this.validationErrors.set({});
    this.authService.clearError();
  }

  // ============================================
  // Validation
  // ============================================

  private validateEmail(): void {
    const email = this.email();
    const errors: ValidationErrors = { ...this.validationErrors() };

    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    } else {
      delete errors.email;
    }

    this.validationErrors.set(errors);
  }

  private validatePassword(): void {
    const password = this.password();
    const errors: ValidationErrors = { ...this.validationErrors() };

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    } else {
      delete errors.password;
    }

    this.validationErrors.set(errors);
  }

  // ============================================
  // Submit
  // ============================================

  onSubmit(form: NgForm): void {
    this.touched.set({ email: true, password: true });
    this.validateEmail();
    this.validatePassword();

    if (!this.isFormValid()) return;

    const credentials: LoginRequest = {
      email: this.email(),
      password: this.password(),
    };

    this.authService.login(credentials).subscribe({
      next: (user) => {
        const defaultRoute = ROLE_ROUTE_MAP[user.role] ?? '/login';

        let targetRoute = defaultRoute;
        if (this.returnUrl) {
          // Only use returnUrl if it matches the user role prefix
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
}
