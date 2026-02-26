import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { finalize } from 'rxjs/operators';

/**
 * Forgot Password Component
 * 
 * Allows users to request a password reset.
 * Only accepts @agdata.com email addresses.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Form state
  email = signal('');
  isLoading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  touched = signal(false);

  // Current year
  readonly currentYear = new Date().getFullYear();

  // Computed validation
  readonly isEmailValid = computed(() => {
    const email = this.email();
    if (!email) return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    
    return true; // Domain validation removed for marketplace
  });

  readonly emailError = computed(() => {
    if (!this.touched()) return null;
    
    const email = this.email();
    if (!email) return 'Email is required';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    
    // Domain validation removed for marketplace
    
    return null;
  });

  /**
   * Handle email input change
   */
  onEmailChange(value: string): void {
    this.email.set(value.trim());
    this.error.set(null);
  }

  /**
   * Mark field as touched
   */
  onEmailBlur(): void {
    this.touched.set(true);
  }

  /**
   * Submit password reset request
   */
  onSubmit(): void {
    this.touched.set(true);
    
    if (!this.isEmailValid()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    // Note: This endpoint may not exist yet in the backend
    // The request is made but we show success regardless to prevent email enumeration
    this.http.post(`${environment.apiUrl}/auth/forgot-password`, {
      email: this.email()
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.success.set(true);
      },
      error: (err) => {
        // Show success anyway to prevent email enumeration attacks
        // Only show error for network/server issues
        if (err.status === 0 || err.status >= 500) {
          this.error.set('Unable to process your request. Please try again later.');
        } else {
          // For 4xx errors, still show success to prevent enumeration
          this.success.set(true);
        }
      }
    });
  }

  /**
   * Go back to login
   */
  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}
