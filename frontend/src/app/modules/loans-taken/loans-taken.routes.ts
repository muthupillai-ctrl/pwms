import { Routes } from '@angular/router';

export const LOANS_TAKEN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./loans-taken.component').then(m => m.LoansTakenComponent),
  },
];
