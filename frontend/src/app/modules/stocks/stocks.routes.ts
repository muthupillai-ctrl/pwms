import { Routes } from '@angular/router';

export const STOCKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./stocks-list.component').then(m => m.StocksListComponent),
  },
];
