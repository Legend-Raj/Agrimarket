import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Shared Footer Component
 * 
 * Reusable footer component with AGDATA branding.
 * Used across all user and admin dashboard pages.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
}
