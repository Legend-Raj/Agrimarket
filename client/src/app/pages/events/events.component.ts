import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';
import { AuthService, DashboardService, ParticipationService } from '../../core/services';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { Event as RewardEvent, EventStatus, getEventStatus, UserResponse } from '../../core/models/dashboard.models';
import { EventParticipationResponse } from '../../core/models/participation.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { EventDetailModalComponent, EventDetail } from '../../shared/components/event-detail-modal/event-detail-modal.component';
import { NotificationDropdownComponent } from '../../shared/components/notification-dropdown/notification-dropdown.component';

/**
 * Extended event type with computed status and countdown.
 */
interface EventCard extends RewardEvent {
  status: EventStatus;
  countdownDisplay: string | null;
}

/**
 * Events Component
 * 
 * Displays all events as cards with status indicators.
 * 
 * Features:
 * - Event cards with name, description, dates, and status
 * - Ongoing events: clickable with live countdown timer
 * - Upcoming events: clearly labeled, not clickable
 * - Ended events: clearly labeled, not clickable
 * - Consistent UI with the rest of the User Dashboard
 */
@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, RouterLink, FooterComponent, EventDetailModalComponent, NotificationDropdownComponent],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly participationService = inject(ParticipationService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // User State
  readonly userName = signal<string>('');
  readonly userEmail = signal<string>('');
  readonly userId = signal<string>('');
  readonly userFirstName = signal<string>('');

  // Points State (for header display)
  readonly availablePoints = signal<number>(0);

  // Events State
  readonly events = signal<EventCard[]>([]);
  readonly participatedEvents = signal<EventParticipationResponse[]>([]);
  readonly participatedEventIds = signal<Set<string>>(new Set());

  // Filter State
  readonly activeFilter = signal<'all' | 'ongoing' | 'upcoming' | 'ended' | 'participated'>('all');

  // Filtered events based on selected filter
  readonly filteredEvents = computed(() => {
    const filter = this.activeFilter();
    const allEvents = this.events();
    
    if (filter === 'all') {
      return allEvents;
    }
    
    if (filter === 'participated') {
      // Return events that user has participated in
      const participatedIds = this.participatedEventIds();
      return allEvents.filter(event => participatedIds.has(event.id));
    }
    
    return allEvents.filter(event => event.status.toLowerCase() === filter);
  });

  // Event counts by status
  readonly ongoingCount = computed(() => this.events().filter(e => e.status === 'Ongoing').length);
  readonly upcomingCount = computed(() => this.events().filter(e => e.status === 'Upcoming').length);
  readonly endedCount = computed(() => this.events().filter(e => e.status === 'Ended').length);
  readonly participatedCount = computed(() => this.participatedEvents().length);

  // UI State
  readonly isLoading = signal<boolean>(true);
  readonly isProfileDropdownOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // Modal State
  readonly isModalOpen = signal<boolean>(false);
  readonly selectedEvent = signal<EventDetail | null>(null);

  // Computed values
  readonly userInitial = computed(() => {
    const name = this.userFirstName() || this.userName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  readonly currentYear = new Date().getFullYear();

  // Navigation items
  readonly navItems = [
    { label: 'Home', route: '/dashboard', icon: 'home' },
    { label: 'Events', route: '/events', icon: 'calendar', active: true },
    { label: 'Products', route: '/products', icon: 'gift' },
    { label: 'Transactions', route: '/transactions', icon: 'receipt' }
  ];

  ngOnInit(): void {
    this.loadUserData();
    this.loadEvents();
    this.loadParticipatedEvents();
    this.startCountdownTimer();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Close dropdowns when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    if (!target.closest('.profile-menu-container')) {
      this.isProfileDropdownOpen.set(false);
    }
    
    if (!target.closest('.notifications-container')) {
      this.isNotificationsOpen.set(false);
    }
  }

  /**
   * Load user data
   */
  private loadUserData(): void {
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: CurrentUserResponse) => {
          this.userName.set(user.name || user.email.split('@')[0]);
          this.userEmail.set(user.email);
          this.userId.set(user.userId);
          
          const nameParts = user.name?.split(' ') || [];
          this.userFirstName.set(nameParts[0] || user.email.split('@')[0]);

          // Load user balance
          this.dashboardService.getUserById(user.userId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (userData: UserResponse) => {
                this.availablePoints.set(userData.availablePoints);
              },
              error: (err) => console.error('Failed to load user balance:', err)
            });
        },
        error: (error) => {
          console.error('Failed to load user info:', error);
          const cachedUser = this.authService.user();
          if (cachedUser) {
            this.userName.set(cachedUser.email.split('@')[0]);
            this.userEmail.set(cachedUser.email);
            this.userId.set(cachedUser.id);
          }
        }
      });
  }

  /**
   * Load events from the backend
   */
  private loadEvents(): void {
    this.isLoading.set(true);
    
    this.dashboardService.getAllEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events: RewardEvent[]) => {
          const eventCards = events.map(event => this.toEventCard(event));
          
          // Sort events: Ongoing first, then Upcoming, then Ended
          eventCards.sort((a, b) => {
            const statusOrder = { 'Ongoing': 0, 'Upcoming': 1, 'Ended': 2 };
            const statusDiff = statusOrder[a.status] - statusOrder[b.status];
            if (statusDiff !== 0) return statusDiff;
            
            // Within same status, sort by relevant date
            if (a.status === 'Ended') {
              // Ended: most recent first
              return new Date(b.endsAt || b.occursAt).getTime() - new Date(a.endsAt || a.occursAt).getTime();
            } else {
              // Ongoing/Upcoming: soonest first
              return new Date(a.occursAt).getTime() - new Date(b.occursAt).getTime();
            }
          });
          
          this.events.set(eventCards);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load events:', error);
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Load user's participated events
   */
  private loadParticipatedEvents(): void {
    this.participationService.getMyParticipations(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.participatedEvents.set(response.items);
          // Create a Set of participated event IDs for quick lookup
          const ids = new Set(response.items.map(p => p.eventId));
          this.participatedEventIds.set(ids);
        },
        error: (error) => {
          console.error('Failed to load participated events:', error);
        }
      });
  }

  /**
   * Convert an Event to an EventCard with status and countdown
   */
  private toEventCard(event: RewardEvent): EventCard {
    const status = getEventStatus(event);
    return {
      ...event,
      status,
      countdownDisplay: this.calculateCountdown(event, status)
    };
  }

  /**
   * Calculate countdown string for an event
   */
  private calculateCountdown(event: RewardEvent, status: EventStatus): string | null {
    const now = new Date();
    
    if (status === 'Ongoing' && event.endsAt) {
      const endsAt = new Date(event.endsAt);
      return this.formatTimeDiff(endsAt.getTime() - now.getTime());
    }
    
    if (status === 'Upcoming') {
      const occursAt = new Date(event.occursAt);
      return this.formatTimeDiff(occursAt.getTime() - now.getTime());
    }
    
    return null;
  }

  /**
   * Format time difference as human-readable string
   */
  private formatTimeDiff(diffMs: number): string {
    if (diffMs <= 0) return '0s';
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      return days === 1 ? `1 day ${remainingHours}h` : `${days} days ${remainingHours}h`;
    }
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    
    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    return `${seconds}s`;
  }

  /**
   * Start the countdown timer (updates every second)
   */
  private startCountdownTimer(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Update countdown for all events
        const updatedEvents = this.events().map(event => {
          const newStatus = getEventStatus(event);
          return {
            ...event,
            status: newStatus,
            countdownDisplay: this.calculateCountdown(event, newStatus)
          };
        });
        
        this.events.set(updatedEvents);
      });
  }

  /**
   * Handle event card click - opens the detail modal
   */
  onEventClick(event: EventCard): void {
    // Open modal for any event (not just ongoing)
    this.selectedEvent.set({
      id: event.id,
      name: event.name,
      description: event.description,
      occursAt: event.occursAt,
      endsAt: event.endsAt,
      isActive: event.isActive,
      status: event.status,
      countdownDisplay: event.countdownDisplay
    });
    this.isModalOpen.set(true);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close the event detail modal
   */
  onCloseModal(): void {
    this.isModalOpen.set(false);
    this.selectedEvent.set(null);
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Set the active filter
   */
  setFilter(filter: 'all' | 'ongoing' | 'upcoming' | 'ended' | 'participated'): void {
    this.activeFilter.set(filter);
  }

  /**
   * Check if user is participating in an event
   */
  isEventParticipated(eventId: string): boolean {
    return this.participatedEventIds().has(eventId);
  }

  /**
   * Get participation info for an event
   */
  getParticipationInfo(eventId: string): EventParticipationResponse | undefined {
    return this.participatedEvents().find(p => p.eventId === eventId);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Format short date for card display
   */
  formatShortDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // UI Toggle Methods
  toggleProfileDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileDropdownOpen.set(!this.isProfileDropdownOpen());
    this.isNotificationsOpen.set(false);
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.isNotificationsOpen.set(!this.isNotificationsOpen());
    this.isProfileDropdownOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  // Navigation Methods
  onProfile(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/profile']);
  }

  onChangePassword(): void {
    this.isProfileDropdownOpen.set(false);
    this.router.navigate(['/change-password']);
  }

  onLogout(): void {
    this.isProfileDropdownOpen.set(false);
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
