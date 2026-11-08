import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Permission } from '@fleet-pulse/shared';
import { AuthService } from '../core/auth.service';

interface NavItem {
  label: string;
  path: string;
  permission: Permission;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', permission: 'dashboard:read' },
  { label: 'Vehicles', path: '/vehicles', permission: 'vehicle:read' },
  { label: 'Drivers', path: '/drivers', permission: 'driver:read' },
  { label: 'Users', path: '/users', permission: 'user:read' },
  { label: 'My vehicle', path: '/my-vehicle', permission: 'self:read' },
];

@Component({
  selector: 'fp-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app">
      <aside class="sidebar" [class.open]="menuOpen()">
        <div class="brand">Fleet<span>Pulse</span></div>
        <nav class="nav" (click)="menuOpen.set(false)">
          @for (item of items(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
          }
        </nav>
        <div class="sidebar-foot">
          <strong>{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</strong>
          {{ roleLabel() }}
          <div><button class="btn sm" style="margin-top: 0.6rem" (click)="signOut()">Sign out</button></div>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button type="button" aria-label="Open menu" (click)="menuOpen.set(!menuOpen())">&#9776;</button>
          <strong>Fleet-Pulse</strong>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  menuOpen = signal(false);

  items = () => NAV.filter((n) => this.auth.can(n.permission));
  roleLabel = () => (this.auth.user()?.role ?? '').toLowerCase().replace('_', ' ');

  async signOut() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
