import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission } from '@fleet-pulse/shared';
import { AuthService } from './auth.service';

// Guards only improve the experience. The API is what actually enforces access.

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).createUrlTree(['/login']);
};

export const permissionGuard =
  (permission: Permission): CanActivateFn =>
  () => inject(AuthService).can(permission) || inject(Router).createUrlTree(['/forbidden']);

export const homeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return router.createUrlTree([auth.can('dashboard:read') ? '/dashboard' : '/my-vehicle']);
};
