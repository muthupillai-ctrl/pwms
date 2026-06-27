import { Routes } from '@angular/router';

export const MF_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./mf-list.component').then(m => m.MfListComponent),
  },
];
