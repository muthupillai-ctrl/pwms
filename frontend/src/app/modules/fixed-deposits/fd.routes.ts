import { Routes } from '@angular/router';

export const FD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./fd-list.component').then(m => m.FdListComponent),
  },
];
