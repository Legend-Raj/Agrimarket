import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { RetailerNavbarComponent } from '../../shared/components/retailer-navbar/retailer-navbar.component';
import { FilterSidebarComponent } from '../../shared/components/filter-sidebar/filter-sidebar.component';
import { AiChatbotComponent } from '../../shared/components/ai-chatbot/ai-chatbot.component';

/**
 * Retailer Dashboard Component
 *
 * Main dashboard for Retailer users showing:
 * - Overview stats (orders, revenue, inventory)
 * - Quick actions
 * - Placeholder sections for future features
 */
@Component({
  selector: 'app-retailer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FooterComponent, RetailerNavbarComponent, FilterSidebarComponent, AiChatbotComponent],
  templateUrl: './retailer-dashboard.component.html',
  styleUrl: './retailer-dashboard.component.css',
})
export class RetailerDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly userName = signal<string>('');
  readonly isLoading = signal<boolean>(true);

  readonly userFirstName = computed(() => {
    const name = this.userName();
    return name.split(' ')[0] || 'Retailer';
  });

  // Mock stats
  readonly stats = signal({
    totalOrders: 128,
    pendingOrders: 12,
    totalRevenue: 245000,
    lowStockItems: 5,
  });

  // Mock offers
  readonly offers = signal([
    { id: 1, title: 'Summer Sale', description: 'Get flat 30% off on all pesticides', discountPercent: 30, validUntil: 'June 30, 2026' },
    { id: 2, title: 'Bulk Order Discount', description: 'Buy 10+ units and save 25%', discountPercent: 25, validUntil: 'July 15, 2026' },
    { id: 3, title: 'New Product Launch', description: 'Special pricing on organic fertilizers', discountPercent: 20, validUntil: 'August 10, 2026' },
  ]);

  // Mock products - retailers have bulk quantities in stock
  readonly products = signal([
    { id: 1, name: 'Premium Insecticide', category: 'Crop Protection', description: 'Bulk pack for wholesale distribution', price: 750, unit: '10L case', quantity: 500 },
    { id: 2, name: 'Organic Fertilizer', category: 'Fertilizers', description: 'Natural growth enhancer in bulk', price: 580, unit: '50kg bag', quantity: 800 },
    { id: 3, name: 'Hybrid Seeds', category: 'Seeds', description: 'High-yield variety wholesale pack', price: 380, unit: '5kg pack', quantity: 600 },
    { id: 4, name: 'Herbicide Concentrate', category: 'Crop Protection', description: 'Weed control formula bulk pack', price: 820, unit: '5L container', quantity: 450 },
  ]);

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.userName.set(user.name || user.email.split('@')[0]);
        this.isLoading.set(false);
      },
      error: () => {
        const cached = this.authService.user();
        this.userName.set(cached?.name ?? 'Retailer');
        this.isLoading.set(false);
      },
    });
  }

  onLogout(): void {
    this.authService.logout().subscribe();
  }

  formatCurrency(value: number): string {
    return '₹' + value.toLocaleString('en-IN');
  }
}
