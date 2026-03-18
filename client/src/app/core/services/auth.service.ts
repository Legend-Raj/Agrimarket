import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LoginResponse,
  TokenRefreshResponse,
  UserInfo,
  UserRole,
  CurrentUserResponse,
  ApiErrorResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  RegisterRequest,
  ROLE_ROUTE_MAP,
} from '../models';
import { getMockLoginResponse, getMockCurrentUser } from '../mock/mock-data';

/**
 * AuthService - Core authentication service
 *
 * Supports both mock and real API modes via environment.useMockApi.
 * When mock mode is on, login returns hardcoded demo users.
 * When off, uses the real backend API (to be implemented).
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly API_URL = environment.apiUrl;

  // Reactive state using signals
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _user = signal<UserInfo | null>(null);
  private readonly _isAuthenticated = signal<boolean>(false);

  // Public readonly signals
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  // Computed signals
  readonly userRole = computed<UserRole | null>(() => this._user()?.role ?? null);
  readonly userName = computed(() => {
    const user = this._user();
    return user?.name ?? user?.email?.split('@')[0] ?? null;
  });

  // Token refresh timer
  private refreshTokenTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    if (this.isBrowser()) {
      this.initializeAuthState();
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private initializeAuthState(): void {
    const token = this.getAccessToken();
    const user = this.getStoredUser();

    if (token && user) {
      this._user.set(user);
      this._isAuthenticated.set(true);
      if (!environment.useMockApi) {
        this.scheduleTokenRefresh();
      }
    }
  }

  // ============================================
  // Login
  // ============================================

  login(credentials: LoginRequest): Observable<UserInfo> {
    this._isLoading.set(true);
    this._error.set(null);

    if (environment.useMockApi) {
      return this.mockLogin(credentials);
    }

    return this.http
      .post<LoginResponse>(`${this.API_URL}/auth/login`, credentials)
      .pipe(
        tap((response) => this.handleLoginSuccess(response)),
        map((response) => response.user),
        catchError((error) => this.handleAuthError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  // ============================================
  // Register
  // ============================================

  register(data: RegisterRequest): Observable<UserInfo> {
    this._isLoading.set(true);
    this._error.set(null);

    if (environment.useMockApi) {
      // Mock registration - return a mock user
      const mockUser: UserInfo = {
        id: 'mock-user-' + Date.now(),
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        role: data.role || 'Grower',
        isActive: true,
      };
      this._isLoading.set(false);
      return of(mockUser);
    }

    return this.http
      .post<LoginResponse>(`${this.API_URL}/auth/register`, data)
      .pipe(
        tap((response) => this.handleLoginSuccess(response)),
        map((response) => response.user),
        catchError((error) => {
          const errMsg = error.error?.message || 'Registration failed. Please try again.';
          this._error.set(errMsg);
          return throwError(() => new Error(errMsg));
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  private mockLogin(credentials: LoginRequest): Observable<UserInfo> {
    const response = getMockLoginResponse(credentials.email, credentials.password);

    if (!response) {
      this._isLoading.set(false);
      const errMsg = 'Invalid email or password. Please use the demo credentials below.';
      this._error.set(errMsg);
      return throwError(() => new Error(errMsg));
    }

    this.handleLoginSuccess(response);
    this._isLoading.set(false);
    return of(response.user);
  }

  private handleLoginSuccess(response: LoginResponse): void {
    this.setAccessToken(response.accessToken);
    this.setRefreshToken(response.refreshToken);
    this.setStoredUser(response.user);

    this._user.set(response.user);
    this._isAuthenticated.set(true);

    if (!environment.useMockApi) {
      this.scheduleTokenRefresh(response.expiresIn);
    }
  }

  // ============================================
  // Token Refresh
  // ============================================

  refreshToken(): Observable<TokenRefreshResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    if (environment.useMockApi) {
      const mockResponse: TokenRefreshResponse = {
        accessToken: `mock-access-refreshed-${Date.now()}`,
        refreshToken: `mock-refresh-refreshed-${Date.now()}`,
        expiresIn: 3600,
      };
      this.setAccessToken(mockResponse.accessToken);
      this.setRefreshToken(mockResponse.refreshToken);
      return of(mockResponse);
    }

    return this.http
      .post<TokenRefreshResponse>(`${this.API_URL}/auth/refresh`, { refreshToken })
      .pipe(
        tap((response) => {
          this.setAccessToken(response.accessToken);
          this.setRefreshToken(response.refreshToken);
          this.scheduleTokenRefresh(response.expiresIn);
        }),
        catchError((error) => {
          this.logout();
          return throwError(() => error);
        })
      );
  }

  private scheduleTokenRefresh(expiresIn?: number): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    const refreshTime = expiresIn ? (expiresIn - 60) * 1000 : 14 * 60 * 1000;

    if (refreshTime > 0) {
      this.refreshTokenTimeout = setTimeout(() => {
        if (this._isAuthenticated()) {
          this.refreshToken().subscribe({
            error: () => console.warn('Token refresh failed'),
          });
        }
      }, refreshTime);
    }
  }

  // ============================================
  // Logout
  // ============================================

  logout(allDevices: boolean = false): Observable<void> {
    const refreshToken = this.getRefreshToken();
    this.clearAuthState();

    if (!environment.useMockApi && refreshToken) {
      const endpoint = allDevices ? '/auth/logout' : '/auth/revoke';
      const body = allDevices ? {} : { refreshToken };

      return this.http.post<void>(`${this.API_URL}${endpoint}`, body).pipe(
        catchError(() => of(undefined)),
        tap(() => this.router.navigate(['/login']))
      );
    }

    this.router.navigate(['/login']);
    return of(undefined);
  }

  private clearAuthState(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(environment.tokenKey);
      localStorage.removeItem(environment.refreshTokenKey);
      localStorage.removeItem(environment.userKey);
    }

    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    this._user.set(null);
    this._isAuthenticated.set(false);
    this._error.set(null);
  }

  // ============================================
  // Current User
  // ============================================

  getCurrentUser(): Observable<CurrentUserResponse> {
    if (environment.useMockApi) {
      const user = this.getStoredUser();
      if (user) {
        const response = getMockCurrentUser(user.email);
        if (response) return of(response);
      }
      return throwError(() => new Error('No user session'));
    }

    return this.http.get<CurrentUserResponse>(`${this.API_URL}/auth/me`).pipe(
      tap((response) => {
        if (response.authenticated && response.userId) {
          const userInfo: UserInfo = {
            id: response.userId,
            email: response.email,
            name: response.name,
            role: response.role,
            isActive: response.isActive,
          };
          this._user.set(userInfo);
          this.setStoredUser(userInfo);
        }
      }),
      catchError((error) => this.handleAuthError(error))
    );
  }

  // ============================================
  // Session Checks
  // ============================================

  isLoggedIn(): boolean {
    if (!this.isBrowser()) return false;
    return !!this.getAccessToken() && this._isAuthenticated();
  }

  /** Get the user role from localStorage (synchronous, for guards) */
  getRoleFromStorage(): UserRole | null {
    const user = this.getStoredUser();
    return user?.role ?? null;
  }

  /** Get the dashboard route for the current user role */
  getDashboardRoute(): string {
    const role = this.getRoleFromStorage() ?? this.userRole();
    return role ? ROLE_ROUTE_MAP[role] : '/login';
  }

  isActiveFromStorage(): boolean {
    if (!this.isBrowser()) return true;
    const user = this.getStoredUser();
    return user?.isActive ?? true;
  }

  // ============================================
  // Password Management
  // ============================================

  resetPassword(token: string, newPassword: string): Observable<ResetPasswordResponse> {
    this._isLoading.set(true);
    this._error.set(null);

    if (environment.useMockApi) {
      this._isLoading.set(false);
      return of({ success: true, message: 'Password reset successfully.' });
    }

    const request: ResetPasswordRequest = { token, newPassword };
    return this.http
      .post<ResetPasswordResponse>(`${this.API_URL}/auth/reset-password`, request)
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleAuthError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Observable<ChangePasswordResponse> {
    this._isLoading.set(true);
    this._error.set(null);

    if (environment.useMockApi) {
      this.clearAuthState();
      this._isLoading.set(false);
      return of({ success: true, message: 'Password changed. Please login again.' });
    }

    const request: ChangePasswordRequest = { currentPassword, newPassword, confirmPassword };
    return this.http
      .post<ChangePasswordResponse>(`${this.API_URL}/auth/change-password`, request)
      .pipe(
        tap(() => this.clearAuthState()),
        catchError((error: HttpErrorResponse) => this.handleAuthError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  // ============================================
  // Token Storage
  // ============================================

  getAccessToken(): string | null {
    return this.isBrowser() ? localStorage.getItem(environment.tokenKey) : null;
  }

  private setAccessToken(token: string): void {
    if (this.isBrowser()) localStorage.setItem(environment.tokenKey, token);
  }

  private getRefreshToken(): string | null {
    return this.isBrowser() ? localStorage.getItem(environment.refreshTokenKey) : null;
  }

  private setRefreshToken(token: string): void {
    if (this.isBrowser()) localStorage.setItem(environment.refreshTokenKey, token);
  }

  getStoredUser(): UserInfo | null {
    if (!this.isBrowser()) return null;
    const userJson = localStorage.getItem(environment.userKey);
    if (userJson) {
      try {
        return JSON.parse(userJson) as UserInfo;
      } catch {
        return null;
      }
    }
    return null;
  }

  private setStoredUser(user: UserInfo): void {
    if (this.isBrowser()) localStorage.setItem(environment.userKey, JSON.stringify(user));
  }

  // ============================================
  // Error Handling
  // ============================================

  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';

    if (error.error) {
      const apiError = error.error as ApiErrorResponse;
      errorMessage = apiError.message || apiError.error || errorMessage;

      if (error.status === 429) {
        const retryAfter = apiError.retryAfter || 900;
        errorMessage = `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`;
      }
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to server. Please check your connection.';
    } else if (error.status === 401) {
      errorMessage = 'Invalid email or password.';
    } else if (error.status === 403) {
      errorMessage = 'Access denied.';
    }

    this._error.set(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  clearError(): void {
    this._error.set(null);
  }
}
