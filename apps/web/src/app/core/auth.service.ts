import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import { AuthUser, can, LoginResponse, Permission } from '@fleet-pulse/shared';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // The access token only lives in memory. A page reload loses it on purpose;
  // restoreSession() gets a new one from the httpOnly refresh cookie.
  private accessToken: string | null = null;

  readonly user = signal<AuthUser | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);

  token() {
    return this.accessToken;
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>('/api/auth/login', { email, password })
      .pipe(tap((res) => this.startSession(res)));
  }

  refresh() {
    return this.http.post<LoginResponse>('/api/auth/refresh', {}).pipe(tap((res) => this.startSession(res)));
  }

  async restoreSession() {
    try {
      await firstValueFrom(this.refresh());
    } catch {
      // No valid cookie, so the user just sees the login page.
    }
  }

  async logout() {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.endSession();
    }
  }

  endSession() {
    this.accessToken = null;
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  can(permission: Permission) {
    return can(this.user()?.role, permission);
  }

  private startSession(res: LoginResponse) {
    this.accessToken = res.accessToken;
    this.user.set(res.user);
  }
}
