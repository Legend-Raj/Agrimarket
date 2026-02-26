import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GrowerNavbarComponent } from '../../shared/components/grower-navbar/grower-navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { FilterSidebarComponent } from '../../shared/components/filter-sidebar/filter-sidebar.component';
import { AiChatbotComponent } from '../../shared/components/ai-chatbot/ai-chatbot.component';
import { MOCK_PRODUCTS, MOCK_OFFERS, MockProduct, MockOffer } from '../../core/mock/mock-data';

/**
 * Grower Dashboard Component
 *
 * Main dashboard for Farmer/Grower users showing:
 * - Marketplace navbar with categories
 * - Featured products
 * - Current offers
 * - Quick stats
 */
@Component({
  selector: 'app-grower-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, GrowerNavbarComponent, FooterComponent, FilterSidebarComponent, AiChatbotComponent],
  templateUrl: './grower-dashboard.component.html',
  styleUrl: './grower-dashboard.component.css',
})
export class GrowerDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly userName = signal<string>('');
  readonly isLoading = signal<boolean>(true);

  // Mock data
  readonly products = signal<MockProduct[]>([]);
  readonly offers = signal<MockOffer[]>([]);

  readonly userFirstName = computed(() => {
    const name = this.userName();
    return name.split(' ')[0] || 'Grower';
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.userName.set(user.name || user.email.split('@')[0]);
        this.products.set(MOCK_PRODUCTS.filter((p) => p.inStock));
        this.offers.set(MOCK_OFFERS);
        this.isLoading.set(false);
      },
      error: () => {
        const cached = this.authService.user();
        this.userName.set(cached?.name ?? 'Grower');
        this.products.set(MOCK_PRODUCTS.filter((p) => p.inStock));
        this.offers.set(MOCK_OFFERS);
        this.isLoading.set(false);
      },
    });
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
}
