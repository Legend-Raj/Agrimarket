/**
 * Authentication Models
 * Marketplace user types: Grower (Farmer), Retailer, Manufacturer
 */

// Request DTOs
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RevokeTokenRequest {
  refreshToken: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Response DTOs
export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

// Response DTOs
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
}

// Current user response from /auth/me
export interface CurrentUserResponse {
  authenticated: boolean;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

// Error response from API
export interface ApiErrorResponse {
  error: string;
  message: string;
  retryAfter?: number;
}

// User roles for the marketplace
export type UserRole = 'Grower' | 'Retailer' | 'Manufacturer';

// Route prefix map for role-based routing
export const ROLE_ROUTE_MAP: Record<UserRole, string> = {
  Grower: '/grower',
  Retailer: '/retailer',
  Manufacturer: '/manufacturer',
};

// Auth state for the application
export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
}

// Validation errors
export interface ValidationErrors {
  email?: string;
  password?: string;
}
