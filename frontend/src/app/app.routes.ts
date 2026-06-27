import { Routes } from '@angular/router';
import { authGuard, guestGuard, ownerGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () =>
      import('./modules/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: 'my-loans',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./modules/my-loans/my-loans.component').then((m) => m.MyLoansComponent),
  },
  {
    path: '',
    canActivate: [ownerGuard],
    loadChildren: () =>
      import('./modules/shell/shell.routes').then((m) => m.shellRoutes),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
