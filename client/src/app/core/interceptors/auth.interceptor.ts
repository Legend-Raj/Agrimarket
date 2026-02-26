import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Authentication HTTP Interceptor
 * 
 * Responsibilities:
 * - Attach JWT Bearer token to all API requests
 * - Handle 401 errors and attempt token refresh
 * - Handle inactive user errors (account deactivated)
 * - Redirect to login on authentication failure
 * 
 * Security:
 * - Only attaches token to requests going to our API
 * - Handles token expiry gracefully
 * - Detects and handles account deactivation
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Only add token to requests going to our API
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // Skip token for auth endpoints that don't require it
  const skipTokenUrls = ['/auth/login', '/auth/refresh'];
  const shouldSkip = skipTokenUrls.some(url => req.url.includes(url));

  if (shouldSkip) {
    return next(req);
  }

  // Get the token and add it to the request
  const token = authService.getAccessToken();

  if (token) {
    req = addTokenToRequest(req, token);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Check for account inactive/deactivated error
      // Backend returns this when user tries to refresh token or access resources while inactive
      if (isAccountInactiveError(error)) {
        // User account has been deactivated - force logout
        authService.logout().subscribe();
        router.navigate(['/login'], {
          queryParams: { reason: 'account_inactive' }
        });
        return throwError(() => error);
      }

      // Handle 401 Unauthorized
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        // Try to refresh the token
        return authService.refreshToken().pipe(
          switchMap(response => {
            // Retry the original request with new token
            const newReq = addTokenToRequest(req, response.accessToken);
            return next(newReq);
          }),
          catchError(refreshError => {
            // Check if refresh failed due to inactive account
            if (isAccountInactiveError(refreshError)) {
              router.navigate(['/login'], {
                queryParams: { reason: 'account_inactive' }
              });
            } else {
              // Refresh failed for other reason, redirect to login
              router.navigate(['/login'], {
                queryParams: { returnUrl: router.url, reason: 'session_expired' }
              });
            }
            return throwError(() => refreshError);
          })
        );
      }

      // Handle 403 Forbidden
      if (error.status === 403) {
        router.navigate(['/unauthorized']);
        return throwError(() => error);
      }

      return throwError(() => error);
    })
  );
};

/**
 * Check if error indicates account is inactive/deactivated
 */
function isAccountInactiveError(error: HttpErrorResponse): boolean {
  if (!error.error) return false;
  
  const message = (error.error.message || error.error.error || '').toLowerCase();
  return (
    message.includes('inactive') ||
    message.includes('deactivated') ||
    message.includes('account is inactive') ||
    message.includes('user account deactivated')
  );
}

/**
 * Clone request with Authorization header
 */
function addTokenToRequest(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
