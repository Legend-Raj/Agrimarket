import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, PointsStatsResponse } from '../../core/services/admin.service';
import { ParticipationService } from '../../core/services/participation.service';
import { Event as RewardEvent, getEventStatus } from '../../core/models/dashboard.models';
import { 
  ParticipantUserResponse, 
  SelectableParticipant, 
  BulkEarnWithTeamResponse,
  AllocationType,
  AllocatePointsRequest,
  BulkAllocatePointsRequest
} from '../../core/models/participation.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdminHeaderComponent } from '../../shared/components/admin-header/admin-header.component';

/**
 * Time period filter options
 */
type TimePeriod = 'all' | 'day' | 'month' | 'year';

/**
 * Interface for Allocate Points form (event-first workflow)
 */
interface AllocatePointsForm {
  eventId: string;
  userId: string;
  points: number | null;
}

/**
 * Interface for Bulk Allocate Points form with allocation type
 */
interface BulkAllocatePointsForm {
  eventId: string;
  userIds: string[];
  points: number | null;
  allocationType: AllocationType;
  teamName: string;
}

/**
 * Admin Points Page Component
 * 
 * Displays:
 * - Summary card with total points allocated (filterable by All/Day/Month/Year)
 * - Action cards: Allocate Points, Bulk Add Points
 * - Modals for single and bulk point allocation
 * 
 * Follows the same design patterns as other admin pages for consistency.
 */
@Component({
  selector: 'app-admin-points',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, AdminHeaderComponent],
  templateUrl: './admin-points.component.html',
  styleUrl: './admin-points.component.css'
})
export class AdminPointsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly participationService = inject(ParticipationService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly userSearchSubject = new Subject<string>();

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // Points Statistics
  readonly totalPointsAllocated = signal<number>(0);
  readonly totalTransactions = signal<number>(0);
  readonly timePeriod = signal<TimePeriod>('all');

  // UI State
  readonly isLoading = signal<boolean>(true);

  // Modal States
  readonly showAllocateModal = signal<boolean>(false);
  readonly showBulkAllocateModal = signal<boolean>(false);
  readonly showConfirmModal = signal<boolean>(false);

  // Allocate Points Form State (event-first workflow)
  readonly allocateForm = signal<AllocatePointsForm>({
    eventId: '',
    userId: '',
    points: null
  });
  readonly allocateErrors = signal<Record<string, string>>({});
  readonly isAllocating = signal<boolean>(false);
  readonly allocateSuccess = signal<string>('');

  // Bulk Allocate Form State (with allocation type)
  readonly bulkAllocateForm = signal<BulkAllocatePointsForm>({
    eventId: '',
    userIds: [],
    points: null,
    allocationType: 'Individual',
    teamName: ''
  });
  readonly bulkAllocateErrors = signal<Record<string, string>>({});
  readonly isBulkAllocating = signal<boolean>(false);
  readonly bulkAllocateSuccess = signal<string>('');

  // Participant Users State (loaded after event selection)
  readonly participantUsers = signal<ParticipantUserResponse[]>([]);
  readonly selectableParticipants = signal<SelectableParticipant[]>([]);
  readonly participantsLoading = signal<boolean>(false);
  readonly userSearchQuery = signal<string>('');

  // Event Selection State
  readonly completedEvents = signal<RewardEvent[]>([]);
  readonly eventSearchQuery = signal<string>('');
  readonly eventsLoading = signal<boolean>(false);

  // Confirm Modal State
  readonly confirmAction = signal<'allocate' | 'bulk-allocate' | null>(null);
  readonly confirmTitle = signal<string>('');
  readonly confirmMessage = signal<string>('');
  readonly isConfirmLoading = signal<boolean>(false);

  // Dropdown states for custom select
  readonly isEventDropdownOpen = signal<boolean>(false);
  readonly isUserDropdownOpen = signal<boolean>(false);
  readonly isBulkEventDropdownOpen = signal<boolean>(false);
  readonly isBulkUserDropdownOpen = signal<boolean>(false);

  // Allocation type options
  readonly allocationTypeOptions: { value: AllocationType; label: string; description: string }[] = [
    { value: 'Individual', label: 'Individual', description: 'Each user receives the full points amount' },
    { value: 'Total', label: 'Total', description: 'Points divided evenly among users' }
  ];

  // Computed values
  // Filter participants that haven't received points (for single allocation)
  readonly eligibleParticipants = computed(() => {
    return this.participantUsers().filter(p => !p.hasReceivedPoints);
  });

  // Filter participants by search query (for single allocation dropdown)
  readonly filteredParticipants = computed(() => {
    const query = this.userSearchQuery().toLowerCase().trim();
    const eligible = this.eligibleParticipants();
    if (!query) return eligible;
    
    return eligible.filter(user => 
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  readonly filteredEvents = computed(() => {
    const query = this.eventSearchQuery().toLowerCase().trim();
    if (!query) return this.completedEvents();
    
    return this.completedEvents().filter(event => 
      event.name.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query)
    );
  });

  // For bulk allocation - filter selectable participants by search
  readonly filteredSelectableParticipants = computed(() => {
    const query = this.userSearchQuery().toLowerCase().trim();
    const participants = this.selectableParticipants();
    if (!query) return participants;
    
    return participants.filter(user => 
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  // Count of selected users for bulk allocation
  readonly selectedUsersCount = computed(() => {
    return this.selectableParticipants().filter(u => u.selected).length;
  });

  // Check if all filtered participants are selected
  readonly allFilteredParticipantsSelected = computed(() => {
    const filtered = this.filteredSelectableParticipants();
    return filtered.length > 0 && filtered.every(u => u.selected);
  });

  // Get selected user name for single allocation display
  readonly selectedUserName = computed(() => {
    const form = this.allocateForm();
    if (!form.userId) return '';
    const user = this.participantUsers().find(u => u.userId === form.userId);
    return user ? user.fullName : '';
  });

  // Get selected event name for single allocation display
  readonly selectedEventName = computed(() => {
    const form = this.allocateForm();
    if (!form.eventId) return '';
    const event = this.completedEvents().find(e => e.id === form.eventId);
    return event ? event.name : '';
  });

  // Get selected event name for bulk allocation display
  readonly selectedBulkEventName = computed(() => {
    const form = this.bulkAllocateForm();
    if (!form.eventId) return '';
    const event = this.completedEvents().find(e => e.id === form.eventId);
    return event ? event.name : '';
  });

  // Calculate points per user for Total allocation type
  readonly pointsPerUserForTotal = computed(() => {
    const form = this.bulkAllocateForm();
    const selectedCount = this.selectedUsersCount();
    if (form.allocationType !== 'Total' || !form.points || selectedCount === 0) return null;
    return Math.floor(form.points / selectedCount);
  });

  // Check if total allocation is evenly divisible
  readonly divisibilityError = computed(() => {
    const form = this.bulkAllocateForm();
    const selectedCount = this.selectedUsersCount();
    if (form.allocationType !== 'Total' || !form.points || selectedCount === 0) return null;
    
    const remainder = form.points % selectedCount;
    if (remainder !== 0) {
      return `Points (${form.points}) must be evenly divisible by ${selectedCount} users. Remainder: ${remainder}`;
    }
    return null;
  });

  // Time period filter options
  readonly periodOptions: { value: TimePeriod; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: 'day', label: 'Today' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];

  ngOnInit(): void {
    this.loadData();
    this.setupUserSearchDebounce();
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
    else if (this.showAllocateModal()) this.closeAllocateModal();
    else if (this.showBulkAllocateModal()) this.closeBulkAllocateModal();
  }

  /**
   * Close custom dropdowns when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-container')) {
      this.isUserDropdownOpen.set(false);
      this.isEventDropdownOpen.set(false);
      this.isBulkUserDropdownOpen.set(false);
      this.isBulkEventDropdownOpen.set(false);
    }
  }

  /**
   * Setup debounced search
   */
  private setupUserSearchDebounce(): void {
    this.userSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.userSearchQuery.set(query);
    });
  }

  /**
   * Load initial data
   */
  private loadData(): void {
    this.isLoading.set(true);

    // Load points stats
    this.loadPointsStats();
  }

  /**
   * Load points statistics based on selected time period
   */
  private loadPointsStats(): void {
    this.adminService.getPointsStats(this.timePeriod())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats: PointsStatsResponse) => {
          this.totalPointsAllocated.set(stats.totalPointsAllocated);
          this.totalTransactions.set(stats.totalTransactions);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load points stats:', error);
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Load completed (ended) events for allocation modals
   */
  private loadCompletedEvents(): void {
    this.eventsLoading.set(true);

    this.adminService.getEvents(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events) => {
          // Filter only ended events (status = 'Ended' AND isActive = true)
          const completedEvents = events.filter(e => {
            const status = getEventStatus(e);
            return status === 'Ended' && e.isActive;
          });
          this.completedEvents.set(completedEvents);
          this.eventsLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load events:', error);
          this.eventsLoading.set(false);
        }
      });
  }

  /**
   * Load participant users for a specific event
   * This is called when an event is selected
   */
  private loadParticipantUsers(eventId: string): void {
    this.participantsLoading.set(true);
    this.participantUsers.set([]);
    this.selectableParticipants.set([]);

    this.participationService.getParticipantUsers(eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (participants) => {
          this.participantUsers.set(participants);
          // Create selectable participants for bulk allocation (all, including those who received points)
          this.selectableParticipants.set(participants.map(p => ({ ...p, selected: false })));
          this.participantsLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load participant users:', error);
          this.participantsLoading.set(false);
        }
      });
  }

  // ============================================
  // Helper Methods
  // ============================================

  formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }

  /**
   * Handle time period filter change
   */
  onPeriodChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.timePeriod.set(select.value as TimePeriod);
    this.loadPointsStats();
  }

  // ============================================
  // Allocate Points Modal (Event-First Workflow)
  // ============================================

  openAllocateModal(): void {
    this.resetAllocateForm();
    this.loadCompletedEvents();
    this.showAllocateModal.set(true);
  }

  closeAllocateModal(): void {
    this.showAllocateModal.set(false);
    this.resetAllocateForm();
  }

  private resetAllocateForm(): void {
    this.allocateForm.set({
      eventId: '',
      userId: '',
      points: null
    });
    this.allocateErrors.set({});
    this.allocateSuccess.set('');
    this.isAllocating.set(false);
    this.userSearchQuery.set('');
    this.eventSearchQuery.set('');
    this.isUserDropdownOpen.set(false);
    this.isEventDropdownOpen.set(false);
    this.participantUsers.set([]);
  }

  updateAllocateField(field: keyof AllocatePointsForm, value: string | number | null): void {
    this.allocateForm.update(form => ({ ...form, [field]: value }));
    this.allocateErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field];
      return newErrors;
    });

    // If event changed, load participants for that event
    if (field === 'eventId' && value) {
      this.loadParticipantUsers(value as string);
      // Clear user selection when event changes
      this.allocateForm.update(form => ({ ...form, userId: '' }));
    }
  }

  selectUser(userId: string): void {
    this.updateAllocateField('userId', userId);
    this.isUserDropdownOpen.set(false);
    this.userSearchQuery.set('');
  }

  selectEvent(eventId: string): void {
    this.updateAllocateField('eventId', eventId);
    this.isEventDropdownOpen.set(false);
    this.eventSearchQuery.set('');
  }

  toggleUserDropdown(event: MouseEvent): void {
    event.stopPropagation();
    // Only allow opening if event is selected
    if (!this.allocateForm().eventId) {
      this.allocateErrors.update(e => ({ ...e, userId: 'Please select an event first.' }));
      return;
    }
    this.isUserDropdownOpen.update(v => !v);
    this.isEventDropdownOpen.set(false);
  }

  toggleEventDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isEventDropdownOpen.update(v => !v);
    this.isUserDropdownOpen.set(false);
  }

  onUserSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.userSearchSubject.next(input.value);
  }

  onEventSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.eventSearchQuery.set(input.value);
  }

  validateAllocateForm(): boolean {
    const form = this.allocateForm();
    const errors: Record<string, string> = {};

    if (!form.eventId) {
      errors['eventId'] = 'Please select an event.';
    }

    if (!form.userId) {
      errors['userId'] = 'Please select a participant.';
    }

    if (form.points === null || form.points === undefined) {
      errors['points'] = 'Points are required.';
    } else if (form.points <= 0) {
      errors['points'] = 'Points must be greater than zero.';
    } else if (!Number.isInteger(form.points)) {
      errors['points'] = 'Points must be a whole number.';
    } else if (form.points > 1000000) {
      errors['points'] = 'You cannot allocate more than 1,000,000 points at once.';
    }

    this.allocateErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  confirmAllocate(): void {
    if (!this.validateAllocateForm()) return;

    const form = this.allocateForm();
    const user = this.participantUsers().find(u => u.userId === form.userId);
    const event = this.completedEvents().find(e => e.id === form.eventId);

    this.confirmAction.set('allocate');
    this.confirmTitle.set('Confirm Point Allocation');
    this.confirmMessage.set(
      `Are you sure you want to allocate ${this.formatNumber(form.points!)} points to ${user?.fullName} for event "${event?.name}"?`
    );
    this.showConfirmModal.set(true);
  }

  // ============================================
  // Bulk Allocate Points Modal (Event-First Workflow with Allocation Type)
  // ============================================

  openBulkAllocateModal(): void {
    this.resetBulkAllocateForm();
    this.loadCompletedEvents();
    this.showBulkAllocateModal.set(true);
  }

  closeBulkAllocateModal(): void {
    this.showBulkAllocateModal.set(false);
    this.resetBulkAllocateForm();
  }

  private resetBulkAllocateForm(): void {
    this.bulkAllocateForm.set({
      eventId: '',
      userIds: [],
      points: null,
      allocationType: 'Individual',
      teamName: ''
    });
    this.bulkAllocateErrors.set({});
    this.bulkAllocateSuccess.set('');
    this.isBulkAllocating.set(false);
    this.userSearchQuery.set('');
    this.eventSearchQuery.set('');
    this.isBulkUserDropdownOpen.set(false);
    this.isBulkEventDropdownOpen.set(false);
    this.selectableParticipants.set([]);
  }

  updateBulkAllocateField(field: keyof BulkAllocatePointsForm, value: string | string[] | number | AllocationType | null): void {
    this.bulkAllocateForm.update(form => ({ ...form, [field]: value }));
    this.bulkAllocateErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field];
      return newErrors;
    });

    // If event changed, load participants for that event
    if (field === 'eventId' && value) {
      this.loadParticipantUsersForBulk(value as string);
      // Clear user selections when event changes
      this.bulkAllocateForm.update(form => ({ ...form, userIds: [] }));
    }
  }

  /**
   * Load participant users for bulk allocation (includes those who already received points, with indicator)
   */
  private loadParticipantUsersForBulk(eventId: string): void {
    this.participantsLoading.set(true);
    this.selectableParticipants.set([]);

    this.participationService.getParticipantUsers(eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (participants) => {
          this.selectableParticipants.set(participants.map(p => ({ ...p, selected: false })));
          this.participantsLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load participant users:', error);
          this.participantsLoading.set(false);
        }
      });
  }

  toggleParticipantSelection(userId: string): void {
    this.selectableParticipants.update(participants => 
      participants.map(p => p.userId === userId ? { ...p, selected: !p.selected } : p)
    );
    // Update form with selected user IDs
    const selectedIds = this.selectableParticipants().filter(p => p.selected).map(p => p.userId);
    this.updateBulkAllocateField('userIds', selectedIds);
  }

  selectAllParticipants(): void {
    const filtered = this.filteredSelectableParticipants();
    const allSelected = filtered.every(p => p.selected);
    
    this.selectableParticipants.update(participants => 
      participants.map(p => {
        const isFiltered = filtered.some(fp => fp.userId === p.userId);
        return isFiltered ? { ...p, selected: !allSelected } : p;
      })
    );
    
    const selectedIds = this.selectableParticipants().filter(p => p.selected).map(p => p.userId);
    this.updateBulkAllocateField('userIds', selectedIds);
  }

  selectBulkEvent(eventId: string): void {
    this.updateBulkAllocateField('eventId', eventId);
    this.isBulkEventDropdownOpen.set(false);
    this.eventSearchQuery.set('');
  }

  toggleBulkUserDropdown(event: MouseEvent): void {
    event.stopPropagation();
    // Only allow opening if event is selected
    if (!this.bulkAllocateForm().eventId) {
      this.bulkAllocateErrors.update(e => ({ ...e, userIds: 'Please select an event first.' }));
      return;
    }
    this.isBulkUserDropdownOpen.update(v => !v);
    this.isBulkEventDropdownOpen.set(false);
  }

  toggleBulkEventDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isBulkEventDropdownOpen.update(v => !v);
    this.isBulkUserDropdownOpen.set(false);
  }

  validateBulkAllocateForm(): boolean {
    const form = this.bulkAllocateForm();
    const errors: Record<string, string> = {};

    if (!form.eventId) {
      errors['eventId'] = 'Please select an event.';
    }

    const selectedParticipants = this.selectableParticipants().filter(p => p.selected);
    if (selectedParticipants.length === 0) {
      errors['userIds'] = 'Please select at least one participant.';
    }

    if (form.points === null || form.points === undefined) {
      errors['points'] = 'Points are required.';
    } else if (form.points <= 0) {
      errors['points'] = 'Points must be greater than zero.';
    } else if (!Number.isInteger(form.points)) {
      errors['points'] = 'Points must be a whole number.';
    } else if (form.points > 1000000) {
      errors['points'] = 'You cannot allocate more than 1,000,000 points at once.';
    } else if (form.allocationType === 'Total' && selectedParticipants.length > 0) {
      // Check divisibility for Total allocation
      if (form.points % selectedParticipants.length !== 0) {
        errors['points'] = `Points (${form.points}) must be evenly divisible by ${selectedParticipants.length} participants.`;
      }
    }

    this.bulkAllocateErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  confirmBulkAllocate(): void {
    if (!this.validateBulkAllocateForm()) return;

    const form = this.bulkAllocateForm();
    const selectedParticipants = this.selectableParticipants().filter(p => p.selected);
    const event = this.completedEvents().find(e => e.id === form.eventId);

    let pointsDescription: string;
    if (form.allocationType === 'Total') {
      const pointsPerUser = form.points! / selectedParticipants.length;
      pointsDescription = `${this.formatNumber(form.points!)} total points (${this.formatNumber(pointsPerUser)} each)`;
    } else {
      pointsDescription = `${this.formatNumber(form.points!)} points each`;
    }

    this.confirmAction.set('bulk-allocate');
    this.confirmTitle.set('Confirm Bulk Point Allocation');
    this.confirmMessage.set(
      `Are you sure you want to allocate ${pointsDescription} to ${selectedParticipants.length} participant(s) for event "${event?.name}"?` +
      (form.teamName ? ` Team: ${form.teamName}` : '')
    );
    this.showConfirmModal.set(true);
  }

  // ============================================
  // Confirmation Modal
  // ============================================

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
    this.confirmTitle.set('');
    this.confirmMessage.set('');
    this.isConfirmLoading.set(false);
  }

  executeConfirmedAction(): void {
    const action = this.confirmAction();
    
    if (action === 'allocate') {
      this.submitAllocatePoints();
    } else if (action === 'bulk-allocate') {
      this.submitBulkAllocatePoints();
    }
  }

  private submitAllocatePoints(): void {
    const form = this.allocateForm();
    this.isConfirmLoading.set(true);
    this.isAllocating.set(true);

    const request: AllocatePointsRequest = {
      eventId: form.eventId,
      userId: form.userId,
      points: form.points!
    };

    this.participationService.allocatePointsToParticipant(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: BulkEarnWithTeamResponse) => {
          this.closeConfirmModal();
          this.isAllocating.set(false);
          
          if (response.failureCount === 0) {
            this.allocateSuccess.set(`Successfully allocated ${this.formatNumber(response.totalPointsAwarded)} points!`);
          } else {
            this.allocateErrors.set({
              general: `Allocation failed: ${response.errors.join(', ')}`
            });
          }
          
          // Refresh stats
          this.loadPointsStats();
          
          // Close modal after a delay if successful
          if (response.failureCount === 0) {
            setTimeout(() => {
              this.closeAllocateModal();
            }, 1500);
          }
        },
        error: (error) => {
          this.closeConfirmModal();
          this.isAllocating.set(false);
          const errorMessage = error.error?.message || error.error?.title || 'Failed to allocate points. Please try again.';
          this.allocateErrors.set({ general: errorMessage });
        }
      });
  }

  private submitBulkAllocatePoints(): void {
    const form = this.bulkAllocateForm();
    const selectedUserIds = this.selectableParticipants().filter(p => p.selected).map(p => p.userId);
    
    this.isConfirmLoading.set(true);
    this.isBulkAllocating.set(true);

    const request: BulkAllocatePointsRequest = {
      eventId: form.eventId,
      userIds: selectedUserIds,
      points: form.points!,
      allocationType: form.allocationType,
      teamName: form.teamName || null
    };

    this.participationService.bulkAllocatePointsToParticipants(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: BulkEarnWithTeamResponse) => {
          this.closeConfirmModal();
          this.isBulkAllocating.set(false);
          
          if (response.failureCount === 0) {
            this.bulkAllocateSuccess.set(
              `Successfully allocated ${this.formatNumber(response.totalPointsAwarded)} points to ${response.successCount} participant(s)!`
            );
          } else if (response.successCount > 0) {
            this.bulkAllocateErrors.set({
              general: `Partial success. ${response.successCount} allocated, ${response.failureCount} failed: ${response.errors.join(', ')}`
            });
          } else {
            this.bulkAllocateErrors.set({
              general: `Allocation failed: ${response.errors.join(', ')}`
            });
          }
          
          // Refresh stats
          this.loadPointsStats();
          
          // Close modal after a delay if fully successful
          if (response.failureCount === 0) {
            setTimeout(() => {
              this.closeBulkAllocateModal();
            }, 1500);
          }
        },
        error: (error) => {
          this.closeConfirmModal();
          this.isBulkAllocating.set(false);
          const errorMessage = error.error?.message || error.error?.title || 'Failed to allocate points. Please try again.';
          this.bulkAllocateErrors.set({ general: errorMessage });
        }
      });
  }

  /**
   * Get period label for display
   */
  getPeriodLabel(): string {
    const period = this.timePeriod();
    switch (period) {
      case 'day': return 'Today';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  }
}
