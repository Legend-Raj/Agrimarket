import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, RedemptionRequestResponse } from '../../core/services/admin.service';
import { PagedResponse } from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdminHeaderComponent } from '../../shared/components/admin-header/admin-header.component';

/**
 * Redemption Request Status Type
 */
type RedemptionStatus = 'Pending' | 'Approved' | 'Delivered' | 'Rejected' | 'Canceled';

/**
 * Available admin actions for each status
 */
type AdminAction = 'approve' | 'deliver' | 'reject' | 'cancel';

/**
 * Extended redemption request with UI state
 */
interface RedemptionRequestWithUI extends RedemptionRequestResponse {
  id: string; // Alias for requestId for easier access
  selectedAction: AdminAction | null;
  isUpdating: boolean;
  updateError: string | null;
  updateSuccess: boolean;
}

/**
 * Admin Redemption Requests Page Component
 * 
 * Displays all redemption requests with status-based actions.
 * Admin can approve, deliver, reject, or cancel requests based on current status.
 * 
 * Status Transition Rules:
 * - Pending → Approve, Reject, Cancel
 * - Approved → Deliver, Reject
 * - Delivered, Rejected, Canceled → No actions (terminal states)
 */
@Component({
  selector: 'app-admin-redemptions',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, AdminHeaderComponent],
  templateUrl: './admin-redemptions.component.html',
  styleUrl: './admin-redemptions.component.css'
})
export class AdminRedemptionsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // Dashboard Statistics
  readonly totalRequests = signal<number>(0);
  readonly pendingCount = signal<number>(0);
  readonly approvedCount = signal<number>(0);
  readonly deliveredCount = signal<number>(0);

  // UI State
  readonly isLoading = signal<boolean>(true);

  // Requests List State
  readonly requests = signal<RedemptionRequestWithUI[]>([]);
  readonly requestsLoading = signal<boolean>(false);
  readonly currentPage = signal<number>(1);
  readonly pageSize = 20;
  readonly statusFilter = signal<RedemptionStatus | 'All'>('All');

  // Confirmation Modal State
  readonly showConfirmModal = signal<boolean>(false);
  readonly confirmAction = signal<AdminAction | null>(null);
  readonly confirmRequest = signal<RedemptionRequestWithUI | null>(null);

  // Computed values
  readonly totalPages = computed(() => {
    return Math.ceil(this.totalRequests() / this.pageSize);
  });

  readonly filteredRequests = computed(() => {
    const filter = this.statusFilter();
    if (filter === 'All') return this.requests();
    return this.requests().filter(r => r.status === filter);
  });

  // Status filter options
  readonly statusOptions: (RedemptionStatus | 'All')[] = [
    'All', 'Pending', 'Approved', 'Delivered', 'Rejected', 'Canceled'
  ];

  ngOnInit(): void {
    this.loadData();
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
  }

  /**
   * Load initial data
   */
  private loadData(): void {
    this.isLoading.set(true);

    // Load redemption requests
    this.loadRequests();
    this.loadStats();
  }

  /**
   * Load redemption requests
   */
  loadRequests(): void {
    this.requestsLoading.set(true);
    const skip = (this.currentPage() - 1) * this.pageSize;
    const filter = this.statusFilter();
    const status = filter === 'All' ? undefined : filter;

    this.adminService.getRedemptionRequests(skip, this.pageSize, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PagedResponse<RedemptionRequestResponse>) => {
          const requestsWithUI: RedemptionRequestWithUI[] = response.items.map(r => ({
            ...r,
            id: r.requestId, // Map requestId to id for convenience
            selectedAction: null,
            isUpdating: false,
            updateError: null,
            updateSuccess: false
          }));
          this.requests.set(requestsWithUI);
          this.totalRequests.set(response.totalCount);
          this.requestsLoading.set(false);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load requests:', error);
          this.requestsLoading.set(false);
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Load statistics for summary cards
   */
  private loadStats(): void {
    // Load pending count
    this.adminService.getRedemptionRequests(0, 1, 'Pending')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => this.pendingCount.set(response.totalCount),
        error: () => this.pendingCount.set(0)
      });

    // Load approved count
    this.adminService.getRedemptionRequests(0, 1, 'Approved')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => this.approvedCount.set(response.totalCount),
        error: () => this.approvedCount.set(0)
      });

    // Load delivered count
    this.adminService.getRedemptionRequests(0, 1, 'Delivered')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => this.deliveredCount.set(response.totalCount),
        error: () => this.deliveredCount.set(0)
      });
  }

  // ============================================
  // Status-Based Action Rules
  // ============================================

  /**
   * Get available actions for a given status
   * This implements the business rules for status transitions
   */
  getAvailableActions(status: RedemptionStatus): AdminAction[] {
    switch (status) {
      case 'Pending':
        return ['approve', 'reject', 'cancel'];
      case 'Approved':
        return ['deliver', 'reject'];
      case 'Delivered':
      case 'Rejected':
      case 'Canceled':
        return []; // Terminal states - no actions available
      default:
        return [];
    }
  }

  /**
   * Check if a request can have actions performed
   */
  canTakeAction(request: RedemptionRequestWithUI): boolean {
    return this.getAvailableActions(request.status).length > 0;
  }

  /**
   * Get human-readable action label
   */
  getActionLabel(action: AdminAction): string {
    switch (action) {
      case 'approve': return 'Approve';
      case 'deliver': return 'Deliver';
      case 'reject': return 'Reject';
      case 'cancel': return 'Cancel';
      default: return action;
    }
  }

  /**
   * Get action description for confirmation
   */
  getActionDescription(action: AdminAction): string {
    switch (action) {
      case 'approve': 
        return 'This will approve the redemption request. The user\'s points will remain locked until delivery.';
      case 'deliver': 
        return 'This will mark the request as delivered. Points will be permanently deducted and product stock will decrease.';
      case 'reject': 
        return 'This will reject the redemption request. The user\'s locked points will be released back to their available balance.';
      case 'cancel': 
        return 'This will cancel the redemption request. The user\'s locked points will be released back to their available balance.';
      default: 
        return '';
    }
  }

  // ============================================
  // Action Handlers
  // ============================================

  /**
   * Select an action for a request (shows in dropdown)
   */
  selectAction(request: RedemptionRequestWithUI, action: AdminAction): void {
    this.requests.update(requests =>
      requests.map(r => 
        r.id === request.id 
          ? { ...r, selectedAction: action, updateError: null, updateSuccess: false }
          : r
      )
    );
  }

  /**
   * Open confirmation modal before applying action
   */
  confirmActionForRequest(request: RedemptionRequestWithUI): void {
    if (!request.selectedAction) return;
    
    this.confirmAction.set(request.selectedAction);
    this.confirmRequest.set(request);
    this.showConfirmModal.set(true);
  }

  /**
   * Close confirmation modal
   */
  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
    this.confirmRequest.set(null);
  }

  /**
   * Execute the confirmed action
   */
  executeAction(): void {
    const request = this.confirmRequest();
    const action = this.confirmAction();
    
    if (!request || !action) return;

    // Mark as updating
    this.requests.update(requests =>
      requests.map(r => 
        r.id === request.id 
          ? { ...r, isUpdating: true, updateError: null, updateSuccess: false }
          : r
      )
    );

    this.closeConfirmModal();

    // Call appropriate API
    let apiCall$;
    switch (action) {
      case 'approve':
        apiCall$ = this.adminService.approveRedemptionRequest(request.id);
        break;
      case 'deliver':
        apiCall$ = this.adminService.deliverRedemptionRequest(request.id);
        break;
      case 'reject':
        apiCall$ = this.adminService.rejectRedemptionRequest(request.id);
        break;
      case 'cancel':
        apiCall$ = this.adminService.cancelRedemptionRequest(request.id);
        break;
      default:
        return;
    }

    apiCall$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        // Update status in local state
        const newStatus = this.getNewStatus(action);
        this.requests.update(requests =>
          requests.map(r => 
            r.id === request.id 
              ? { 
                  ...r, 
                  status: newStatus,
                  selectedAction: null,
                  isUpdating: false, 
                  updateError: null,
                  updateSuccess: true 
                }
              : r
          )
        );

        // Update stats
        this.loadStats();

        // Clear success message after delay
        setTimeout(() => {
          this.requests.update(requests =>
            requests.map(r => 
              r.id === request.id 
                ? { ...r, updateSuccess: false }
                : r
            )
          );
        }, 3000);
      },
      error: (error) => {
        const errorMessage = error.error?.message || error.error?.error || 'Failed to update request. Please try again.';
        this.requests.update(requests =>
          requests.map(r => 
            r.id === request.id 
              ? { ...r, isUpdating: false, updateError: errorMessage, selectedAction: null }
              : r
          )
        );
      }
    });
  }

  /**
   * Get new status after action
   */
  private getNewStatus(action: AdminAction): RedemptionStatus {
    switch (action) {
      case 'approve': return 'Approved';
      case 'deliver': return 'Delivered';
      case 'reject': return 'Rejected';
      case 'cancel': return 'Canceled';
      default: return 'Pending';
    }
  }

  /**
   * Clear error for a request
   */
  clearError(request: RedemptionRequestWithUI): void {
    this.requests.update(requests =>
      requests.map(r => 
        r.id === request.id 
          ? { ...r, updateError: null }
          : r
      )
    );
  }

  // ============================================
  // Filter & Pagination
  // ============================================

  /**
   * Change status filter
   */
  onFilterChange(status: RedemptionStatus | 'All'): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadRequests();
  }

  /**
   * Go to page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadRequests();
    }
  }

  // ============================================
  // Formatting Helpers
  // ============================================

  formatPoints(points: number): string {
    return points.toLocaleString('en-US');
  }

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
   * Get last updated timestamp - uses requestedAt since admin response doesn't include approval/delivery timestamps
   */
  getLastUpdated(request: RedemptionRequestResponse): string {
    return this.formatDate(request.requestedAt);
  }

  /**
   * Get status CSS class
   */
  getStatusClass(status: RedemptionStatus): string {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'Approved': return 'status-approved';
      case 'Delivered': return 'status-delivered';
      case 'Rejected': return 'status-rejected';
      case 'Canceled': return 'status-canceled';
      default: return '';
    }
  }

  /**
   * Get action button CSS class
   */
  getActionButtonClass(action: AdminAction): string {
    switch (action) {
      case 'approve': return 'btn-action-approve';
      case 'deliver': return 'btn-action-deliver';
      case 'reject': return 'btn-action-reject';
      case 'cancel': return 'btn-action-cancel';
      default: return '';
    }
  }
}
