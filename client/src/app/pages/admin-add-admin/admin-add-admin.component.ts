import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdminHeaderComponent } from '../../shared/components/admin-header/admin-header.component';

/**
 * Interface for Create Admin form
 */
interface CreateAdminForm {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  employeeId: string;
  password: string;
  confirmPassword: string;
}

/**
 * Admin Add Admin Page Component
 * 
 * Dedicated page for creating new admin users.
 * Uses the /admin/users/create-admin API endpoint.
 * 
 * Features:
 * - Full admin creation form with validation
 * - Password confirmation
 * - Consistent design with other admin pages
 */
@Component({
  selector: 'app-admin-add-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, AdminHeaderComponent],
  templateUrl: './admin-add-admin.component.html',
  styleUrl: './admin-add-admin.component.css'
})
export class AdminAddAdminComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // UI State
  readonly isLoading = signal<boolean>(true);

  // Form State
  readonly adminForm = signal<CreateAdminForm>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    employeeId: '',
    password: '',
    confirmPassword: ''
  });
  readonly formErrors = signal<Record<string, string>>({});
  readonly isSubmitting = signal<boolean>(false);
  readonly successMessage = signal<string>('');

  // Password visibility toggles
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  ngOnInit(): void {
    this.isLoading.set(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // Form Handling
  // ============================================

  updateFormField(field: keyof CreateAdminForm, value: string): void {
    this.adminForm.update(form => ({ ...form, [field]: value }));
    // Clear error for this field when user types
    this.formErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field.toLowerCase()];
      delete newErrors['general'];
      return newErrors;
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  /**
   * Validate form before submission
   */
  private validateForm(): boolean {
    const form = this.adminForm();
    const errors: Record<string, string> = {};

    // First Name validation
    if (!form.firstName.trim()) {
      errors['firstname'] = 'First name is required.';
    } else if (form.firstName.trim().length > 100) {
      errors['firstname'] = 'First name is too long (max 100 characters).';
    }

    // Last Name validation
    if (!form.lastName.trim()) {
      errors['lastname'] = 'Last name is required.';
    } else if (form.lastName.trim().length > 100) {
      errors['lastname'] = 'Last name is too long (max 100 characters).';
    }

    // Middle Name validation (optional but max length)
    if (form.middleName && form.middleName.trim().length > 100) {
      errors['middlename'] = 'Middle name is too long (max 100 characters).';
    }

    // Email validation - only @agdata.com addresses allowed
    if (!form.email.trim()) {
      errors['email'] = 'Email is required.';
    } else {
      const agdataEmailRegex = /^[^\s@]+@agdata\.com$/i;
      if (!agdataEmailRegex.test(form.email.trim())) {
        errors['email'] = 'Only @agdata.com email addresses are allowed.';
      }
    }

    // Employee ID validation
    if (!form.employeeId.trim()) {
      errors['employeeid'] = 'Employee ID is required.';
    } else {
      const employeeIdRegex = /^[A-Za-z]{3}-\d+$/;
      if (!employeeIdRegex.test(form.employeeId.trim())) {
        errors['employeeid'] = 'Employee ID must be in format XXX-### (e.g., AGD-123).';
      }
    }

    // Password validation
    if (!form.password) {
      errors['password'] = 'Password is required.';
    } else if (form.password.length < 8) {
      errors['password'] = 'Password must be at least 8 characters long.';
    }

    // Confirm Password validation
    if (!form.confirmPassword) {
      errors['confirmpassword'] = 'Please confirm your password.';
    } else if (form.password !== form.confirmPassword) {
      errors['confirmpassword'] = 'Passwords do not match.';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Submit the create admin form
   */
  submitForm(): void {
    this.successMessage.set('');

    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting.set(true);
    const form = this.adminForm();

    this.adminService.createAdmin({
      firstName: form.firstName.trim(),
      middleName: form.middleName?.trim() || undefined,
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      employeeId: form.employeeId.trim().toUpperCase(),
      password: form.password
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage.set(`Admin user "${form.firstName} ${form.lastName}" created successfully!`);
          this.resetForm();
          this.isSubmitting.set(false);
        },
        error: (error) => {
          console.error('Failed to create admin:', error);
          this.isSubmitting.set(false);

          // Handle validation errors from backend
          if (error.error?.errors) {
            const backendErrors: Record<string, string> = {};
            for (const [key, value] of Object.entries(error.error.errors)) {
              const messages = value as string[];
              backendErrors[key.toLowerCase()] = messages[0];
            }
            this.formErrors.set(backendErrors);
          } else if (error.error?.message) {
            this.formErrors.set({ general: error.error.message });
          } else if (error.status === 400) {
            this.formErrors.set({ general: 'Invalid request. Please check your input.' });
          } else if (error.status === 409) {
            this.formErrors.set({ general: 'A user with this email or employee ID already exists.' });
          } else {
            this.formErrors.set({ general: 'Failed to create admin. Please try again.' });
          }
        }
      });
  }

  /**
   * Reset the form to initial state
   */
  resetForm(): void {
    this.adminForm.set({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      employeeId: '',
      password: '',
      confirmPassword: ''
    });
    this.formErrors.set({});
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
  }

  /**
   * Cancel and go back to dashboard
   */
  onCancel(): void {
    this.router.navigate(['/admin']);
  }
}
