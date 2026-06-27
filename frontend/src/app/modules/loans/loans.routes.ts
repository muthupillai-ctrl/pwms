import { Routes } from '@angular/router';

export const LOANS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./loans-list.component').then(m => m.LoansListComponent),
  },
];
