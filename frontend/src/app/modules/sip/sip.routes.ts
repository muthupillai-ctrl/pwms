import { Routes } from '@angular/router';

export const SIP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sip-list.component').then(m => m.SipListComponent),
  },
];
