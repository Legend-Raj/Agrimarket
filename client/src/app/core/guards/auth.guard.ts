import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole, ROLE_ROUTE_MAP } from '../models/auth.models';

/**
 * Auth Guard - Protects routes that require authentication
 * Redirects to login page if user is not authenticated.
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  if (!authService.isActiveFromStorage()) {
    authService.logout().subscribe();
    router.navigate(['/login'], {
      queryParams: { reason: 'account_inactive' },
    });
    return false;
  }

  return true;
};

/**
 * Role Guard Factory - Creates a guard that restricts access to specific user roles.
 * Used for role-specific route groups (e.g., /grower/**, /retailer/**, /manufacturer/**).
 *
 * @param allowedRoles - Array of roles that can access the route
 */
export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isLoggedIn()) {
      router.navigate(['/login'], {
        queryParams: { returnUrl: state.url },
      });
      return false;
    }

    if (!authService.isActiveFromStorage()) {
      authService.logout().subscribe();
      router.navigate(['/login'], {
        queryParams: { reason: 'account_inactive' },
      });
      return false;
    }

    const userRole = authService.getRoleFromStorage() ?? authService.userRole();

    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }

    router.navigate(['/unauthorized']);
    return false;
  };
}

/**
 * Guest Guard - Protects routes that should only be accessible to non-authenticated users.
 * Redirects authenticated users to their role-specific dashboard.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If logged in but inactive, treat as guest
  if (authService.isLoggedIn() && !authService.isActiveFromStorage()) {
    authService.logout().subscribe();
    return true;
  }

  if (authService.isLoggedIn()) {
    const dashboardRoute = authService.getDashboardRoute();
    router.navigate([dashboardRoute]);
    return false;
  }

  return true;
};
