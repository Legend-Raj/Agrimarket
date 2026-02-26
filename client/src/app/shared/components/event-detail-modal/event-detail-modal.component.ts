import { Component, Input, Output, EventEmitter, signal, OnInit, OnDestroy, HostListener, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventStatus, getEventStatus } from '../../../core/models/dashboard.models';
import { ParticipationService } from '../../../core/services/participation.service';
import { ParticipationStatusResponse, ParticipationStatus } from '../../../core/models/participation.models';
import { Subject, interval, takeUntil } from 'rxjs';

/**
 * Event interface for the modal
 */
export interface EventDetail {
  id: string;
  name: string;
  description: string | null;
  occursAt: string;
  endsAt: string | null;
  isActive: boolean;
  status?: EventStatus;
  countdownDisplay?: string | null;
}

/**
 * Event Detail Modal Component
 * 
 * Displays comprehensive event information in an overlay modal.
 * Features:
 * - Event name, description, and dates
 * - Live countdown timer for ongoing events
 * - Status indicator with visual feedback
 * - Event participation button (for ongoing/upcoming events)
 * - Smooth animations and transitions
 * - Keyboard accessible (Escape to close)
 * - Click outside to close
 */
@Component({
  selector: 'app-event-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-detail-modal.component.html',
  styleUrl: './event-detail-modal.component.css'
})
export class EventDetailModalComponent implements OnInit, OnDestroy, OnChanges {
  private readonly participationService = inject(ParticipationService);
  
  @Input() event: EventDetail | null = null;
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();

  // Live countdown
  readonly countdownDisplay = signal<string | null>(null);
  
  // Participation state
  readonly isParticipating = signal<boolean>(false);
  readonly participationStatus = signal<ParticipationStatus | null>(null);
  readonly participatedAt = signal<string | null>(null);
  readonly isParticipationLoading = signal<boolean>(false);
  readonly isParticipationStatusLoading = signal<boolean>(true); // Loading until status is fetched
  readonly participationError = signal<string | null>(null);

  ngOnInit(): void {
    this.startCountdownTimer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When modal opens or event changes, reset state and load fresh participation status
    if ((changes['event'] || changes['isOpen']) && this.event && this.isOpen) {
      this.resetParticipationState();
      // Invalidate cache for this event to ensure fresh data from API
      this.participationService.invalidateCache(this.event.id);
      this.loadParticipationStatus();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Reset participation state to defaults.
   * Called when modal opens to ensure clean slate while loading fresh data.
   */
  private resetParticipationState(): void {
    this.isParticipating.set(false);
    this.participationStatus.set(null);
    this.participatedAt.set(null);
    this.isParticipationLoading.set(false);
    this.isParticipationStatusLoading.set(true);
    this.participationError.set(null);
  }

  /**
   * Load participation status for the current event
   */
  private loadParticipationStatus(): void {
    if (!this.event) return;
    
    this.isParticipationStatusLoading.set(true);
    
    this.participationService.getParticipationStatus(this.event.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status: ParticipationStatusResponse) => {
          this.isParticipating.set(status.isParticipating);
          this.participationStatus.set(status.status);
          this.participatedAt.set(status.participatedAt);
          this.isParticipationStatusLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load participation status:', err);
          this.isParticipationStatusLoading.set(false);
        }
      });
  }

  /**
   * Get current event status - computed dynamically from event data
   */
  eventStatus(): EventStatus {
    if (!this.event) return 'Ended';
    return getEventStatus(this.event);
  }

  /**
   * Check if user can participate in the event.
   * Only allowed for UPCOMING events (registration closes when event starts).
   */
  canParticipate(): boolean {
    const status = this.eventStatus();
    // Can only participate in upcoming events (not ongoing or ended)
    return status === 'Upcoming' && !this.isParticipating();
  }

  /**
   * Check if user can cancel their participation.
   * Only allowed for UPCOMING events (can't cancel once event has started or ended).
   */
  canCancelParticipation(): boolean {
    const status = this.eventStatus();
    // Can only cancel for upcoming events, not ongoing or ended
    return this.isParticipating() 
      && this.participationStatus() === 'Registered'
      && status === 'Upcoming';
  }

  /**
   * Check if event registration is closed (event already started or ended).
   * Shows "Registration Closed" message for ongoing/ended events where user didn't participate.
   */
  isRegistrationClosed(): boolean {
    const status = this.eventStatus();
    return (status === 'Ongoing' || status === 'Ended') && !this.isParticipating();
  }

  /**
   * Handle participate button click
   */
  onParticipate(): void {
    if (!this.event || this.isParticipationLoading()) return;
    
    this.isParticipationLoading.set(true);
    this.participationError.set(null);
    
    this.participationService.participateInEvent(this.event.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isParticipating.set(true);
          this.participationStatus.set(response.status);
          this.participatedAt.set(response.participatedAt);
          this.isParticipationLoading.set(false);
        },
        error: (err) => {
          this.participationError.set(err.error?.message || 'Failed to participate in event');
          this.isParticipationLoading.set(false);
        }
      });
  }

  /**
   * Handle cancel participation button click
   */
  onCancelParticipation(): void {
    if (!this.event || this.isParticipationLoading()) return;
    
    this.isParticipationLoading.set(true);
    this.participationError.set(null);
    
    this.participationService.cancelParticipation(this.event.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isParticipating.set(false);
          this.participationStatus.set(null);
          this.participatedAt.set(null);
          this.isParticipationLoading.set(false);
        },
        error: (err) => {
          this.participationError.set(err.error?.message || 'Failed to cancel participation');
          this.isParticipationLoading.set(false);
        }
      });
  }

  /**
   * Handle escape key to close modal
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.onClose();
    }
  }

  /**
   * Handle click on overlay backdrop
   */
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.onClose();
    }
  }

  /**
   * Close the modal
   */
  onClose(): void {
    this.participationError.set(null);
    this.closeModal.emit();
  }

  /**
   * Start live countdown timer
   */
  private startCountdownTimer(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.event) {
          this.countdownDisplay.set(this.calculateCountdown());
        }
      });
  }

  /**
   * Calculate countdown string
   */
  private calculateCountdown(): string | null {
    if (!this.event) return null;

    const now = new Date();
    const status = getEventStatus(this.event);

    if (status === 'Ongoing' && this.event.endsAt) {
      const endsAt = new Date(this.event.endsAt);
      return this.formatTimeDiff(endsAt.getTime() - now.getTime());
    }

    if (status === 'Upcoming') {
      const occursAt = new Date(this.event.occursAt);
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
   * Format date for detailed display
   */
  formatFullDate(dateString: string | null): string {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Calculate event duration
   */
  getEventDuration(): string {
    if (!this.event?.endsAt) return 'Single day event';

    const start = new Date(this.event.occursAt);
    const end = new Date(this.event.endsAt);
    const diffMs = end.getTime() - start.getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      if (remainingHours > 0) {
        return `${days} day${days > 1 ? 's' : ''} ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
      }
      return `${days} day${days > 1 ? 's' : ''}`;
    }

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    const minutes = Math.floor(diffMs / (1000 * 60));
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  /**
   * Get status color class
   */
  getStatusClass(): string {
    return this.eventStatus().toLowerCase();
  }

  /**
   * Get countdown label based on status
   */
  getCountdownLabel(): string {
    const status = this.eventStatus();
    if (status === 'Ongoing') return 'Time Remaining';
    if (status === 'Upcoming') return 'Starts In';
    return '';
  }
}
