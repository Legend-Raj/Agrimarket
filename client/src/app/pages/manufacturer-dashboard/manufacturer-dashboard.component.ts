import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AiChatbotComponent } from '../../shared/components/ai-chatbot/ai-chatbot.component';

/**
 * Manufacturer Dashboard Component
 *
 * Main dashboard for Manufacturer users showing:
 * - Overview stats (products listed, orders received, distribution)
 * - Quick actions
 * - Placeholder sections for future features
 */
@Component({
  selector: 'app-manufacturer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FooterComponent, AiChatbotComponent],
  templateUrl: './manufacturer-dashboard.component.html',
  styleUrl: './manufacturer-dashboard.component.css',
})
export class ManufacturerDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly userName = signal<string>('');
  readonly isLoading = signal<boolean>(true);

  readonly userFirstName = computed(() => {
    const name = this.userName();
    return name.split(' ')[0] || 'Manufacturer';
  });

  // Mock stats
  readonly stats = signal({
    productsListed: 47,
    activeOrders: 23,
    totalDistributors: 85,
    monthlyRevenue: 1850000,
  });

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
        this.userName.set(cached?.name ?? 'Manufacturer');
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
