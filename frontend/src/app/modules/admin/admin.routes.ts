import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'stats', pathMatch: 'full' },
      {
        path: 'stats',
        loadComponent: () => import('./admin-stats.component').then(m => m.AdminStatsComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./admin-users.component').then(m => m.AdminUsersComponent),
      },
      {
        path: 'audit-logs',
        loadComponent: () => import('./admin-audit-logs.component').then(m => m.AdminAuditLogsComponent),
      },
      {
        path: 'categories',
        loadComponent: () => import('./admin-categories.component').then(m => m.AdminCategoriesComponent),
      },
    ],
  },
];
