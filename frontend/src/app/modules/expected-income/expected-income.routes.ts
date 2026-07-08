import { Routes } from '@angular/router';

export const EXPECTED_INCOME_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./expected-income.component').then(m => m.ExpectedIncomeComponent),
  },
];
