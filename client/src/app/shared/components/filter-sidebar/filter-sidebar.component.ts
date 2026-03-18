import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { FilterStateService } from '../../../core/services/filter-state.service';
import { FilterOptions } from '../../../core/models/product.models';

interface FilterSection {
  id: string;
  title: string;
  isExpanded: boolean;
}

@Component({
  selector: 'app-filter-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-sidebar.component.html',
  styleUrls: ['./filter-sidebar.component.css']
})
export class FilterSidebarComponent implements OnInit {
  private readonly productService = inject(ProductService);
  readonly filterState = inject(FilterStateService);

  // Dynamic filter options loaded from backend
  readonly filterOptions = signal<FilterOptions | null>(null);
  readonly isLoadingFilters = signal(true);
  readonly filterLoadError = signal(false);

  // Section expansion state
  readonly sections = signal<FilterSection[]>([
    { id: 'categories', title: 'Categories', isExpanded: false },
    { id: 'manufacturers', title: 'Manufacturers', isExpanded: false }
  ]);

  // Search inputs for filtering the list views
  readonly categorySearch = signal('');
  readonly manufacturerSearch = signal('');

  ngOnInit(): void {
    this.loadFilterOptions();
  }

  private loadFilterOptions(): void {
    this.filterLoadError.set(false);
    this.productService.getFilterOptions().subscribe({
      next: (options) => {
        this.filterOptions.set(options);
        this.isLoadingFilters.set(false);
      },
      error: (err) => {
        console.error('Failed to load filter options:', err);
        this.filterLoadError.set(true);
        this.isLoadingFilters.set(false);
      }
    });
  }

  // Filter categories by search text
  filteredCategories() {
    const options = this.filterOptions()?.categories ?? [];
    const search = this.categorySearch().toLowerCase().trim();
    if (!search) return options;
    return options.filter(c => c.name.toLowerCase().includes(search));
  }

  // Filter sellers by search text
  filteredSellers() {
    const sellers = this.filterOptions()?.sellers ?? [];
    const search = this.manufacturerSearch().toLowerCase().trim();
    if (!search) return sellers;
    return sellers.filter(s => {
      const name = s.companyName ?? '';
      return name.toLowerCase().includes(search);
    });
  }

  // Get display name for a seller (companyName or "Unknown")
  getSellerName(seller: { id: string; companyName: string | null }): string {
    return seller.companyName || 'Independent Seller';
  }

  // Get display name for a category
  getCategoryName(category: { name: string }): string {
    return category.name || 'Uncategorized';
  }

  // Get price range display text
  getPriceRangeText(): string {
    const range = this.filterOptions()?.priceRange;
    if (!range) return '';
    return `$${range.min.toFixed(0)} - $${range.max.toFixed(0)}`;
  }

  // Section toggle
  toggleSection(sectionId: string): void {
    this.sections.update(sections =>
      sections.map(s => s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s)
    );
  }

  getSectionById(id: string): FilterSection | undefined {
    return this.sections().find(s => s.id === id);
  }

  // Category selection
  toggleCategory(categoryId: string): void {
    console.log('[FilterSidebar] toggleCategory called:', categoryId);
    this.filterState.toggleCategory(categoryId);
  }

  isCategorySelected(categoryId: string): boolean {
    return this.filterState.isCategorySelected(categoryId);
  }

  // Seller/manufacturer selection
  toggleManufacturer(sellerId: string): void {
    console.log('[FilterSidebar] toggleManufacturer called:', sellerId);
    this.filterState.toggleSeller(sellerId);
  }

  isSellerSelected(sellerId: string): boolean {
    return this.filterState.isSellerSelected(sellerId);
  }

  // Availability toggle
  toggleAvailability(): void {
    this.filterState.toggleAvailability();
  }

  // Search input handlers
  onCategorySearchChange(value: string): void {
    this.categorySearch.set(value);
  }

  onManufacturerSearchChange(value: string): void {
    this.manufacturerSearch.set(value);
  }

  // Price range handlers
  onMinPriceChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const price = value ? parseFloat(value) : undefined;
    this.filterState.setMinPrice(price);
  }

  onMaxPriceChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const price = value ? parseFloat(value) : undefined;
    this.filterState.setMaxPrice(price);
  }

  // Get min price placeholder
  getMinPricePlaceholder(): string {
    const range = this.filterOptions()?.priceRange;
    return range ? range.min.toFixed(0) : '0';
  }

  // Get max price placeholder
  getMaxPricePlaceholder(): string {
    const range = this.filterOptions()?.priceRange;
    return range ? range.max.toFixed(0) : '1000';
  }

  // Clear price filters
  clearPriceFilters(): void {
    this.filterState.setPriceRange(undefined, undefined);
  }

  // Clear all filters
  clearAllFilters(): void {
    this.filterState.clearAll();
  }

  // Active filters count
  getActiveFiltersCount(): number {
    return this.filterState.activeFilterCount();
  }
}
