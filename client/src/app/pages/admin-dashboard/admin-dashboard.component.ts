import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, AdminDashboardStats } from '../../core/services/admin.service';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { ActivityLogItem, getActivityColorClass } from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdminHeaderComponent } from '../../shared/components/admin-header/admin-header.component';

/**
 * Admin Dashboard Component
 * 
 * Main dashboard for administrators showing:
 * - Navigation header with profile dropdown (consistent with user dashboard)
 * - Welcome section with current date
 * - Statistics overview (Total Users, Points Distributed, Active Events, Pending Requests)
 * - Recent Activity section (placeholder for future implementation)
 * - Quick Actions (Award Points, Create Event, Create Product)
 * 
 * All data is fetched from real backend APIs.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FooterComponent, AdminHeaderComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // User info (for welcome message)
  readonly userFirstName = signal<string>('Admin');

  // Dashboard Statistics State
  readonly totalUsers = signal<number>(0);
  readonly pointsDistributed = signal<number>(0);
  readonly pointsGrowth = signal<number>(0);
  readonly activeEvents = signal<number>(0);
  readonly pendingRequests = signal<number>(0);

  // UI State
  readonly isLoading = signal<boolean>(true);

  readonly currentYear = new Date().getFullYear();
  
  // Current date for display
  readonly currentDate = computed(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  // Quick Actions
  readonly quickActions = [
    { 
      id: 'award-points',
      label: 'Award Points', 
      icon: 'points',
      description: 'Allocate reward points to employees'
    },
    { 
      id: 'create-event',
      label: 'Create Event', 
      icon: 'calendar',
      description: 'Set up a new rewards event'
    },
    { 
      id: 'create-product',
      label: 'Create Product', 
      icon: 'product',
      description: 'Add items to the rewards catalog'
    }
  ];

  // Recent Activity (placeholder - will be implemented later)
  readonly recentActivities = signal<ActivityLogItem[]>([]);
  readonly isLoadingActivities = signal<boolean>(true);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load all dashboard data from backend APIs
   */
  private loadDashboardData(): void {
    this.isLoading.set(true);

    // Load current user info for welcome message
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: CurrentUserResponse) => {
          const nameParts = user.name?.split(' ') || [];
          this.userFirstName.set(nameParts[0] || user.email.split('@')[0]);
        },
        error: (error) => {
          console.error('Failed to load user info:', error);
        }
      });

    // Load dashboard statistics
    this.adminService.loadDashboardStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats: AdminDashboardStats) => {
          this.totalUsers.set(stats.totalUsers);
          this.pointsDistributed.set(stats.pointsDistributed);
          this.pointsGrowth.set(stats.pointsGrowth);
          this.activeEvents.set(stats.activeEvents);
          this.pendingRequests.set(stats.pendingRequests);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load dashboard stats:', error);
          this.isLoading.set(false);
        }
      });

    // Load recent activities
    this.loadRecentActivities();
  }

  /**
   * Load recent activities for the activity feed
   */
  private loadRecentActivities(): void {
    this.isLoadingActivities.set(true);
    
    this.adminService.getRecentActivities(10)//Load 7 recent activities
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activities: ActivityLogItem[]) => {
          this.recentActivities.set(activities);
          this.isLoadingActivities.set(false);
        },
        error: (error) => {
          console.error('Failed to load recent activities:', error);
          this.isLoadingActivities.set(false);
        }
      });
  }

  /**
   * Get CSS class for activity type color styling
   */
  getActivityColorClass(activityType: string): string {
    return getActivityColorClass(activityType as any);
  }

  /**
   * Format relative time for activity display
   */
  formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return activityTime.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Handle quick action click
   */
  onQuickAction(actionId: string): void {
    switch (actionId) {
      case 'award-points':
        this.router.navigate(['/admin/points']);
        break;
      case 'create-event':
        this.router.navigate(['/admin/events/create']);
        break;
      case 'create-product':
        this.router.navigate(['/admin/products/create']);
        break;
    }
  }

  /**
   * Format points number with commas
   */
  formatPoints(points: number): string {
    return points.toLocaleString('en-US');
  }

  /**
   * Format large numbers with abbreviation
   */
  formatLargeNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
  }

  /**
   * Get greeting based on time of day
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
}
