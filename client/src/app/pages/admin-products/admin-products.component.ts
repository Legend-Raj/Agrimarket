import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { Product } from '../../core/models/dashboard.models';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdminHeaderComponent } from '../../shared/components/admin-header/admin-header.component';

/**
 * Stock filter options for inventory count
 */
type StockFilter = 'inStock' | 'outOfStock';

/**
 * Interface for Create Product form
 */
interface CreateProductForm {
  name: string;
  description: string;
  pointsCost: number | null;
  imageUrl: string;
  stock: number | null;
  isActive: boolean;
}

/**
 * Interface for Edit Product form
 */
interface EditProductForm {
  name: string;
  description: string;
  pointsCost: number | null;
  imageUrl: string;
  stock: number | null;
  isActive: boolean;
}

/**
 * Admin Products Page Component
 * 
 * Displays:
 * - Summary card with product inventory count (filterable by In Stock / Out of Stock)
 * - Action cards: View/Edit Products, Add Products
 * - Modals for viewing, editing, and adding products
 * 
 * Follows the same design patterns as admin-users for consistency.
 */
@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, AdminHeaderComponent],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.css'
})
export class AdminProductsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();

  // Current year for footer
  readonly currentYear = new Date().getFullYear();

  // Inventory Statistics
  readonly inventoryCount = signal<number>(0);
  readonly stockFilter = signal<StockFilter>('inStock');
  readonly allProducts = signal<Product[]>([]);

  // UI State
  readonly isLoading = signal<boolean>(true);

  // Modal States
  readonly showAddProductModal = signal<boolean>(false);
  readonly showProductListModal = signal<boolean>(false);
  readonly showEditProductModal = signal<boolean>(false);
  readonly showConfirmModal = signal<boolean>(false);

  // Add Product Form State
  readonly addProductForm = signal<CreateProductForm>({
    name: '',
    description: '',
    pointsCost: null,
    imageUrl: '',
    stock: null,
    isActive: true
  });
  readonly addProductErrors = signal<Record<string, string>>({});
  readonly isAddingProduct = signal<boolean>(false);
  readonly addProductSuccess = signal<string>('');

  // Product List State
  readonly productList = signal<Product[]>([]);
  readonly productListLoading = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  // Edit Product State
  readonly selectedProduct = signal<Product | null>(null);
  readonly editProductForm = signal<EditProductForm>({
    name: '',
    description: '',
    pointsCost: null,
    imageUrl: '',
    stock: null,
    isActive: true
  });
  readonly editProductErrors = signal<Record<string, string>>({});
  readonly isUpdatingProduct = signal<boolean>(false);
  readonly editProductSuccess = signal<string>('');

  // Confirm Modal State
  readonly confirmAction = signal<'save' | 'add' | 'delete' | null>(null);
  readonly confirmTitle = signal<string>('');
  readonly confirmMessage = signal<string>('');
  readonly isConfirmLoading = signal<boolean>(false);

  // Delete Product State
  readonly productToDelete = signal<Product | null>(null);
  readonly isDeletingProduct = signal<boolean>(false);
  readonly deleteProductError = signal<string>('');

  // Computed values
  readonly filteredProductList = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.productList();
    
    return this.productList().filter(product => 
      product.name.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  });

  readonly totalProducts = computed(() => this.allProducts().length);

  // Stock filter options for dropdown
  readonly stockOptions: { value: StockFilter; label: string }[] = [
    { value: 'inStock', label: 'In Stock' },
    { value: 'outOfStock', label: 'Out of Stock' }
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
    else if (this.showAddProductModal()) this.closeAddProductModal();
    else if (this.showEditProductModal()) this.closeEditProductModal();
    else if (this.showProductListModal()) this.closeProductListModal();
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

    // Load all products and calculate inventory count
    this.loadProducts();
  }

  /**
   * Load all products and update inventory count
   */
  private loadProducts(): void {
    this.adminService.getProducts(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.allProducts.set(products);
          this.updateInventoryCount();
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load products:', error);
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Update inventory count based on selected stock filter
   */
  private updateInventoryCount(): void {
    const products = this.allProducts();
    const filter = this.stockFilter();
    
    if (filter === 'inStock') {
      // In Stock: Products with stock > 0 OR stock is null (unlimited)
      this.inventoryCount.set(
        products.filter(p => p.isActive && (p.stock === null || p.stock > 0)).length
      );
    } else {
      // Out of Stock: Products with stock === 0
      this.inventoryCount.set(
        products.filter(p => p.isActive && p.stock === 0).length
      );
    }
  }

  /**
   * Handle stock filter change
   */
  onStockFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.stockFilter.set(select.value as StockFilter);
    this.updateInventoryCount();
  }

  // ============================================
  // Helper Methods
  // ============================================

  formatPoints(points: number): string {
    return points.toLocaleString('en-US');
  }

  // ============================================
  // Add Product Modal
  // ============================================

  openAddProductModal(): void {
    this.resetAddProductForm();
    this.showAddProductModal.set(true);
  }

  closeAddProductModal(): void {
    this.showAddProductModal.set(false);
    this.resetAddProductForm();
  }

  private resetAddProductForm(): void {
    this.addProductForm.set({
      name: '',
      description: '',
      pointsCost: null,
      imageUrl: '',
      stock: null,
      isActive: true
    });
    this.addProductErrors.set({});
    this.addProductSuccess.set('');
    this.isAddingProduct.set(false);
  }

  updateAddProductField(field: keyof CreateProductForm, value: string | number | boolean | null): void {
    this.addProductForm.update(form => ({ ...form, [field]: value }));
    // Clear error for this field when user starts typing
    this.addProductErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field.toLowerCase()];
      return newErrors;
    });
  }

  /**
   * Validates the add product form.
   * Uses lowercase keys to match backend validation error keys.
   */
  validateAddProductForm(): boolean {
    const form = this.addProductForm();
    const errors: Record<string, string> = {};

    // Name validation
    if (!form.name.trim()) {
      errors['name'] = 'Product name is required.';
    } else if (form.name.trim().length > 200) {
      errors['name'] = 'Product name cannot exceed 200 characters.';
    }

    // Points cost validation
    if (form.pointsCost === null || form.pointsCost === undefined) {
      errors['pointscost'] = 'Points cost is required.';
    } else if (form.pointsCost <= 0) {
      errors['pointscost'] = 'Points must be greater than 0.';
    } else if (form.pointsCost > 1000000) {
      errors['pointscost'] = 'Points cost cannot exceed 1,000,000.';
    }

    // Stock validation
    if (form.stock !== null && form.stock < 0) {
      errors['stock'] = 'Stock cannot be negative.';
    }

    // Image URL validation
    if (form.imageUrl && form.imageUrl.length > 500) {
      errors['imageurl'] = 'Image URL cannot exceed 500 characters.';
    }

    this.addProductErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Show confirmation popup before adding product
   */
  confirmAddProduct(): void {
    if (!this.validateAddProductForm()) return;

    this.confirmAction.set('add');
    this.confirmTitle.set('Confirm Add Product');
    this.confirmMessage.set(`Are you sure you want to add "${this.addProductForm().name}" to the product catalog?`);
    this.showConfirmModal.set(true);
  }

  /**
   * Actually submit the add product request
   */
  submitAddProduct(): void {
    this.isAddingProduct.set(true);
    this.addProductErrors.set({});
    this.addProductSuccess.set('');

    const form = this.addProductForm();
    const request = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      pointsCost: form.pointsCost!,
      imageUrl: form.imageUrl.trim() || undefined,
      stock: form.stock ?? undefined,
      isActive: form.isActive
    };

    this.adminService.createProduct(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (product) => {
          this.addProductSuccess.set(`Product "${product.name}" created successfully!`);
          this.isAddingProduct.set(false);
          // Update products list
          this.allProducts.update(products => [...products, product]);
          this.updateInventoryCount();
          // Close modal after 1.5 seconds
          setTimeout(() => {
            this.closeAddProductModal();
          }, 1500);
        },
        error: (error) => {
          this.isAddingProduct.set(false);
          if (error.error?.errors) {
            const backendErrors: Record<string, string> = {};
            for (const [key, messages] of Object.entries(error.error.errors)) {
              backendErrors[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
            }
            this.addProductErrors.set(backendErrors);
          } else {
            this.addProductErrors.set({ general: error.error?.message || 'Failed to create product. Please try again.' });
          }
        }
      });
  }

  // ============================================
  // Product List Modal
  // ============================================

  openProductListModal(): void {
    this.showProductListModal.set(true);
    this.loadProductList();
  }

  closeProductListModal(): void {
    this.showProductListModal.set(false);
    this.searchQuery.set('');
    this.productList.set([]);
  }

  loadProductList(): void {
    this.productListLoading.set(true);

    this.adminService.getProducts(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.productList.set(products);
          this.productListLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load products:', error);
          this.productListLoading.set(false);
        }
      });
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  getStockDisplay(stock: number | null): string {
    if (stock === null) return 'Unlimited';
    if (stock === 0) return 'Out of Stock';
    return stock.toString();
  }

  getStockClass(stock: number | null): string {
    if (stock === null) return 'unlimited';
    if (stock === 0) return 'out-of-stock';
    if (stock <= 5) return 'low-stock';
    return 'in-stock';
  }

  // ============================================
  // Edit Product Modal
  // ============================================

  openEditProductModal(product: Product): void {
    this.selectedProduct.set(product);
    this.editProductForm.set({
      name: product.name,
      description: product.description || '',
      pointsCost: product.pointsCost,
      imageUrl: product.imageUrl || '',
      stock: product.stock,
      isActive: product.isActive
    });
    this.editProductErrors.set({});
    this.editProductSuccess.set('');
    this.showEditProductModal.set(true);
  }

  closeEditProductModal(): void {
    this.showEditProductModal.set(false);
    this.selectedProduct.set(null);
    this.editProductErrors.set({});
    this.editProductSuccess.set('');
  }

  updateEditProductField(field: keyof EditProductForm, value: string | number | boolean | null): void {
    this.editProductForm.update(form => ({ ...form, [field]: value }));
    this.editProductErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors[field.toLowerCase()];
      return newErrors;
    });
  }

  /**
   * Validates the edit product form.
   * Uses lowercase keys to match backend validation error keys.
   */
  validateEditProductForm(): boolean {
    const form = this.editProductForm();
    const errors: Record<string, string> = {};

    // Name validation
    if (!form.name.trim()) {
      errors['name'] = 'Product name is required.';
    } else if (form.name.trim().length > 200) {
      errors['name'] = 'Product name cannot exceed 200 characters.';
    }

    // Points cost validation
    if (form.pointsCost === null || form.pointsCost === undefined) {
      errors['pointscost'] = 'Points cost is required.';
    } else if (form.pointsCost <= 0) {
      errors['pointscost'] = 'Points must be greater than 0.';
    } else if (form.pointsCost > 1000000) {
      errors['pointscost'] = 'Points cost cannot exceed 1,000,000.';
    }

    // Stock validation
    if (form.stock !== null && form.stock < 0) {
      errors['stock'] = 'Stock cannot be negative.';
    }

    // Image URL validation
    if (form.imageUrl && form.imageUrl.length > 500) {
      errors['imageurl'] = 'Image URL cannot exceed 500 characters.';
    }

    this.editProductErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Show confirmation popup before saving changes
   */
  confirmEditProduct(): void {
    if (!this.validateEditProductForm()) return;

    const product = this.selectedProduct();
    if (!product) return;

    this.confirmAction.set('save');
    this.confirmTitle.set('Confirm Save Changes');
    this.confirmMessage.set(`Are you sure you want to save changes to "${product.name}"?`);
    this.showConfirmModal.set(true);
  }

  /**
   * Actually submit the edit product request
   */
  submitEditProduct(): void {
    const product = this.selectedProduct();
    if (!product) return;

    this.isUpdatingProduct.set(true);
    this.editProductErrors.set({});
    this.editProductSuccess.set('');

    const form = this.editProductForm();
    const request: Record<string, unknown> = {};

    // Only include fields that have changed
    if (form.name.trim() !== product.name) {
      request['name'] = form.name.trim();
    }
    if ((form.description.trim() || null) !== product.description) {
      request['description'] = form.description.trim() || null;
    }
    if (form.pointsCost !== product.pointsCost) {
      request['pointsCost'] = form.pointsCost;
    }
    if ((form.imageUrl.trim() || null) !== product.imageUrl) {
      request['imageUrl'] = form.imageUrl.trim() || null;
    }
    if (form.stock !== product.stock) {
      request['stock'] = form.stock;
    }
    if (form.isActive !== product.isActive) {
      request['isActive'] = form.isActive;
    }

    if (Object.keys(request).length === 0) {
      this.editProductErrors.set({ general: 'No changes detected.' });
      this.isUpdatingProduct.set(false);
      return;
    }

    this.adminService.updateProduct(product.id, request as Parameters<AdminService['updateProduct']>[1])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedProduct) => {
          this.editProductSuccess.set('Product updated successfully!');
          this.isUpdatingProduct.set(false);
          // Update the product in the list
          this.productList.update(products => 
            products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
          );
          this.allProducts.update(products => 
            products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
          );
          this.updateInventoryCount();
          // Close modal after 1.5 seconds
          setTimeout(() => {
            this.closeEditProductModal();
          }, 1500);
        },
        error: (error) => {
          this.isUpdatingProduct.set(false);
          if (error.error?.errors) {
            const backendErrors: Record<string, string> = {};
            for (const [key, messages] of Object.entries(error.error.errors)) {
              backendErrors[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
            }
            this.editProductErrors.set(backendErrors);
          } else {
            this.editProductErrors.set({ general: error.error?.message || 'Failed to update product. Please try again.' });
          }
        }
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
      this.submitAddProduct();
    } else if (action === 'save') {
      this.closeConfirmModal();
      this.submitEditProduct();
    } else if (action === 'delete') {
      this.submitDeleteProduct();
    }
  }

  // ============================================
  // Delete Product
  // ============================================

  /**
   * Show confirmation popup before deleting product
   */
  confirmDeleteProduct(product: Product): void {
    this.productToDelete.set(product);
    this.deleteProductError.set('');
    this.confirmAction.set('delete');
    this.confirmTitle.set('Delete Product');
    this.confirmMessage.set(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`);
    this.showConfirmModal.set(true);
  }

  /**
   * Actually submit the delete product request
   */
  submitDeleteProduct(): void {
    const product = this.productToDelete();
    if (!product) {
      this.closeConfirmModal();
      return;
    }

    this.isDeletingProduct.set(true);
    this.deleteProductError.set('');

    this.adminService.deleteProduct(product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove product from all lists
          this.productList.update(products => 
            products.filter(p => p.id !== product.id)
          );
          this.allProducts.update(products => 
            products.filter(p => p.id !== product.id)
          );
          this.updateInventoryCount();
          this.isDeletingProduct.set(false);
          this.productToDelete.set(null);
          this.closeConfirmModal();
        },
        error: (error) => {
          this.isDeletingProduct.set(false);
          this.isConfirmLoading.set(false);
          const errorMessage = error.error?.message || 'Failed to delete product. Please try again.';
          this.deleteProductError.set(errorMessage);
          // Update confirm message to show error
          this.confirmMessage.set(errorMessage);
        }
      });
  }
}
