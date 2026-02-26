import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root Application Component
 * 
 * Main entry point for the AGDATA Rewards Portal.
 * Renders the router outlet for navigation.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `]
})
export class App {}
