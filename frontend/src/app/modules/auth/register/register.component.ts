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
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, NgIf,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatProgressSpinnerModule, MatCardModule, MatIconModule,
  ],
  styles: [`
    .register-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    }
    .register-card { width: 100%; max-width: 440px; padding: 8px; }
    .register-header { text-align: center; padding: 24px 24px 0; }
    .brand-icon { font-size: 48px; width: 48px; height: 48px; color: #38bdf8; }
    h1 { margin: 12px 0 4px; font-size: 1.5rem; font-weight: 600; }
    p.subtitle { color: #6b7280; margin: 0 0 24px; font-size: 0.875rem; }
    mat-form-field { width: 100%; }
    .error-msg { color: #dc2626; font-size: 0.875rem; text-align: center; margin-bottom: 8px; }
    .login-link { text-align: center; margin-top: 16px; font-size: 0.875rem; color: #6b7280; }
    .otp-hint { font-size: 0.8125rem; color: #6b7280; text-align: center; margin-bottom: 16px; }
    .otp-input input { font-size: 1.5rem; letter-spacing: 0.35em; text-align: center; }
    .resend-row { text-align: center; margin-top: 8px; font-size: 0.8125rem; color: #6b7280; }
    .resend-row button { font-size: 0.8125rem; color: #3b82f6; background: none; border: none; cursor: pointer; padding: 0; }
    .resend-row button:disabled { color: #9ca3af; cursor: default; }
  `],
  template: `
    <div class="register-page">
      <mat-card class="register-card">
        <div class="register-header">
          <mat-icon class="brand-icon">account_balance_wallet</mat-icon>

          <!-- Step 1 -->
          <ng-container *ngIf="step === 1">
            <h1>Create account</h1>
            <p class="subtitle">Start managing your wealth with PWMS</p>
          </ng-container>

          <!-- Step 2 -->
          <ng-container *ngIf="step === 2">
            <h1>Verify your email</h1>
            <p class="subtitle">We sent a 6-digit code to <strong>{{ pendingEmail }}</strong></p>
          </ng-container>
        </div>

        <mat-card-content>

          <!-- ── Step 1: Registration form ── -->
          <form *ngIf="step === 1" [formGroup]="regForm" (ngSubmit)="sendOtp()">
            <mat-form-field appearance="outline">
              <mat-label>Full Name</mat-label>
              <input matInput formControlName="fullName" autocomplete="name" />
              <mat-error *ngIf="regForm.get('fullName')?.hasError('required')">Full name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              <mat-error *ngIf="regForm.get('email')?.hasError('email')">Enter a valid email</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput [type]="showPwd ? 'text' : 'password'" formControlName="password" autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" (click)="showPwd = !showPwd">
                <mat-icon>{{ showPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="regForm.get('password')?.hasError('minlength')">Min 8 characters</mat-error>
              <mat-error *ngIf="regForm.get('password')?.hasError('pattern')">Must contain uppercase, lowercase, number &amp; special char</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Phone (optional)</mat-label>
              <input matInput formControlName="phone" autocomplete="tel" />
            </mat-form-field>

            <p *ngIf="error" class="error-msg">{{ error }}</p>

            <button mat-flat-button color="primary" type="submit" style="width:100%;margin-top:8px"
                    [disabled]="loading || regForm.invalid">
              <mat-spinner *ngIf="loading" diameter="20" style="display:inline-block;margin-right:8px"></mat-spinner>
              {{ loading ? 'Sending code…' : 'Continue' }}
            </button>
          </form>

          <!-- ── Step 2: OTP entry ── -->
          <form *ngIf="step === 2" [formGroup]="otpForm" (ngSubmit)="verifyOtp()">
            <p class="otp-hint">Enter the code below — it expires in 10 minutes.</p>

            <mat-form-field appearance="outline" class="otp-input">
              <mat-label>6-digit code</mat-label>
              <input matInput formControlName="otp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
              <mat-error *ngIf="otpForm.get('otp')?.hasError('required')">Code is required</mat-error>
              <mat-error *ngIf="otpForm.get('otp')?.hasError('pattern') || otpForm.get('otp')?.hasError('minlength')">Enter the 6-digit code</mat-error>
            </mat-form-field>

            <p *ngIf="error" class="error-msg">{{ error }}</p>

            <button mat-flat-button color="primary" type="submit" style="width:100%;margin-top:8px"
                    [disabled]="loading || otpForm.invalid">
              <mat-spinner *ngIf="loading" diameter="20" style="display:inline-block;margin-right:8px"></mat-spinner>
              {{ loading ? 'Verifying…' : 'Verify & Create Account' }}
            </button>

            <div class="resend-row">
              Didn't receive it?
              <button type="button" (click)="resendOtp()" [disabled]="resendCooldown > 0">
                {{ resendCooldown > 0 ? 'Resend in ' + resendCooldown + 's' : 'Resend code' }}
              </button>
              &nbsp;|&nbsp;
              <button type="button" (click)="step = 1; error = null">Change email</button>
            </div>
          </form>

        </mat-card-content>

        <div class="login-link">
          Already have an account? <a routerLink="/auth/login">Sign in</a>
        </div>
      </mat-card>
    </div>
  `,
})
export class RegisterComponent {
  step = 1;
  regForm: FormGroup;
  otpForm: FormGroup;
  loading = false;
  showPwd = false;
  error: string | null = null;
  pendingEmail = '';
  resendCooldown = 0;

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.regForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      ]],
      phone: [''],
    });

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6),
        Validators.pattern(/^\d{6}$/)
      ]],
    });
  }

  sendOtp(): void {
    if (this.regForm.invalid) return;
    this.loading = true;
    this.error = null;

    const { fullName, email, password, phone } = this.regForm.value;
    this.authService.initiateRegister({ fullName, email, password, phone: phone || undefined }).subscribe({
      next: () => {
        this.loading = false;
        this.pendingEmail = email;
        this.step = 2;
        this.startCooldown(60);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Failed to send code. Please try again.';
      },
    });
  }

  verifyOtp(): void {
    if (this.otpForm.invalid) return;
    this.loading = true;
    this.error = null;

    this.authService.verifyRegisterOtp(this.pendingEmail, this.otpForm.value.otp).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Verification failed. Please try again.';
      },
    });
  }

  resendOtp(): void {
    if (this.resendCooldown > 0) return;
    const { fullName, email, password, phone } = this.regForm.value;
    this.loading = true;
    this.error = null;

    this.authService.initiateRegister({ fullName, email, password, phone: phone || undefined }).subscribe({
      next: () => {
        this.loading = false;
        this.otpForm.reset();
        this.startCooldown(60);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Failed to resend code. Please try again.';
      },
    });
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown = seconds;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0 && this.cooldownTimer) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }, 1000);
  }
}
