import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { 
  UserResponse, 
  PagedResponse, 
  TopEmployee,
  Event as RewardEvent,
  normalizeLedgerType
} from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdminHeaderComponent } from '../../shared/components/admin-header/admin-header.component';

/**
 * Interface for Create User form
 */
interface CreateUserForm {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  employeeId: string;
  password: string;
  confirmPassword: string;
}

/**
 * Interface for Edit User form
 */
interface EditUserForm {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  employeeId: string;
  isActive: boolean;
}

/**
 * Interface for User Transaction History display
 */
interface UserTransactionEntry {
  id: string;
  type: string;
  points: number;
  timestamp: string;
  eventId: string | null;
  eventName: string;
}

/**
 * Admin Users Page Component
 * 
 * Displays:
 * - Summary card with total users count
 * - Action cards: Add User, Get User Details, Top 3 Users
 * - Modals for each action with proper forms and validation
 * 
 * Follows the wireframe design exactly.
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, AdminHeaderComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css'
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // Dashboard Statistics
  readonly totalUsers = signal<number>(0);

  // UI State
  readonly isLoading = signal<boolean>(true);

  // Modal States
  readonly showAddUserModal = signal<boolean>(false);
  readonly showUserListModal = signal<boolean>(false);
  readonly showEditUserModal = signal<boolean>(false);
  readonly showTopUsersModal = signal<boolean>(false);
  readonly showUserHistoryModal = signal<boolean>(false);

  // Add User Form State
  readonly addUserForm = signal<CreateUserForm>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    employeeId: '',
    password: '',
    confirmPassword: ''
  });
  readonly addUserErrors = signal<Record<string, string>>({});
  readonly isAddingUser = signal<boolean>(false);
  readonly addUserSuccess = signal<string>('');

  // User List State
  readonly userList = signal<UserResponse[]>([]);
  readonly userListTotal = signal<number>(0);
  readonly userListLoading = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly currentPage = signal<number>(1);
  readonly pageSize = 10;

  // Edit User State
  readonly selectedUser = signal<UserResponse | null>(null);
  readonly editUserForm = signal<EditUserForm>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    employeeId: '',
    isActive: true
  });
  readonly editUserErrors = signal<Record<string, string>>({});
  readonly isUpdatingUser = signal<boolean>(false);
  readonly editUserSuccess = signal<string>('');

  // Top 3 Users State
  readonly topUsers = signal<TopEmployee[]>([]);
  readonly topUsersLoading = signal<boolean>(false);

  // User Transaction History State
  readonly historyUser = signal<UserResponse | null>(null);
  readonly userTransactions = signal<UserTransactionEntry[]>([]);
  readonly userHistoryLoading = signal<boolean>(false);
  readonly userHistoryTotal = signal<number>(0);
  readonly userHistoryPage = signal<number>(1);
  readonly userHistoryPageSize = 10;
  private eventsCache = signal<Map<string, RewardEvent>>(new Map());

  // Computed values
  readonly totalPages = computed(() => {
    return Math.ceil(this.userListTotal() / this.pageSize);
  });

  readonly userHistoryTotalPages = computed(() => {
    return Math.ceil(this.userHistoryTotal() / this.userHistoryPageSize);
  });

  // User list is now filtered server-side via the search API parameter.
  // This computed simply returns the loaded list from the API response.
  readonly filteredUserList = computed(() => this.userList());

  /**
   * Check if the currently selected user (being edited) is the logged-in admin
   * Used to prevent self-deactivation
   */
  readonly isEditingSelf = computed(() => {
    const selectedUser = this.selectedUser();
    const currentUser = this.authService.user();
    if (!selectedUser || !currentUser) return false;
    return selectedUser.id === currentUser.id;
  });

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
    if (this.showAddUserModal()) this.closeAddUserModal();
    if (this.showUserListModal()) this.closeUserListModal();
    if (this.showEditUserModal()) this.closeEditUserModal();
    if (this.showTopUsersModal()) this.closeTopUsersModal();
    if (this.showUserHistoryModal()) this.closeUserHistoryModal();
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
      this.currentPage.set(1);
      this.loadUserList();
    });
  }

  /**
   * Load initial data
   */
  private loadData(): void {
    this.isLoading.set(true);

    // Load total users count
    this.adminService.getTotalUserCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (count) => {
          this.totalUsers.set(count);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load total users:', error);
          this.isLoading.set(false);
        }
      });
  }

  // ============================================
  // Helper Methods
  // ============================================

  formatPoints(points: number): string {
    return points.toLocaleString('en-US');
  }

  // ============================================
  // Add User Modal
  // ============================================

  openAddUserModal(): void {
    this.resetAddUserForm();
    this.showAddUserModal.set(true);
  }

  closeAddUserModal(): void {
    this.showAddUserModal.set(false);
    this.resetAddUserForm();
  }

  private resetAddUserForm(): void {
    this.addUserForm.set({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      employeeId: '',
      password: '',
      confirmPassword: ''
    });
    this.addUserErrors.set({});
    this.addUserSuccess.set('');
    this.isAddingUser.set(false);
  }

  updateAddUserField(field: keyof CreateUserForm, value: string): void {
    this.addUserForm.update(form => ({ ...form, [field]: value }));
    // Clear error for this field when user starts typing
    this.addUserErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field];
      return newErrors;
    });
  }

  validateAddUserForm(): boolean {
    const form = this.addUserForm();
    const errors: Record<string, string> = {};

    if (!form.firstName.trim()) {
      errors['firstName'] = 'First name is required.';
    } else if (form.firstName.length > 100) {
      errors['firstName'] = 'First name is too long.';
    }

    if (!form.lastName.trim()) {
      errors['lastName'] = 'Last name is required.';
    } else if (form.lastName.length > 100) {
      errors['lastName'] = 'Last name is too long.';
    }

    if (!form.email.trim()) {
      errors['email'] = 'Email is required.';
    } else if (!/^[^\s@]+@agdata\.com$/i.test(form.email)) {
      errors['email'] = 'Only @agdata.com email addresses are allowed.';
    }

    if (!form.employeeId.trim()) {
      errors['employeeId'] = 'Employee ID is required.';
    } else if (!/^[A-Za-z]{3}-\d+$/.test(form.employeeId)) {
      errors['employeeId'] = 'Employee ID must be in format: XXX-000 (e.g., ABC-123).';
    }

    if (!form.password) {
      errors['password'] = 'Password is required.';
    } else if (form.password.length < 8) {
      errors['password'] = 'Password must be at least 8 characters.';
    }

    if (form.password !== form.confirmPassword) {
      errors['confirmPassword'] = 'Passwords do not match.';
    }

    this.addUserErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  submitAddUser(): void {
    if (!this.validateAddUserForm()) return;

    this.isAddingUser.set(true);
    this.addUserErrors.set({});
    this.addUserSuccess.set('');

    const form = this.addUserForm();
    const request = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      employeeId: form.employeeId.trim().toUpperCase(),
      password: form.password
    };

    this.adminService.createUser(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.addUserSuccess.set(`User "${user.firstName} ${user.lastName}" created successfully!`);
          this.isAddingUser.set(false);
          // Update total users count
          this.totalUsers.update(count => count + 1);
          // Close modal after 1.5 seconds
          setTimeout(() => {
            this.closeAddUserModal();
          }, 1500);
        },
        error: (error) => {
          this.isAddingUser.set(false);
          if (error.error?.errors) {
            // Handle validation errors from backend
            const backendErrors: Record<string, string> = {};
            for (const [key, messages] of Object.entries(error.error.errors)) {
              backendErrors[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
            }
            this.addUserErrors.set(backendErrors);
          } else {
            this.addUserErrors.set({ general: error.error?.message || 'Failed to create user. Please try again.' });
          }
        }
      });
  }

  // ============================================
  // User List Modal
  // ============================================

  openUserListModal(): void {
    this.showUserListModal.set(true);
    this.loadUserList();
  }

  closeUserListModal(): void {
    this.showUserListModal.set(false);
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.userList.set([]);
  }

  loadUserList(): void {
    this.userListLoading.set(true);
    const skip = (this.currentPage() - 1) * this.pageSize;
    const search = this.searchQuery().trim() || undefined;

    this.adminService.getUsers(skip, this.pageSize, 'all', search)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PagedResponse<UserResponse>) => {
          this.userList.set(response.items);
          this.userListTotal.set(response.totalCount);
          this.userListLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load users:', error);
          this.userListLoading.set(false);
        }
      });
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadUserList();
    }
  }

  // ============================================
  // Edit User Modal
  // ============================================

  openEditUserModal(user: UserResponse): void {
    this.selectedUser.set(user);
    this.editUserForm.set({
      firstName: user.firstName,
      middleName: user.middleName || '',
      lastName: user.lastName,
      email: user.email,
      employeeId: user.employeeId,
      isActive: user.isActive
    });
    this.editUserErrors.set({});
    this.editUserSuccess.set('');
    this.showEditUserModal.set(true);
  }

  closeEditUserModal(): void {
    this.showEditUserModal.set(false);
    this.selectedUser.set(null);
    this.editUserErrors.set({});
    this.editUserSuccess.set('');
  }

  updateEditUserField(field: keyof EditUserForm, value: string | boolean): void {
    this.editUserForm.update(form => ({ ...form, [field]: value }));
    this.editUserErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field];
      return newErrors;
    });
  }

  validateEditUserForm(): boolean {
    const form = this.editUserForm();
    const errors: Record<string, string> = {};

    if (!form.firstName.trim()) {
      errors['firstName'] = 'First name is required.';
    } else if (form.firstName.length > 100) {
      errors['firstName'] = 'First name is too long.';
    }

    if (!form.lastName.trim()) {
      errors['lastName'] = 'Last name is required.';
    } else if (form.lastName.length > 100) {
      errors['lastName'] = 'Last name is too long.';
    }

    if (!form.email.trim()) {
      errors['email'] = 'Email is required.';
    } else if (!/^[^\s@]+@agdata\.com$/i.test(form.email)) {
      errors['email'] = 'Only @agdata.com email addresses are allowed.';
    }

    if (!form.employeeId.trim()) {
      errors['employeeId'] = 'Employee ID is required.';
    } else if (!/^[A-Za-z]{3}-\d+$/.test(form.employeeId)) {
      errors['employeeId'] = 'Employee ID must be in format: XXX-000 (e.g., ABC-123).';
    }

    this.editUserErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  submitEditUser(): void {
    if (!this.validateEditUserForm()) return;
    
    const user = this.selectedUser();
    if (!user) return;

    this.isUpdatingUser.set(true);
    this.editUserErrors.set({});
    this.editUserSuccess.set('');

    const form = this.editUserForm();
    const request: Record<string, unknown> = {};

    // Only include fields that have changed
    if (form.firstName.trim() !== user.firstName) {
      request['firstName'] = form.firstName.trim();
    }
    if ((form.middleName.trim() || null) !== user.middleName) {
      request['middleName'] = form.middleName.trim() || null;
    }
    if (form.lastName.trim() !== user.lastName) {
      request['lastName'] = form.lastName.trim();
    }
    if (form.email.trim() !== user.email) {
      request['email'] = form.email.trim();
    }
    if (form.employeeId.trim().toUpperCase() !== user.employeeId) {
      request['employeeId'] = form.employeeId.trim().toUpperCase();
    }
    if (form.isActive !== user.isActive) {
      request['isActive'] = form.isActive;
    }

    if (Object.keys(request).length === 0) {
      this.editUserErrors.set({ general: 'No changes detected.' });
      this.isUpdatingUser.set(false);
      return;
    }

    this.adminService.updateUser(user.id, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedUser) => {
          this.editUserSuccess.set('User updated successfully!');
          this.isUpdatingUser.set(false);
          // Update the user in the list
          this.userList.update(users => 
            users.map(u => u.id === updatedUser.id ? updatedUser : u)
          );
          // Close modal after 1.5 seconds
          setTimeout(() => {
            this.closeEditUserModal();
          }, 1500);
        },
        error: (error) => {
          this.isUpdatingUser.set(false);
          if (error.error?.errors) {
            const backendErrors: Record<string, string> = {};
            for (const [key, messages] of Object.entries(error.error.errors)) {
              backendErrors[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
            }
            this.editUserErrors.set(backendErrors);
          } else {
            this.editUserErrors.set({ general: error.error?.message || 'Failed to update user. Please try again.' });
          }
        }
      });
  }

  // ============================================
  // Top 3 Users Modal
  // ============================================

  openTopUsersModal(): void {
    this.showTopUsersModal.set(true);
    this.loadTopUsers();
  }

  closeTopUsersModal(): void {
    this.showTopUsersModal.set(false);
    this.topUsers.set([]);
  }

  loadTopUsers(): void {
    this.topUsersLoading.set(true);

    this.dashboardService.getTopEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.topUsers.set(users);
          this.topUsersLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load top users:', error);
          this.topUsersLoading.set(false);
        }
      });
  }

  getRankClass(index: number): string {
    switch (index) {
      case 0: return 'rank-gold';
      case 1: return 'rank-silver';
      case 2: return 'rank-bronze';
      default: return '';
    }
  }

  getRankIcon(index: number): string {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  }

  // ============================================
  // User Transaction History Modal
  // ============================================

  /**
   * Open the user transaction history modal for a specific user.
   * Fetches the user's complete points transaction history.
   * @param user - The user whose history to view
   */
  openUserHistoryModal(user: UserResponse): void {
    this.historyUser.set(user);
    this.userHistoryPage.set(1);
    this.showUserHistoryModal.set(true);
    this.loadUserTransactionHistory();
  }

  /**
   * Close the user transaction history modal and reset state.
   */
  closeUserHistoryModal(): void {
    this.showUserHistoryModal.set(false);
    this.historyUser.set(null);
    this.userTransactions.set([]);
    this.userHistoryTotal.set(0);
    this.userHistoryPage.set(1);
  }

  /**
   * Load the transaction history for the selected user.
   * Fetches both transaction data and events for displaying event names.
   */
  loadUserTransactionHistory(): void {
    const user = this.historyUser();
    if (!user) return;

    this.userHistoryLoading.set(true);
    const skip = (this.userHistoryPage() - 1) * this.userHistoryPageSize;

    // Fetch transactions and events in parallel for efficiency
    forkJoin({
      transactions: this.adminService.getUserTransactionHistory(
        user.id,
        skip,
        this.userHistoryPageSize
      ).pipe(
        catchError(error => {
          console.error('Failed to load user transactions:', error);
          return of({ items: [], totalCount: 0, skip: 0, take: this.userHistoryPageSize });
        })
      ),
      events: this.eventsCache().size === 0
        ? this.adminService.getAllEvents(false).pipe(
            catchError(() => of([]))
          )
        : of(null) // Use cached events if available
    }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ transactions, events }) => {
        // Cache events if newly fetched
        if (events) {
          const eventsMap = new Map<string, RewardEvent>();
          events.forEach(event => eventsMap.set(event.id, event));
          this.eventsCache.set(eventsMap);
        }

        // Transform ledger entries to display format
        const displayTransactions: UserTransactionEntry[] = transactions.items.map(entry => ({
          id: entry.id,
          type: normalizeLedgerType(entry.type),
          points: entry.points,
          timestamp: entry.timestamp,
          eventId: entry.eventId,
          eventName: entry.eventId 
            ? (this.eventsCache().get(entry.eventId)?.name || 'Event') 
            : 'Product redeemption'
        }));

        this.userTransactions.set(displayTransactions);
        this.userHistoryTotal.set(transactions.totalCount);
        this.userHistoryLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load user transaction history:', error);
        this.userHistoryLoading.set(false);
      }
    });
  }

  /**
   * Navigate to a specific page in the user history modal.
   * @param page - The page number to navigate to
   */
  goToHistoryPage(page: number): void {
    const totalPages = this.userHistoryTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.userHistoryPage.set(page);
      this.loadUserTransactionHistory();
    }
  }

  /**
   * Format a date string to a user-friendly display format.
   * @param dateString - ISO date string
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format a date string to include time.
   * @param dateString - ISO date string
   */
  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get CSS class for transaction type badge.
   * @param type - The transaction type ('Earn' or 'Redeem')
   */
  getTransactionTypeClass(type: string): string {
    return type === 'Earn' ? 'type-earn' : 'type-redeem';
  }

  /**
   * Get the display prefix for points (+/-).
   * @param type - The transaction type
   */
  getPointsPrefix(type: string): string {
    return type === 'Earn' ? '+' : '-';
  }
}
