import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgIf } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, NgIf,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatProgressSpinnerModule, MatCardModule, MatIconModule,
  ],
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    }
    .login-card { width: 100%; max-width: 400px; padding: 8px; }
    .login-header { text-align: center; padding: 24px 24px 0; }
    .brand-icon { font-size: 48px; width: 48px; height: 48px; color: #38bdf8; }
    h1 { margin: 12px 0 4px; font-size: 1.5rem; font-weight: 600; }
    p  { color: #6b7280; margin: 0 0 24px; font-size: 0.875rem; }
    mat-form-field { width: 100%; }
    .actions { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .error-msg { color: #dc2626; font-size: 0.875rem; text-align: center; }
    .register-link { text-align: center; margin-top: 16px; font-size: 0.875rem; color: #6b7280; }
  `],
  template: `
    <div class="login-page">
      <mat-card class="login-card">
        <div class="login-header">
          <mat-icon class="brand-icon">account_balance_wallet</mat-icon>
          <h1>Welcome back</h1>
          <p>Sign in to your PWMS account</p>
        </div>

        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              <mat-error *ngIf="form.get('email')?.hasError('required')">Email is required</mat-error>
              <mat-error *ngIf="form.get('email')?.hasError('email')">Enter a valid email</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput [type]="showPwd ? 'text' : 'password'" formControlName="password" autocomplete="current-password" />
              <button mat-icon-button matSuffix type="button" (click)="showPwd = !showPwd">
                <mat-icon>{{ showPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="form.get('password')?.hasError('required')">Password is required</mat-error>
            </mat-form-field>

            <p *ngIf="error" class="error-msg">{{ error }}</p>

            <div class="actions">
              <button mat-flat-button color="primary" type="submit" [disabled]="loading || form.invalid">
                <mat-spinner *ngIf="loading" diameter="20" style="display:inline-block;margin-right:8px"></mat-spinner>
                {{ loading ? 'Signing in…' : 'Sign In' }}
              </button>
            </div>
          </form>
        </mat-card-content>

        <div class="register-link">
          Don't have an account? <a routerLink="/auth/register">Sign up</a>
        </div>
      </mat-card>
    </div>
  `,
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  showPwd = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;

    this.authService.login(this.form.value).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.data.mfaRequired) {
          this.router.navigate(['/auth/mfa']);
        } else {
          const dest = this.authService.isAdmin() ? '/admin' : this.authService.isLoanUser() ? '/my-loans' : '/dashboard';
          this.router.navigate([dest]);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Login failed. Please try again.';
      },
    });
  }
}
