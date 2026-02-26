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
 * Retailer Navbar Component
 *
 * Full-width marketplace navbar for the Retailer role.
 */
@Component({
  selector: 'app-retailer-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './retailer-navbar.component.html',
  styleUrl: './retailer-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetailerNavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);

  readonly categories = GROWER_NAV_CATEGORIES;

  readonly hoveredIndex = signal<number | null>(null);
  readonly pinnedIndex = signal<number | null>(null);
  readonly mobileMenuOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly selectedLocation = signal<string>('Select Location');
  readonly userDropdownOpen = signal<boolean>(false);

  readonly userName = computed(() => {
    const user = this.authService.user();
    return user?.name ?? user?.email?.split('@')[0] ?? 'User';
  });

  readonly userInitial = computed(() => this.userName()[0]?.toUpperCase() ?? 'U');

  readonly activeMenuIndex = computed(() => {
    return this.pinnedIndex() ?? this.hoveredIndex();
  });

  onCategoryMouseEnter(index: number): void {
    if (this.pinnedIndex() === null) {
      this.hoveredIndex.set(index);
    }
  }

  onCategoryMouseLeave(): void {
    if (this.pinnedIndex() === null) {
      this.hoveredIndex.set(null);
    }
  }

  onCategoryClick(index: number, event: Event): void {
    event.stopPropagation();

    if (this.pinnedIndex() === index) {
      this.pinnedIndex.set(null);
      this.hoveredIndex.set(null);
    } else {
      this.pinnedIndex.set(index);
      this.hoveredIndex.set(index);
    }
  }

  onMegaMenuMouseEnter(): void {
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
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
      this.router.navigate(['/retailer/search'], { queryParams: { q: query } });
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }
}
