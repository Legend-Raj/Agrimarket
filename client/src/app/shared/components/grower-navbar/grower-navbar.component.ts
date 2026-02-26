import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  GROWER_NAV_CATEGORIES,
  NavCategory,
} from '../../../core/mock/mock-data';

/**
 * Grower Navbar Component
 *
 * Full-width marketplace navbar for the Grower role.
 *
 * Behaviour:
 *  - Top bar: Brand logo + search + user actions.
 *  - Category bar: Horizontal list of product categories.
 *  - Hover on a category → shows a mega-menu tooltip.
 *  - Click on a category → pins the mega-menu (stays visible).
 *  - Click anywhere else or press Escape → closes the pinned menu.
 *  - Each category operates independently.
 */
@Component({
  selector: 'app-grower-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './grower-navbar.component.html',
  styleUrl: './grower-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrowerNavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);

  readonly categories = GROWER_NAV_CATEGORIES;

  /** Index of the category whose mega-menu is visible (hover or pinned) */
  readonly hoveredIndex = signal<number | null>(null);

  /** Index of the category whose mega-menu is pinned (clicked) */
  readonly pinnedIndex = signal<number | null>(null);

  /** Whether the mobile menu drawer is open */
  readonly mobileMenuOpen = signal<boolean>(false);

  /** Search query for the top bar */
  readonly searchQuery = signal<string>('');

  /** Selected delivery location */
  readonly selectedLocation = signal<string>('Select Location');

  /** Whether user dropdown is open */
  readonly userDropdownOpen = signal<boolean>(false);

  readonly userName = computed(() => {
    const user = this.authService.user();
    return user?.name ?? user?.email?.split('@')[0] ?? 'User';
  });

  readonly userInitial = computed(() => this.userName()[0]?.toUpperCase() ?? 'U');

  /** The active/visible mega-menu index (pinned takes precedence) */
  readonly activeMenuIndex = computed(() => {
    return this.pinnedIndex() ?? this.hoveredIndex();
  });

  // ────────────────────────────────────────────
  // Category hover / click logic
  // ────────────────────────────────────────────

  onCategoryMouseEnter(index: number): void {
    // Only show on hover if nothing is pinned
    if (this.pinnedIndex() === null) {
      this.hoveredIndex.set(index);
    }
  }

  onCategoryMouseLeave(): void {
    // Only hide on leave if nothing is pinned
    if (this.pinnedIndex() === null) {
      this.hoveredIndex.set(null);
    }
  }

  onCategoryClick(index: number, event: Event): void {
    event.stopPropagation();

    if (this.pinnedIndex() === index) {
      // Un-pin if clicking same category again
      this.pinnedIndex.set(null);
      this.hoveredIndex.set(null);
    } else {
      this.pinnedIndex.set(index);
      this.hoveredIndex.set(index);
    }
  }

  onMegaMenuMouseEnter(): void {
    // Keep the menu visible while user hovers over the drop-down itself
    // (only relevant in un-pinned / hover mode)
    const idx = this.activeMenuIndex();
    if (idx !== null && this.pinnedIndex() === null) {
      this.hoveredIndex.set(idx);
    }
  }

  onMegaMenuMouseLeave(): void {
    if (this.pinnedIndex() === null) {
      this.hoveredIndex.set(null);
    }
  }

  // ────────────────────────────────────────────
  // Global click / keyboard
  // ────────────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Close pinned mega-menu & user dropdown when clicking outside navbar
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.pinnedIndex.set(null);
      this.hoveredIndex.set(null);
      this.userDropdownOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.pinnedIndex.set(null);
    this.hoveredIndex.set(null);
    this.userDropdownOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  // ────────────────────────────────────────────
  // User actions
  // ────────────────────────────────────────────

  toggleUserDropdown(event: Event): void {
    event.stopPropagation();
    this.userDropdownOpen.update((v) => !v);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.pinnedIndex.set(null);
    this.hoveredIndex.set(null);
    this.mobileMenuOpen.set(false);
  }

  onLogout(): void {
    this.authService.logout().subscribe();
  }

  onSearch(): void {
    const query = this.searchQuery().trim();
    if (query) {
      this.router.navigate(['/grower/search'], { queryParams: { q: query } });
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }
}
