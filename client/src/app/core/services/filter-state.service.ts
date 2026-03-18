import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Shared state service for product filter sidebar.
 * FilterSidebarComponent writes to it; GrowerDashboardComponent reads from it.
 */
@Injectable({ providedIn: 'root' })
export class FilterStateService {
  // Filter section expansion state
  readonly cropSectionExpanded = signal(false);
  readonly manufacturerSectionExpanded = signal(false);

  // Selected filter values
  readonly selectedCategories = signal<string[]>([]);
  readonly selectedSellerIds = signal<string[]>([]);
  readonly showOnlyAvailable = signal(true);
  readonly searchQuery = signal('');

  // Price range filters (in dollars)
  readonly minPrice = signal<number | undefined>(undefined);
  readonly maxPrice = signal<number | undefined>(undefined);

  // Subject for filter change events
  private readonly filtersChangedSubject = new Subject<void>();

  // Observable for filter changes (subscribe in GrowerDashboard)
  readonly filtersChanged$ = this.filtersChangedSubject.asObservable();

  // Active filter count
  readonly activeFilterCount = computed(() => {
    let count = this.selectedCategories().length +
           this.selectedSellerIds().length +
           (this.showOnlyAvailable() ? 1 : 0);

    // Count price range if either min or max is set
    if (this.minPrice() !== undefined || this.maxPrice() !== undefined) {
      count += 1;
    }

    return count;
  });

  // Check if any price filter is active
  readonly hasPriceFilter = computed(() => {
    return this.minPrice() !== undefined || this.maxPrice() !== undefined;
  });

  toggleCropSection(): void {
    this.cropSectionExpanded.update(v => !v);
  }

  toggleManufacturerSection(): void {
    this.manufacturerSectionExpanded.update(v => !v);
  }

  toggleCategory(categoryId: string): void {
    console.log('[FilterStateService] toggleCategory called:', categoryId);
    this.selectedCategories.update(ids => {
      if (ids.includes(categoryId)) {
        console.log('[FilterStateService] Removing category:', categoryId);
        return ids.filter(id => id !== categoryId);
      }
      console.log('[FilterStateService] Adding category:', categoryId);
      return [...ids, categoryId];
    });
    console.log('[FilterStateService] Current categories:', this.selectedCategories());
    this.emitFiltersChanged();
  }

  toggleSeller(sellerId: string): void {
    console.log('[FilterStateService] toggleSeller called:', sellerId);
    this.selectedSellerIds.update(ids => {
      if (ids.includes(sellerId)) {
        console.log('[FilterStateService] Removing seller:', sellerId);
        return ids.filter(id => id !== sellerId);
      }
      console.log('[FilterStateService] Adding seller:', sellerId);
      return [...ids, sellerId];
    });
    console.log('[FilterStateService] Current sellers:', this.selectedSellerIds());
    this.emitFiltersChanged();
  }

  toggleAvailability(): void {
    this.showOnlyAvailable.update(v => !v);
    this.emitFiltersChanged();
  }

  setSearch(query: string): void {
    this.searchQuery.set(query);
    this.emitFiltersChanged();
  }

  /**
   * Set the minimum price filter
   * @param price - Minimum price value (undefined to clear)
   */
  setMinPrice(price: number | undefined): void {
    if (price === undefined || price <= 0) {
      this.minPrice.set(undefined);
    } else {
      this.minPrice.set(price);
    }
    this.emitFiltersChanged();
  }

  /**
   * Set the maximum price filter
   * @param price - Maximum price value (undefined to clear)
   */
  setMaxPrice(price: number | undefined): void {
    if (price === undefined || price <= 0) {
      this.maxPrice.set(undefined);
    } else {
      this.maxPrice.set(price);
    }
    this.emitFiltersChanged();
  }

  /**
   * Set both min and max price at once
   */
  setPriceRange(min: number | undefined, max: number | undefined): void {
    this.setMinPrice(min);
    this.setMaxPrice(max);
  }

  /**
   * Clear all filters including price range
   */
  clearAll(): void {
    this.selectedCategories.set([]);
    this.selectedSellerIds.set([]);
    this.showOnlyAvailable.set(false);
    this.searchQuery.set('');
    this.minPrice.set(undefined);
    this.maxPrice.set(undefined);
    this.emitFiltersChanged();
  }

  /**
   * Emit event when filters change
   */
  private emitFiltersChanged(): void {
    console.log('[FilterStateService] Emitting filter change event');
    this.filtersChangedSubject.next();
  }

  /** Returns true if a category is selected */
  isCategorySelected(categoryId: string): boolean {
    return this.selectedCategories().includes(categoryId);
  }

  /** Returns true if a seller is selected */
  isSellerSelected(sellerId: string): boolean {
    return this.selectedSellerIds().includes(sellerId);
  }
}
