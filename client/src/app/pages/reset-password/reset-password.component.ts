import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Reset Password Component
 * 
 * Allows users to set a new password using a valid reset token.
 * Token is extracted from URL query parameter.
 * 
 * Security features:
 * - Token validation on page load
 * - Strong password requirements
 * - Clear error messages for invalid/expired/used tokens
 * - Automatic redirect to login on success
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Token from URL
  private token = signal<string | null>(null);

  // Form state
  newPassword = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  // UI state
  touched = signal<{ newPassword: boolean; confirmPassword: boolean }>({ 
    newPassword: false, 
    confirmPassword: false 
  });
  success = signal(false);
  tokenError = signal<string | null>(null);

  // Loading and error states from auth service
  readonly isLoading = this.authService.isLoading;
  readonly serverError = this.authService.error;

  // Current year for copyright
  readonly currentYear = new Date().getFullYear();

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
    return this.allRequirementsMet() && this.passwordsMatch() && this.hasValidToken();
  });

  // Validation error messages
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
    // Extract token from URL query parameter
    this.route.queryParams.subscribe(params => {
      const tokenParam = params['token'];
      
      if (!tokenParam) {
        this.tokenError.set('Invalid password reset link. No token was provided.');
        return;
      }

      // Decode the URL-encoded token
      try {
        const decodedToken = decodeURIComponent(tokenParam);
        this.token.set(decodedToken);
        this.tokenError.set(null);
      } catch (e) {
        this.tokenError.set('Invalid password reset link. The token is malformed.');
      }
    });
  }

  /**
   * Check if we have a valid token
   */
  hasValidToken(): boolean {
    return this.token() !== null && this.tokenError() === null;
  }

  /**
   * Handle new password input change
   */
  onNewPasswordChange(value: string): void {
    this.newPassword.set(value);
    this.authService.clearError();
  }

  /**
   * Handle confirm password input change
   */
  onConfirmPasswordChange(value: string): void {
    this.confirmPassword.set(value);
    this.authService.clearError();
  }

  /**
   * Mark new password field as touched
   */
  onNewPasswordBlur(): void {
    this.touched.update(t => ({ ...t, newPassword: true }));
  }

  /**
   * Mark confirm password field as touched
   */
  onConfirmPasswordBlur(): void {
    this.touched.update(t => ({ ...t, confirmPassword: true }));
  }

  /**
   * Toggle new password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  /**
   * Toggle confirm password visibility
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  /**
   * Submit password reset form
   */
  onSubmit(): void {
    // Mark all fields as touched
    this.touched.set({ newPassword: true, confirmPassword: true });

    if (!this.isFormValid()) {
      return;
    }

    const token = this.token();
    if (!token) {
      this.tokenError.set('Password reset token is missing.');
      return;
    }

    this.authService.resetPassword(token, this.newPassword()).subscribe({
      next: () => {
        this.success.set(true);
      },
      error: (error) => {
        // Check if it's a token-related error and show on the token error area
        const errorMessage = error.message || '';
        if (errorMessage.includes('invalid') || 
            errorMessage.includes('expired') || 
            errorMessage.includes('already been used')) {
          this.tokenError.set(errorMessage);
        }
        // Other errors are handled by serverError signal from AuthService
        console.error('Password reset failed:', error.message);
      }
    });
  }

  /**
   * Navigate to login page
   */
  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Navigate to forgot password to request a new token
   */
  requestNewLink(): void {
    this.router.navigate(['/forgot-password']);
  }
}
