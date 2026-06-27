import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgIf } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-mfa',
  standalone: true,
  imports: [
    ReactiveFormsModule, NgIf,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatProgressSpinnerModule, MatCardModule, MatIconModule,
  ],
  styles: [`
    .mfa-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    }
    .mfa-card { width: 100%; max-width: 380px; padding: 8px; }
    .mfa-header { text-align: center; padding: 24px 24px 0; }
    .brand-icon { font-size: 48px; width: 48px; height: 48px; color: #38bdf8; }
    h1 { margin: 12px 0 4px; font-size: 1.5rem; font-weight: 600; }
    p  { color: #6b7280; margin: 0 0 24px; font-size: 0.875rem; }
    mat-form-field { width: 100%; }
    .error-msg { color: #dc2626; font-size: 0.875rem; text-align: center; }
  `],
  template: `
    <div class="mfa-page">
      <mat-card class="mfa-card">
        <div class="mfa-header">
          <mat-icon class="brand-icon">security</mat-icon>
          <h1>Two-factor auth</h1>
          <p>Enter the 6-digit code from your authenticator app</p>
        </div>

        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Authentication Code</mat-label>
              <input matInput formControlName="token" maxlength="6" autocomplete="one-time-code"
                     placeholder="000000" inputmode="numeric" />
              <mat-error *ngIf="form.get('token')?.hasError('required')">Code is required</mat-error>
              <mat-error *ngIf="form.get('token')?.hasError('pattern')">Must be 6 digits</mat-error>
            </mat-form-field>

            <p *ngIf="error" class="error-msg">{{ error }}</p>

            <button mat-flat-button color="primary" type="submit" style="width:100%;margin-top:8px" [disabled]="loading || form.invalid">
              <mat-spinner *ngIf="loading" diameter="20" style="display:inline-block;margin-right:8px"></mat-spinner>
              {{ loading ? 'Verifying…' : 'Verify' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class MfaComponent {
  form: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      token: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;

    this.authService.verifyMfa(this.form.value.token).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/dashboard']); },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error?.message ?? 'Invalid code. Please try again.';
      },
    });
  }
}
