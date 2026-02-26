import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface FilterSection {
  id: string;
  title: string;
  isExpanded: boolean;
  hasSearch?: boolean;
}

interface FilterOption {
  id: string;
  label: string;
  checked: boolean;
  count?: number;
}

@Component({
  selector: 'app-filter-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-sidebar.component.html',
  styleUrls: ['./filter-sidebar.component.css']
})
export class FilterSidebarComponent {
  // Availability toggle
  showOnlyAvailable = signal(true);

  // Search queries
  cropSearch = signal('');
  manufacturerSearch = signal('');

  // Filter sections
  sections = signal<FilterSection[]>([
    { id: 'crops', title: 'Crops', isExpanded: false, hasSearch: true },
    { id: 'manufacturer', title: 'Manufacturer/Brand', isExpanded: false, hasSearch: true }
  ]);

  // Crop options
  cropOptions = signal<FilterOption[]>([
    { id: 'wheat', label: 'Wheat', checked: false, count: 145 },
    { id: 'rice', label: 'Rice', checked: false, count: 128 },
    { id: 'corn', label: 'Corn', checked: false, count: 97 },
    { id: 'soybean', label: 'Soybean', checked: false, count: 83 },
    { id: 'cotton', label: 'Cotton', checked: false, count: 76 },
    { id: 'sugarcane', label: 'Sugarcane', checked: false, count: 54 }
  ]);

  // Manufacturer options
  manufacturerOptions = signal<FilterOption[]>([
    { id: 'various', label: 'various manufacturers', checked: false, count: 234 },
    { id: 'sharda', label: 'Sharda USA LLC', checked: false, count: 89 },
    { id: 'adama', label: 'ADAMA', checked: false, count: 76 },
    { id: 'innvictis', label: 'Innvictis Crop Care, LLC', checked: false, count: 64 },
    { id: 'agromarketing', label: 'Agromarketing Company, Inc.', checked: false, count: 52 },
    { id: 'redeagle', label: 'RedEagle International, LLC', checked: false, count: 48 },
    { id: 'bayer', label: 'Bayer CropScience', checked: false, count: 91 },
    { id: 'syngenta', label: 'Syngenta', checked: false, count: 87 },
    { id: 'corteva', label: 'Corteva Agriscience', checked: false, count: 82 },
    { id: 'basf', label: 'BASF', checked: false, count: 74 }
  ]);

  // Filtered crops based on search
  filteredCrops = computed(() => {
    const search = this.cropSearch().toLowerCase().trim();
    if (!search) return this.cropOptions();
    
    return this.cropOptions().filter(option => 
      option.label.toLowerCase().includes(search)
    );
  });

  // Filtered manufacturers based on search
  filteredManufacturers = computed(() => {
    const search = this.manufacturerSearch().toLowerCase().trim();
    if (!search) return this.manufacturerOptions();
    
    return this.manufacturerOptions().filter(option => 
      option.label.toLowerCase().includes(search)
    );
  });

  // Toggle section expansion
  toggleSection(sectionId: string) {
    this.sections.update(sections => 
      sections.map(section => 
        section.id === sectionId 
          ? { ...section, isExpanded: !section.isExpanded }
          : section
      )
    );
  }

  // Toggle availability
  toggleAvailability() {
    this.showOnlyAvailable.update(value => !value);
  }

  // Toggle crop option
  toggleCropOption(optionId: string) {
    this.cropOptions.update(options =>
      options.map(option =>
        option.id === optionId
          ? { ...option, checked: !option.checked }
          : option
      )
    );
  }

  // Toggle manufacturer option
  toggleManufacturerOption(optionId: string) {
    this.manufacturerOptions.update(options =>
      options.map(option =>
        option.id === optionId
          ? { ...option, checked: !option.checked }
          : option
      )
    );
  }

  // Get section state
  getSectionById(id: string) {
    return this.sections().find(section => section.id === id);
  }

  // Clear all filters
  clearAllFilters() {
    this.showOnlyAvailable.set(false);
    this.cropSearch.set('');
    this.manufacturerSearch.set('');
    this.cropOptions.update(options =>
      options.map(option => ({ ...option, checked: false }))
    );
    this.manufacturerOptions.update(options =>
      options.map(option => ({ ...option, checked: false }))
    );
  }

  // Get active filters count
  getActiveFiltersCount() {
    const cropCount = this.cropOptions().filter(o => o.checked).length;
    const manufacturerCount = this.manufacturerOptions().filter(o => o.checked).length;
    return cropCount + manufacturerCount + (this.showOnlyAvailable() ? 1 : 0);
  }
}
