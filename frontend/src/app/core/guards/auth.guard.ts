import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isAuthenticated()) return true;

  router.navigate(['/auth/login']);
  return false;
};

export const guestGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (!authService.isAuthenticated()) return true;

  // Redirect based on role
  const dest = authService.isAdmin() ? '/admin' : authService.isLoanUser() ? '/my-loans' : '/dashboard';
  router.navigate([dest]);
  return false;
};

export const adminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (!authService.isAuthenticated()) { router.navigate(['/auth/login']); return false; }
  if (!authService.isAdmin()) { router.navigate(['/dashboard']); return false; }
  return true;
};

export const ownerGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (!authService.isAuthenticated()) { router.navigate(['/auth/login']); return false; }
  if (authService.isAdmin())    { router.navigate(['/admin']);     return false; }
  if (authService.isLoanUser()) { router.navigate(['/my-loans']);  return false; }
  return true;
};
