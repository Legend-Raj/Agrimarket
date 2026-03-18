/**
 * Application constants
 */
export const APP_NAME = 'AgriMarket';
export const APP_VERSION = '1.0.0';

/**
 * JWT token keys (matching frontend)
 */
export const TOKEN_KEYS = {
  ACCESS_TOKEN: 'marketplace_access_token',
  REFRESH_TOKEN: 'marketplace_refresh_token',
  USER: 'marketplace_user',
};

/**
 * Default pagination values
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

/**
 * Default distance radius in kilometers
 */
export const DEFAULT_DELIVERY_RADIUS = 50; // km

/**
 * Location header names
 */
export const LOCATION_HEADERS = {
  CLIENT_LATITUDE: 'x-client-latitude',
  CLIENT_LONGITUDE: 'x-client-longitude',
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden resource',
  NOT_FOUND: 'Resource not found',
  VALIDATION_FAILED: 'Validation failed',
  INTERNAL_ERROR: 'Internal server error',
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'User with this email already exists',
  INVALID_TOKEN: 'Invalid or expired token',
  INSUFFICIENT_STOCK: 'Insufficient stock available',
  OUT_OF_DELIVERY_RANGE: 'Seller does not deliver to your location',
};

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  REGISTER_SUCCESS: 'Registration successful',
  LOGOUT_SUCCESS: 'Logout successful',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
};
