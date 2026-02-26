import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { ParticipationService } from '../../core/services/participation.service';
import { Event as RewardEvent, EventStatus, getEventStatus } from '../../core/models/dashboard.models';
import { EventParticipationResponse } from '../../core/models/participation.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdminHeaderComponent } from '../../shared/components/admin-header/admin-header.component';

/**
 * Event filter options
 */
type EventFilter = 'active' | 'upcoming' | 'past';

/**
 * Extended event interface with computed status for UI display
 */
interface EventWithStatus extends RewardEvent {
  status: EventStatus;
}

/**
 * Interface for Create Event form
 */
interface CreateEventForm {
  name: string;
  description: string;
  occursAt: string;
  endsAt: string;
  isActive: boolean;
}

/**
 * Interface for Edit Event form
 */
interface EditEventForm {
  name: string;
  description: string;
  occursAt: string;
  endsAt: string;
  isActive: boolean;
}

/**
 * Admin Events Page Component
 * 
 * Displays:
 * - Summary card with events count (filterable by Active / Upcoming / Past)
 * - Action cards: View/Edit Events, Add Event
 * - Modals for viewing, editing, and adding events
 * 
 * Follows the same design patterns as admin-products for consistency.
 */
@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, AdminHeaderComponent],
  templateUrl: './admin-events.component.html',
  styleUrl: './admin-events.component.css'
})
export class AdminEventsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly participationService = inject(ParticipationService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // Events Statistics
  readonly eventsCount = signal<number>(0);
  readonly eventFilter = signal<EventFilter>('active');
  readonly allEvents = signal<EventWithStatus[]>([]);

  // UI State
  readonly isLoading = signal<boolean>(true);

  // Modal States
  readonly showAddEventModal = signal<boolean>(false);
  readonly showEventListModal = signal<boolean>(false);
  readonly showEditEventModal = signal<boolean>(false);
  readonly showConfirmModal = signal<boolean>(false);

  // Add Event Form State
  readonly addEventForm = signal<CreateEventForm>({
    name: '',
    description: '',
    occursAt: '',
    endsAt: '',
    isActive: true
  });
  readonly addEventErrors = signal<Record<string, string>>({});
  readonly isAddingEvent = signal<boolean>(false);
  readonly addEventSuccess = signal<string>('');

  // Event List State
  readonly eventList = signal<EventWithStatus[]>([]);
  readonly eventListLoading = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  // Edit Event State
  readonly selectedEvent = signal<EventWithStatus | null>(null);
  readonly editEventForm = signal<EditEventForm>({
    name: '',
    description: '',
    occursAt: '',
    endsAt: '',
    isActive: true
  });
  readonly editEventErrors = signal<Record<string, string>>({});
  readonly isUpdatingEvent = signal<boolean>(false);
  readonly editEventSuccess = signal<string>('');

  // Confirm Modal State
  readonly confirmAction = signal<'save' | 'add' | 'removeParticipant' | null>(null);
  readonly confirmTitle = signal<string>('');
  readonly confirmMessage = signal<string>('');
  readonly isConfirmLoading = signal<boolean>(false);

  // View Participants Modal State
  readonly showParticipantsModal = signal<boolean>(false);
  readonly participantsEvent = signal<EventWithStatus | null>(null);
  readonly participants = signal<EventParticipationResponse[]>([]);
  readonly participantsLoading = signal<boolean>(false);
  readonly participantsTotalCount = signal<number>(0);
  readonly participantsCurrentPage = signal<number>(1);
  readonly participantsPageSize = 20;
  readonly participantToRemove = signal<EventParticipationResponse | null>(null);
  readonly removeParticipantError = signal<string>('');
  readonly removeParticipantSuccess = signal<string>('');

  // Computed values
  readonly canRemoveParticipants = computed(() => {
    const event = this.participantsEvent();
    return event?.status === 'Upcoming';
  });

  readonly participantsTotalPages = computed(() => {
    return Math.ceil(this.participantsTotalCount() / this.participantsPageSize);
  });

  readonly filteredEventList = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.eventList();
    
    return this.eventList().filter(event => 
      event.name.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query)
    );
  });

  readonly totalEvents = computed(() => this.allEvents().length);

  // Event filter options for dropdown
  readonly filterOptions: { value: EventFilter; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' }
  ];

  ngOnInit(): void {
    this.loadData();
    this.setupSearchDebounce();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle escape key to close modals
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showConfirmModal()) this.closeConfirmModal();
    else if (this.showAddEventModal()) this.closeAddEventModal();
    else if (this.showEditEventModal()) this.closeEditEventModal();
    else if (this.showEventListModal()) this.closeEventListModal();
  }

  /**
   * Setup debounced search
   */
  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery.set(query);
    });
  }

  /**
   * Load initial data
   */
  private loadData(): void {
    this.isLoading.set(true);

    // Load all events and calculate count
    this.loadEvents();
  }

  /**
   * Load all events and update count
   */
  private loadEvents(): void {
    this.adminService.getEvents(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events) => {
          // Add computed status to each event
          const eventsWithStatus = events.map(event => ({
            ...event,
            status: getEventStatus(event)
          }));
          this.allEvents.set(eventsWithStatus);
          this.updateEventsCount();
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load events:', error);
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Update events count based on selected filter
   */
  private updateEventsCount(): void {
    const events = this.allEvents();
    const filter = this.eventFilter();
    const now = new Date();
    
    let count = 0;
    
    events.forEach(event => {
      const occursAt = new Date(event.occursAt);
      const endsAt = event.endsAt ? new Date(event.endsAt) : null;
      
      switch (filter) {
        case 'active':
          // Active: event is ongoing (started but not ended) and isActive=true
          if (!event.isActive) break;
          if (now < occursAt) break; // Not started yet
          if (endsAt && now > endsAt) break; // Already ended
          // If no endsAt and it has started, it's considered active until we say it ended
          if (!endsAt && now > occursAt) {
            // Still count as active if it's the same day
            const sameDay = occursAt.toDateString() === now.toDateString();
            if (sameDay) count++;
            break;
          }
          count++;
          break;
        case 'upcoming':
          // Upcoming: event hasn't started yet and isActive=true
          if (event.isActive && now < occursAt) count++;
          break;
        case 'past':
          // Past: event has ended
          if (endsAt && now > endsAt) {
            count++;
          } else if (!endsAt && now > occursAt) {
            // If no endsAt and occursAt is past, consider it ended (unless same day)
            const sameDay = occursAt.toDateString() === now.toDateString();
            if (!sameDay) count++;
          }
          break;
      }
    });
    
    this.eventsCount.set(count);
  }

  /**
   * Get event status for display
   */
  getEventStatusDisplay(event: EventWithStatus): string {
    const now = new Date();
    const occursAt = new Date(event.occursAt);
    const endsAt = event.endsAt ? new Date(event.endsAt) : null;
    
    if (!event.isActive) return 'Inactive';
    if (now < occursAt) return 'Upcoming';
    if (endsAt && now > endsAt) return 'Ended';
    if (!endsAt && now > occursAt) {
      const sameDay = occursAt.toDateString() === now.toDateString();
      return sameDay ? 'Ongoing' : 'Ended';
    }
    return 'Ongoing';
  }

  /**
   * Get CSS class for event status badge
   */
  getEventStatusClass(event: EventWithStatus): string {
    const status = this.getEventStatusDisplay(event);
    switch (status) {
      case 'Ongoing': return 'status-ongoing';
      case 'Upcoming': return 'status-upcoming';
      case 'Ended': return 'status-ended';
      case 'Inactive': return 'status-inactive';
      default: return '';
    }
  }

  /**
   * Handle event filter change
   */
  onEventFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.eventFilter.set(select.value as EventFilter);
    this.updateEventsCount();
  }

  // ============================================
  // Navigation & UI Actions
  // ============================================

  // ============================================
  // Helper Methods
  // ============================================

  formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format date for datetime-local input
   */
  formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format: YYYY-MM-DDTHH:mm
    return date.toISOString().slice(0, 16);
  }

  // ============================================
  // Add Event Modal
  // ============================================

  openAddEventModal(): void {
    this.resetAddEventForm();
    this.showAddEventModal.set(true);
  }

  closeAddEventModal(): void {
    this.showAddEventModal.set(false);
    this.resetAddEventForm();
  }

  private resetAddEventForm(): void {
    this.addEventForm.set({
      name: '',
      description: '',
      occursAt: '',
      endsAt: '',
      isActive: true
    });
    this.addEventErrors.set({});
    this.addEventSuccess.set('');
    this.isAddingEvent.set(false);
  }

  updateAddEventField(field: keyof CreateEventForm, value: string | boolean): void {
    this.addEventForm.update(form => ({ ...form, [field]: value }));
    // Clear error for this field when user starts typing
    this.addEventErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field];
      return newErrors;
    });
  }

  validateAddEventForm(): boolean {
    const form = this.addEventForm();
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors['name'] = 'Event name is required.';
    } else if (form.name.length > 200) {
      errors['name'] = 'Event name is too long (max 200 characters).';
    }

    if (!form.occursAt) {
      errors['occursAt'] = 'Start date/time is required.';
    }

    if (form.endsAt && form.occursAt) {
      const occursAt = new Date(form.occursAt);
      const endsAt = new Date(form.endsAt);
      if (endsAt <= occursAt) {
        errors['endsAt'] = 'End date must be after start date.';
      }
    }

    if (form.description && form.description.length > 2000) {
      errors['description'] = 'Description is too long (max 2000 characters).';
    }

    this.addEventErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Show confirmation popup before adding event
   */
  confirmAddEvent(): void {
    if (!this.validateAddEventForm()) return;

    this.confirmAction.set('add');
    this.confirmTitle.set('Confirm Add Event');
    this.confirmMessage.set(`Are you sure you want to create the event "${this.addEventForm().name}"?`);
    this.showConfirmModal.set(true);
  }

  /**
   * Actually submit the add event request
   */
  submitAddEvent(): void {
    this.isAddingEvent.set(true);
    this.addEventErrors.set({});
    this.addEventSuccess.set('');

    const form = this.addEventForm();
    const request: {
      name: string;
      description?: string;
      occursAt: string;
      endsAt?: string;
      isActive: boolean;
    } = {
      name: form.name.trim(),
      occursAt: new Date(form.occursAt).toISOString(),
      isActive: form.isActive
    };

    if (form.description.trim()) {
      request.description = form.description.trim();
    }

    if (form.endsAt) {
      request.endsAt = new Date(form.endsAt).toISOString();
    }

    this.adminService.createEvent(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => {
          this.addEventSuccess.set(`Event "${event.name}" created successfully!`);
          this.isAddingEvent.set(false);
          // Update events list with computed status
          const eventWithStatus: EventWithStatus = {
            ...event,
            status: getEventStatus(event)
          };
          this.allEvents.update(events => [...events, eventWithStatus]);
          this.updateEventsCount();
          // Close modal after 1.5 seconds
          setTimeout(() => {
            this.closeAddEventModal();
          }, 1500);
        },
        error: (error) => {
          this.isAddingEvent.set(false);
          if (error.error?.errors) {
            const backendErrors: Record<string, string> = {};
            for (const [key, messages] of Object.entries(error.error.errors)) {
              backendErrors[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
            }
            this.addEventErrors.set(backendErrors);
          } else {
            this.addEventErrors.set({ general: error.error?.message || 'Failed to create event. Please try again.' });
          }
        }
      });
  }

  // ============================================
  // Event List Modal
  // ============================================

  openEventListModal(): void {
    this.showEventListModal.set(true);
    this.loadEventList();
  }

  closeEventListModal(): void {
    this.showEventListModal.set(false);
    this.searchQuery.set('');
    this.eventList.set([]);
  }

  loadEventList(): void {
    this.eventListLoading.set(true);

    this.adminService.getEvents(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events) => {
          // Add computed status to each event
          const eventsWithStatus = events.map(event => ({
            ...event,
            status: getEventStatus(event)
          }));
          
          // Sort events: Ongoing first, then Upcoming, then Ended
          // Within each status group, sort by relevant date
          const sortedEvents = this.sortEventsByStatusAndDate(eventsWithStatus);
          
          this.eventList.set(sortedEvents);
          this.eventListLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load events:', error);
          this.eventListLoading.set(false);
        }
      });
  }

  /**
   * Sorts events by status (Ongoing → Upcoming → Ended) and then by date.
   * - Ongoing: sorted by end date ascending (soonest to end first)
   * - Upcoming: sorted by start date ascending (soonest to start first)
   * - Ended: sorted by end date descending (most recently ended first)
   */
  private sortEventsByStatusAndDate(events: EventWithStatus[]): EventWithStatus[] {
    const statusOrder: Record<string, number> = { 'Ongoing': 0, 'Upcoming': 1, 'Ended': 2 };
    
    return [...events].sort((a, b) => {
      // First, sort by status priority
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      // Within the same status, sort by relevant date
      if (a.status === 'Ended') {
        // Ended events: most recently ended first (descending)
        const aEndDate = new Date(a.endsAt || a.occursAt).getTime();
        const bEndDate = new Date(b.endsAt || b.occursAt).getTime();
        return bEndDate - aEndDate;
      } else if (a.status === 'Ongoing') {
        // Ongoing events: soonest to end first (ascending by end date)
        const aEndDate = a.endsAt ? new Date(a.endsAt).getTime() : Infinity;
        const bEndDate = b.endsAt ? new Date(b.endsAt).getTime() : Infinity;
        return aEndDate - bEndDate;
      } else {
        // Upcoming events: soonest to start first (ascending by start date)
        const aStartDate = new Date(a.occursAt).getTime();
        const bStartDate = new Date(b.occursAt).getTime();
        return aStartDate - bStartDate;
      }
    });
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  // ============================================
  // Edit Event Modal
  // ============================================

  openEditEventModal(event: EventWithStatus): void {
    this.selectedEvent.set(event);
    this.editEventForm.set({
      name: event.name,
      description: event.description || '',
      occursAt: this.formatDateForInput(event.occursAt),
      endsAt: event.endsAt ? this.formatDateForInput(event.endsAt) : '',
      isActive: event.isActive
    });
    this.editEventErrors.set({});
    this.editEventSuccess.set('');
    this.showEditEventModal.set(true);
  }

  closeEditEventModal(): void {
    this.showEditEventModal.set(false);
    this.selectedEvent.set(null);
    this.editEventErrors.set({});
    this.editEventSuccess.set('');
  }

  updateEditEventField(field: keyof EditEventForm, value: string | boolean): void {
    this.editEventForm.update(form => ({ ...form, [field]: value }));
    this.editEventErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field];
      return newErrors;
    });
  }

  validateEditEventForm(): boolean {
    const form = this.editEventForm();
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors['name'] = 'Event name is required.';
    } else if (form.name.length > 200) {
      errors['name'] = 'Event name is too long (max 200 characters).';
    }

    if (!form.occursAt) {
      errors['occursAt'] = 'Start date/time is required.';
    }

    if (form.endsAt && form.occursAt) {
      const occursAt = new Date(form.occursAt);
      const endsAt = new Date(form.endsAt);
      if (endsAt <= occursAt) {
        errors['endsAt'] = 'End date must be after start date.';
      }
    }

    if (form.description && form.description.length > 2000) {
      errors['description'] = 'Description is too long (max 2000 characters).';
    }

    this.editEventErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Show confirmation popup before saving changes
   */
  confirmEditEvent(): void {
    if (!this.validateEditEventForm()) return;

    const event = this.selectedEvent();
    if (!event) return;

    this.confirmAction.set('save');
    this.confirmTitle.set('Confirm Save Changes');
    this.confirmMessage.set(`Are you sure you want to save changes to "${event.name}"?`);
    this.showConfirmModal.set(true);
  }

  /**
   * Actually submit the edit event request
   */
  submitEditEvent(): void {
    const event = this.selectedEvent();
    if (!event) return;

    this.isUpdatingEvent.set(true);
    this.editEventErrors.set({});
    this.editEventSuccess.set('');

    const form = this.editEventForm();
    
    // Build the update request
    const updateRequest: {
      name: string;
      description?: string | null;
      occursAt: string;
      endsAt?: string | null;
    } = {
      name: form.name.trim(),
      occursAt: new Date(form.occursAt).toISOString(),
      description: form.description.trim() || null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null
    };

    // Update the event details
    this.adminService.updateEvent(event.id, updateRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedEvent) => {
          // Check if isActive state changed and update if needed
          if (form.isActive !== event.isActive) {
            this.adminService.setEventActive(event.id, form.isActive)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (finalEvent) => {
                  this.handleSuccessfulUpdate(finalEvent);
                },
                error: (error) => {
                  // Still update with the main event data even if active state fails
                  this.handleSuccessfulUpdate(updatedEvent);
                  console.error('Failed to update active state:', error);
                }
              });
          } else {
            this.handleSuccessfulUpdate(updatedEvent);
          }
        },
        error: (error) => {
          this.isUpdatingEvent.set(false);
          if (error.error?.errors) {
            const backendErrors: Record<string, string> = {};
            for (const [key, messages] of Object.entries(error.error.errors)) {
              backendErrors[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
            }
            this.editEventErrors.set(backendErrors);
          } else {
            this.editEventErrors.set({ general: error.error?.message || 'Failed to update event. Please try again.' });
          }
        }
      });
  }

  private handleSuccessfulUpdate(updatedEvent: RewardEvent): void {
    const eventWithStatus: EventWithStatus = {
      ...updatedEvent,
      status: getEventStatus(updatedEvent)
    };
    
    this.editEventSuccess.set('Event updated successfully!');
    this.isUpdatingEvent.set(false);
    
    // Update the event in the list
    this.eventList.update(events => 
      events.map(e => e.id === eventWithStatus.id ? eventWithStatus : e)
    );
    this.allEvents.update(events => 
      events.map(e => e.id === eventWithStatus.id ? eventWithStatus : e)
    );
    this.updateEventsCount();
    
    // Close modal after 1.5 seconds
    setTimeout(() => {
      this.closeEditEventModal();
    }, 1500);
  }

  // ============================================
  // View Participants Modal
  // ============================================

  openParticipantsModal(event: EventWithStatus): void {
    this.participantsEvent.set(event);
    this.participants.set([]);
    this.participantsTotalCount.set(0);
    this.participantsCurrentPage.set(1);
    this.removeParticipantError.set('');
    this.removeParticipantSuccess.set('');
    this.participantToRemove.set(null);
    this.showParticipantsModal.set(true);
    this.loadParticipants();
  }

  closeParticipantsModal(): void {
    this.showParticipantsModal.set(false);
    this.participantsEvent.set(null);
    this.participants.set([]);
    this.participantToRemove.set(null);
    this.removeParticipantError.set('');
    this.removeParticipantSuccess.set('');
  }

  loadParticipants(): void {
    const event = this.participantsEvent();
    if (!event) return;

    this.participantsLoading.set(true);
    const skip = (this.participantsCurrentPage() - 1) * this.participantsPageSize;

    this.participationService.getEventParticipants(event.id, skip, this.participantsPageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.participants.set(response.items);
          this.participantsTotalCount.set(response.totalCount);
          this.participantsLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load participants:', error);
          this.participantsLoading.set(false);
        }
      });
  }

  goToParticipantsPage(page: number): void {
    if (page < 1 || page > this.participantsTotalPages()) return;
    this.participantsCurrentPage.set(page);
    this.loadParticipants();
  }

  confirmRemoveParticipant(participant: EventParticipationResponse): void {
    const event = this.participantsEvent();
    if (!event || event.status !== 'Upcoming') {
      this.removeParticipantError.set('Participants can only be removed from upcoming events.');
      return;
    }

    this.participantToRemove.set(participant);
    this.confirmAction.set('removeParticipant');
    this.confirmTitle.set('Remove Participant');
    this.confirmMessage.set(`Are you sure you want to remove "${participant.userName || 'this user'}" from the event "${event.name}"? The user will be notified of this removal.`);
    this.showConfirmModal.set(true);
  }

  private executeRemoveParticipant(): void {
    const event = this.participantsEvent();
    const participant = this.participantToRemove();
    
    if (!event || !participant) {
      this.closeConfirmModal();
      return;
    }

    this.participationService.removeParticipant(event.id, participant.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.removeParticipantSuccess.set(`Successfully removed ${participant.userName || 'participant'} from the event.`);
          this.removeParticipantError.set('');
          this.participantToRemove.set(null);
          this.isConfirmLoading.set(false);
          this.closeConfirmModal();
          
          // Refresh the participants list
          this.loadParticipants();
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.removeParticipantSuccess.set('');
          }, 3000);
        },
        error: (error) => {
          this.isConfirmLoading.set(false);
          this.closeConfirmModal();
          this.removeParticipantError.set(error.error?.message || 'Failed to remove participant. Please try again.');
          this.participantToRemove.set(null);
          
          // Clear error after 5 seconds
          setTimeout(() => {
            this.removeParticipantError.set('');
          }, 5000);
        }
      });
  }

  formatParticipationDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // ============================================
  // Confirmation Modal
  // ============================================

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
    this.isConfirmLoading.set(false);
  }

  executeConfirmAction(): void {
    this.isConfirmLoading.set(true);
    const action = this.confirmAction();
    
    if (action === 'add') {
      this.closeConfirmModal();
      this.submitAddEvent();
    } else if (action === 'save') {
      this.closeConfirmModal();
      this.submitEditEvent();
    } else if (action === 'removeParticipant') {
      this.executeRemoveParticipant();
    }
  }
}
