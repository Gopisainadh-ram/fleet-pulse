import { Routes } from '@angular/router';
import { authGuard, homeGuard, permissionGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'set-password',
    loadComponent: () => import('./features/auth/set-password.component').then((m) => m.SetPasswordComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      // Sends each role to the first page it is allowed to see
      { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
      {
        path: 'dashboard',
        canActivate: [permissionGuard('dashboard:read')],
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'vehicles',
        canActivate: [permissionGuard('vehicle:read')],
        loadComponent: () => import('./features/vehicles/vehicles.component').then((m) => m.VehiclesComponent),
      },
      {
        path: 'drivers',
        canActivate: [permissionGuard('driver:read')],
        loadComponent: () => import('./features/drivers/drivers.component').then((m) => m.DriversComponent),
      },
      {
        path: 'users',
        canActivate: [permissionGuard('user:read')],
        loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'my-vehicle',
        canActivate: [permissionGuard('self:read')],
        loadComponent: () => import('./features/my-vehicle/my-vehicle.component').then((m) => m.MyVehicleComponent),
      },
      {
        path: 'forbidden',
        loadComponent: () => import('./features/auth/forbidden.component').then((m) => m.ForbiddenComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
