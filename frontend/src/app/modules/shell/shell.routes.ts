import { Routes } from '@angular/router';

export const shellRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('../dashboard/dashboard.routes').then(m => m.dashboardRoutes),
      },
      {
        path: 'accounts',
        loadChildren: () => import('../accounts/accounts.routes').then(m => m.ACCOUNTS_ROUTES),
      },
      {
        path: 'fixed-deposits',
        loadChildren: () => import('../fixed-deposits/fd.routes').then(m => m.FD_ROUTES),
      },
      {
        path: 'stocks',
        loadChildren: () => import('../stocks/stocks.routes').then(m => m.STOCKS_ROUTES),
      },
      {
        path: 'mutual-funds',
        loadChildren: () => import('../mutual-funds/mf.routes').then(m => m.MF_ROUTES),
      },
      {
        path: 'bonds',
        loadChildren: () => import('../bonds/bonds.routes').then(m => m.BONDS_ROUTES),
      },
      {
        path: 'loans',
        loadChildren: () => import('../loans/loans.routes').then(m => m.LOANS_ROUTES),
      },
      {
        path: 'loans-taken',
        loadChildren: () => import('../loans-taken/loans-taken.routes').then(m => m.LOANS_TAKEN_ROUTES),
      },
      {
        path: 'sip',
        loadChildren: () => import('../sip/sip.routes').then(m => m.SIP_ROUTES),
      },
    ],
  },
];
