import { Routes } from '@angular/router';

export const BONDS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./bonds-list.component').then(m => m.BondsListComponent),
  },
];
