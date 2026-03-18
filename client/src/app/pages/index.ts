// AgriMarket Pages barrel exports
// Only export pages that are actually used in AgriMarket routes

// Auth pages
export * from './auth/auth.component';
export * from './forgot-password/forgot-password.component';
export * from './reset-password/reset-password.component';

// Dashboard pages (main pages for each role)
export * from './grower-dashboard/grower-dashboard.component';
export * from './retailer-dashboard/retailer-dashboard.component';
export * from './manufacturer-dashboard/manufacturer-dashboard.component';

// Shared pages
export * from './profile/profile.component';
export * from './change-password/change-password.component';
export * from './unauthorized/unauthorized.component';

// Legacy admin pages (not used in AgriMarket but kept for reference)
// export * from './admin-dashboard/admin-dashboard.component';
// export * from './admin-users/admin-users.component';
// export * from './admin-events/admin-events.component';
// export * from './admin-points/admin-points.component';
// export * from './admin-redemptions/admin-redemptions.component';
// export * from './admin-add-admin/admin-add-admin.component';
