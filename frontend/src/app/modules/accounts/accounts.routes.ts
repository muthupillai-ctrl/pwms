import { Routes } from '@angular/router';

export const ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./accounts-list.component').then(m => m.AccountsListComponent),
  },
];
