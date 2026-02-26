import { Routes } from '@angular/router';
import { authGuard, roleGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Application Routes
 *
 * Route structure:
 * - /             -> Redirects to /login (guestGuard will redirect authenticated users)
 * - /login        -> Login page (guest only)
 * - /grower/**    -> Grower dashboard & sub-routes (Grower role only)
 * - /retailer/**  -> Retailer dashboard & sub-routes (Retailer role only)
 * - /manufacturer/** -> Manufacturer dashboard & sub-routes (Manufacturer role only)
 * - /unauthorized -> Access denied page
 */
export const routes: Routes = [
  // Default: redirect to login (guestGuard handles redirect for logged-in users)
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  //  Authentication routes (guest only) 
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Sign In - AgriMarket',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    canActivate: [guestGuard],
    title: 'Forgot Password - AgriMarket',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
    canActivate: [guestGuard],
    title: 'Reset Password - AgriMarket',
  },

  //  Grower routes 
  {
    path: 'grower',
    canActivate: [authGuard, roleGuard('Grower')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/grower-dashboard/grower-dashboard.component').then(
            (m) => m.GrowerDashboardComponent
          ),
        title: 'Dashboard - AgriMarket Grower',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        data: { context: 'grower' },
        title: 'My Profile - AgriMarket',
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent
          ),
        data: { context: 'grower' },
        title: 'Change Password - AgriMarket',
      },
      // Placeholder child routes — pages to be built in later phases
      {
        path: '**',
        loadComponent: () =>
          import('./pages/grower-dashboard/grower-dashboard.component').then(
            (m) => m.GrowerDashboardComponent
          ),
      },
    ],
  },

  //  Retailer routes 
  {
    path: 'retailer',
    canActivate: [authGuard, roleGuard('Retailer')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/retailer-dashboard/retailer-dashboard.component').then(
            (m) => m.RetailerDashboardComponent
          ),
        title: 'Dashboard - AgriMarket Retailer',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        data: { context: 'retailer' },
        title: 'My Profile - AgriMarket',
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent
          ),
        data: { context: 'retailer' },
        title: 'Change Password - AgriMarket',
      },
      {
        path: '**',
        loadComponent: () =>
          import('./pages/retailer-dashboard/retailer-dashboard.component').then(
            (m) => m.RetailerDashboardComponent
          ),
      },
    ],
  },

  //  Manufacturer routes 
  {
    path: 'manufacturer',
    canActivate: [authGuard, roleGuard('Manufacturer')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import(
            './pages/manufacturer-dashboard/manufacturer-dashboard.component'
          ).then((m) => m.ManufacturerDashboardComponent),
        title: 'Dashboard - AgriMarket Manufacturer',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        data: { context: 'manufacturer' },
        title: 'My Profile - AgriMarket',
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent
          ),
        data: { context: 'manufacturer' },
        title: 'Change Password - AgriMarket',
      },
      {
        path: '**',
        loadComponent: () =>
          import(
            './pages/manufacturer-dashboard/manufacturer-dashboard.component'
          ).then((m) => m.ManufacturerDashboardComponent),
      },
    ],
  },

  //  Unauthorized page 
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./pages/unauthorized/unauthorized.component').then(
        (m) => m.UnauthorizedComponent
      ),
    title: 'Access Denied - AgriMarket',
  },

  //  Catch-all  login 
  {
    path: '**',
    redirectTo: 'login',
  },
];
