import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Unauthorized Component
 * 
 * Displayed when a user tries to access a resource they don't have permission for.
 * Intelligently handles navigation based on actual user state to prevent security bypasses.
 */
@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="unauthorized-container">
      <div class="content">
        <div class="icon-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h1>Access Denied</h1>
        <p>{{ message }}</p>
        <div class="actions">
          <!-- Only show dashboard link if user is authenticated and active -->
          @if (canAccessDashboard) {
            <button (click)="goToDashboard()" class="btn primary">Go to Dashboard</button>
          }
          <button (click)="signIn()" class="btn" [class.primary]="!canAccessDashboard" [class.secondary]="canAccessDashboard">
            {{ canAccessDashboard ? 'Sign In as Different User' : 'Sign In' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --agdata-green-primary: #4B7B32;
      --agdata-green-dark: #3D6428;
      --agdata-gray-500: #6B7280;
      --agdata-gray-900: #111827;
      --agdata-white: #FFFFFF;
    }
    
    .unauthorized-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 100%);
    }
    
    .content {
      text-align: center;
      max-width: 400px;
    }
    
    .icon-container {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FEE2E2;
      border-radius: 50%;
      color: #DC2626;
    }
    
    .icon-container svg {
      width: 40px;
      height: 40px;
    }
    
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--agdata-gray-900);
      margin: 0 0 0.75rem 0;
    }
    
    p {
      font-size: 0.9375rem;
      color: var(--agdata-gray-500);
      line-height: 1.6;
      margin: 0 0 2rem 0;
    }
    
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .btn {
      display: block;
      padding: 0.75rem 1.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.15s ease;
    }
    
    .btn.primary {
      color: var(--agdata-white);
      background: linear-gradient(135deg, var(--agdata-green-primary) 0%, var(--agdata-green-dark) 100%);
    }
    
    .btn.primary:hover {
      opacity: 0.9;
    }
    
    .btn.secondary {
      color: var(--agdata-gray-900);
      background: var(--agdata-white);
      border: 1px solid #E5E7EB;
    }
    
    .btn.secondary:hover {
      background: #F9FAFB;
    }
  `]
})
export class UnauthorizedComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  message = 'You don\'t have permission to access this page. Please contact your administrator if you believe this is an error.';
  canAccessDashboard = false;

  ngOnInit(): void {
    // Determine user state to show appropriate options
    this.evaluateUserState();
  }

  /**
   * Evaluate the current user state to determine available actions
   * This prevents security bypasses through the unauthorized page
   */
  private evaluateUserState(): void {
    const isLoggedIn = this.authService.isLoggedIn();
    const isActive = this.authService.isActiveFromStorage();

    if (!isLoggedIn) {
      // Not logged in - show sign in only
      this.message = 'You need to sign in to access this page.';
      this.canAccessDashboard = false;
    } else if (!isActive) {
      // Logged in but inactive - this is a serious state, clear session
      this.message = 'Your account has been deactivated. Please contact your administrator.';
      this.canAccessDashboard = false;
      // Clear the invalid session
      this.authService.logout().subscribe();
    } else {
      // Logged in and active - they just don't have permission for the specific resource
      this.message = 'You don\'t have permission to access this page. Please contact your administrator if you believe this is an error.';
      this.canAccessDashboard = true;
    }
  }

  /**
   * Navigate to the appropriate dashboard based on user role
   * Only called when user is authenticated and active
   */
  goToDashboard(): void {
    // Double-check user is still valid before navigating
    if (!this.authService.isLoggedIn() || !this.authService.isActiveFromStorage()) {
      this.router.navigate(['/login']);
      return;
    }

    const dashboardRoute = this.authService.getDashboardRoute();
    this.router.navigate([dashboardRoute]);
  }

  /**
   * Sign in (or sign in as different user)
   * Clears current session if exists
   */
  signIn(): void {
    if (this.authService.isLoggedIn()) {
      // Logout first, then navigate to login
      this.authService.logout().subscribe({
        complete: () => this.router.navigate(['/login'])
      });
    } else {
      this.router.navigate(['/login']);
    }
  }
}
