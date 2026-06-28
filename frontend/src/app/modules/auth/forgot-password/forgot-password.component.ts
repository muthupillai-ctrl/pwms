import { Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

function passwordStrength(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value ?? '';
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(v)) return null;
  return { passwordStrength: true };
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, NgIf,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatProgressSpinnerModule, MatCardModule, MatIconModule,
  ],
  styles: [`
    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    }
    .card { width: 100%; max-width: 420px; padding: 8px; }
    .header { text-align: center; padding: 24px 24px 0; }
    .brand-icon { font-size: 48px; width: 48px; height: 48px; color: #38bdf8; }
    h1 { margin: 12px 0 4px; font-size: 1.5rem; font-weight: 600; }
    .subtitle { color: #6b7280; margin: 0 0 24px; font-size: 0.875rem; }
    mat-form-field { width: 100%; }
    .actions { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .error-msg { color: #dc2626; font-size: 0.875rem; text-align: center; margin: 4px 0; }
    .success-msg { color: #16a34a; font-size: 0.875rem; text-align: center; margin: 4px 0; }
    .back-link { text-align: center; margin-top: 16px; font-size: 0.875rem; color: #6b7280; }
    .email-badge {
      background: #f1f5f9; border-radius: 6px; padding: 6px 12px;
      font-size: 0.875rem; color: #334155; text-align: center; margin-bottom: 16px;
    }
    .otp-hint { font-size: 0.8125rem; color: #6b7280; text-align: center; margin: 0 0 12px; }
    .resend-row { text-align: center; font-size: 0.8125rem; color: #6b7280; margin-top: 4px; }
    .resend-row button { color: #3b82f6; background: none; border: none; cursor: pointer; font-size: 0.8125rem; padding: 0; }
    .resend-row button:disabled { color: #9ca3af; cursor: default; }
  `],
  template: `
    <div class="page">
      <mat-card class="card">

        <!-- ── Step 1: Email ── -->
        <ng-container *ngIf="step === 1">
          <div class="header">
            <mat-icon class="brand-icon">lock_reset</mat-icon>
            <h1>Forgot password?</h1>
            <p class="subtitle">Enter your email and we'll send a reset code</p>
          </div>

          <mat-card-content>
            <form [formGroup]="emailForm" (ngSubmit)="sendOtp()">
              <mat-form-field appearance="outline">
                <mat-label>Email address</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="email" />
                <mat-error *ngIf="emailForm.get('email')?.hasError('required')">Email is required</mat-error>
                <mat-error *ngIf="emailForm.get('email')?.hasError('email')">Enter a valid email</mat-error>
              </mat-form-field>

              <p *ngIf="error" class="error-msg">{{ error }}</p>

              <div class="actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="loading || emailForm.invalid">
                  <mat-spinner *ngIf="loading" diameter="20" style="display:inline-block;margin-right:8px"></mat-spinner>
                  {{ loading ? 'Sending…' : 'Send Reset Code' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </ng-container>

        <!-- ── Step 2: OTP + new password ── -->
        <ng-container *ngIf="step === 2">
          <div class="header">
            <mat-icon class="brand-icon" style="color:#f59e0b">vpn_key</mat-icon>
            <h1>Reset password</h1>
            <p class="subtitle">Enter the code sent to your email</p>
          </div>

          <mat-card-content>
            <div class="email-badge">{{ emailForm.value.email }}</div>
            <p class="otp-hint">Check your inbox (and spam folder). The code expires in 10 minutes.</p>

            <form [formGroup]="resetForm" (ngSubmit)="doReset()">
              <mat-form-field appearance="outline">
                <mat-label>6-digit code</mat-label>
                <input matInput type="text" inputmode="numeric" maxlength="6"
                       formControlName="otp" autocomplete="one-time-code" />
                <mat-error *ngIf="resetForm.get('otp')?.hasError('required')">Code is required</mat-error>
                <mat-error *ngIf="resetForm.get('otp')?.hasError('pattern')">Must be 6 digits</mat-error>
                <mat-error *ngIf="resetForm.get('otp')?.hasError('minlength') || resetForm.get('otp')?.hasError('maxlength')">Must be exactly 6 digits</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>New password</mat-label>
                <input matInput [type]="showPwd ? 'text' : 'password'"
                       formControlName="newPassword" autocomplete="new-password" />
                <button mat-icon-button matSuffix type="button" (click)="showPwd = !showPwd">
                  <mat-icon>{{ showPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-error *ngIf="resetForm.get('newPassword')?.hasError('required')">Password is required</mat-error>
                <mat-error *ngIf="resetForm.get('newPassword')?.hasError('minlength')">Min 8 characters</mat-error>
                <mat-error *ngIf="resetForm.get('newPassword')?.hasError('passwordStrength')">
                  Must include uppercase, lowercase, number and special character (&#64;$!%*?&amp;)
                </mat-error>
              </mat-form-field>

              <p *ngIf="error" class="error-msg">{{ error }}</p>
              <p *ngIf="success" class="success-msg">{{ success }}</p>

              <div class="actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="loading || resetForm.invalid">
                  <mat-spinner *ngIf="loading" diameter="20" style="display:inline-block;margin-right:8px"></mat-spinner>
                  {{ loading ? 'Resetting…' : 'Reset Password' }}
                </button>

                <div class="resend-row">
                  <button type="button" (click)="resend()" [disabled]="resendCountdown > 0">
                    {{ resendCountdown > 0 ? 'Resend code in ' + resendCountdown + 's' : 'Resend code' }}
                  </button>
                  &nbsp;·&nbsp;
                  <a (click)="step = 1; error = null" style="cursor:pointer;color:#3b82f6">Change email</a>
                </div>
              </div>
            </form>
          </mat-card-content>
        </ng-container>

        <div class="back-link">
          <a routerLink="/auth/login">Back to Sign In</a>
        </div>
      </mat-card>
    </div>
  `,
})
export class ForgotPasswordComponent implements OnDestroy {
  step = 1;
  loading = false;
  showPwd = false;
  error: string | null = null;
  success: string | null = null;
  resendCountdown = 0;

  emailForm: FormGroup;
  resetForm: FormGroup;

  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.resetForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(8), passwordStrength]],
    });
  }

  sendOtp(): void {
    if (this.emailForm.invalid) return;
    this.loading = true;
    this.error = null;

    this.authService.forgotPassword(this.emailForm.value.email).subscribe({
      next: () => {
        this.loading = false;
        this.step = 2;
        this.startResendCountdown();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Failed to send code. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  doReset(): void {
    if (this.resetForm.invalid) return;
    this.loading = true;
    this.error = null;
    this.success = null;

    const { otp, newPassword } = this.resetForm.value;
    this.authService.resetPassword(this.emailForm.value.email, otp, newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Password reset! Redirecting to login…';
        this.cdr.markForCheck();
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Reset failed. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  resend(): void {
    if (this.resendCountdown > 0) return;
    this.error = null;
    this.loading = true;

    this.authService.forgotPassword(this.emailForm.value.email).subscribe({
      next: () => {
        this.loading = false;
        this.resetForm.reset();
        this.startResendCountdown();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Failed to resend. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  private startResendCountdown(): void {
    this.resendCountdown = 60;
    this.clearTimer();
    this.countdownTimer = setInterval(() => {
      this.resendCountdown--;
      this.cdr.markForCheck();
      if (this.resendCountdown <= 0) this.clearTimer();
    }, 1000);
  }

  private clearTimer(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
