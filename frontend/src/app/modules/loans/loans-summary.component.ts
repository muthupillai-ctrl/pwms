import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

interface LoanItem {
  original_amount: number;
  outstanding: number;
  total_outstanding: number;
  interest_earned?: number;
  accrued_interest: number;
  is_active: boolean;
}

interface ApiResponse<T> { success: boolean; data: T; }

@Component({
  selector: 'app-loans-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, CurrencyPipe, MatIconModule],
  styles: [`
    .summary-bar {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .given-card  { background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border: 1px solid #BBF7D0; }
    .taken-card  { background: linear-gradient(135deg, #FDF4FF 0%, #F3E8FF 100%); border: 1px solid #E9D5FF; }
    .net-card    { background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border: 1px solid #BFDBFE; }

    .card-top {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card-icon {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .given-card  .card-icon { background: rgba(22,163,74,0.12); }
    .taken-card  .card-icon { background: rgba(147,51,234,0.12); }
    .net-card    .card-icon { background: rgba(37,99,235,0.12); }

    .card-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .given-card  .card-icon mat-icon { color: #16A34A; }
    .taken-card  .card-icon mat-icon { color: #9333EA; }
    .net-card    .card-icon mat-icon { color: #2563EB; }

    .card-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .given-card  .card-label { color: #15803D; }
    .taken-card  .card-label { color: #7E22CE; }
    .net-card    .card-label { color: #1D4ED8; }

    .card-count {
      font-size: 0.6875rem;
      margin-top: 1px;
      color: rgba(0,0,0,0.4);
    }

    .stats-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .stat { display: flex; flex-direction: column; gap: 2px; }
    .stat-label { font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: rgba(0,0,0,0.4); }
    .stat-value { font-size: 0.9375rem; font-weight: 700; }

    .given-card  .stat-value { color: #14532D; }
    .taken-card  .stat-value { color: #4B0082; }
    .net-card    .stat-value.positive { color: #1E3A8A; }
    .net-card    .stat-value.negative { color: #991B1B; }

    .full-width { grid-column: 1 / -1; }

    .skeleton { background: rgba(0,0,0,0.06); border-radius: 6px; height: 14px; }
  `],
  template: `
    <div class="summary-bar" *ngIf="loaded">

      <!-- Loans Given -->
      <div class="summary-card given-card">
        <div class="card-top">
          <div class="card-icon"><mat-icon>handshake</mat-icon></div>
          <div>
            <div class="card-label">Loans Given</div>
            <div class="card-count">{{ givenCount }} loan{{ givenCount !== 1 ? 's' : '' }}</div>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat">
            <span class="stat-label">Total Lent</span>
            <span class="stat-value">{{ givenPrincipal | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Outstanding</span>
            <span class="stat-value">{{ givenOutstanding | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Interest Earned</span>
            <span class="stat-value">{{ givenInterest | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Accrued</span>
            <span class="stat-value">{{ givenAccrued | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
          </div>
        </div>
      </div>

      <!-- Loans Taken -->
      <div class="summary-card taken-card">
        <div class="card-top">
          <div class="card-icon"><mat-icon>currency_exchange</mat-icon></div>
          <div>
            <div class="card-label">Loans Taken</div>
            <div class="card-count">{{ takenCount }} loan{{ takenCount !== 1 ? 's' : '' }}</div>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat">
            <span class="stat-label">Total Borrowed</span>
            <span class="stat-value">{{ takenPrincipal | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Outstanding</span>
            <span class="stat-value">{{ takenOutstanding | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Accrued Interest</span>
            <span class="stat-value">{{ takenAccrued | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Total Due (Principal + Interest)</span>
            <span class="stat-value">{{ takenOutstanding + takenAccrued | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
        </div>
      </div>

      <!-- Net Position -->
      <div class="summary-card net-card">
        <div class="card-top">
          <div class="card-icon"><mat-icon>account_balance</mat-icon></div>
          <div>
            <div class="card-label">Net Position</div>
            <div class="card-count">Given minus Taken</div>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat full-width">
            <span class="stat-label">Net Principal</span>
            <span class="stat-value" [class.positive]="netPrincipal >= 0" [class.negative]="netPrincipal < 0">
              {{ netPrincipal | currency:'INR':'symbol-narrow':'1.0-0' }}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Net Outstanding</span>
            <span class="stat-value" [class.positive]="netOutstanding >= 0" [class.negative]="netOutstanding < 0">
              {{ netOutstanding | currency:'INR':'symbol-narrow':'1.0-0' }}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Net Outstanding + Accrued</span>
            <span class="stat-value" [class.positive]="netTotalDue >= 0" [class.negative]="netTotalDue < 0">
              {{ netTotalDue | currency:'INR':'symbol-narrow':'1.0-0' }}
            </span>
          </div>
        </div>
      </div>

    </div>
  `,
})
export class LoansSummaryComponent implements OnInit {
  loaded = false;

  givenCount       = 0;
  givenPrincipal   = 0;
  givenOutstanding = 0;
  givenInterest    = 0;
  givenAccrued     = 0;

  takenCount       = 0;
  takenPrincipal   = 0;
  takenOutstanding = 0;
  takenAccrued     = 0;

  get netPrincipal():   number { return this.givenPrincipal   - this.takenPrincipal; }
  get netOutstanding(): number { return this.givenOutstanding - this.takenOutstanding; }
  get netTotalDue():    number {
    return (this.givenOutstanding + this.givenAccrued) - (this.takenOutstanding + this.takenAccrued);
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const given$ = this.http
      .get<ApiResponse<{ loans: LoanItem[] }>>(`${environment.apiUrl}/loans`)
      .pipe(catchError(() => of(null)));

    const taken$ = this.http
      .get<ApiResponse<{ loans: LoanItem[] }>>(`${environment.apiUrl}/loans/my`)
      .pipe(catchError(() => of(null)));

    forkJoin({ given: given$, taken: taken$ }).subscribe(({ given, taken }) => {
      const givenLoans = given?.data?.loans ?? [];
      const takenLoans = taken?.data?.loans ?? [];

      this.givenCount       = givenLoans.length;
      this.givenPrincipal   = givenLoans.reduce((s, l) => s + (l.original_amount ?? 0), 0);
      this.givenOutstanding = givenLoans.reduce((s, l) => s + (l.outstanding      ?? 0), 0);
      this.givenInterest    = givenLoans.reduce((s, l) => s + (l.interest_earned  ?? 0), 0);
      this.givenAccrued     = givenLoans.reduce((s, l) => s + (l.accrued_interest ?? 0), 0);

      this.takenCount       = takenLoans.length;
      this.takenPrincipal   = takenLoans.reduce((s, l) => s + (l.original_amount ?? 0), 0);
      this.takenOutstanding = takenLoans.reduce((s, l) => s + (l.outstanding     ?? 0), 0);
      this.takenAccrued     = takenLoans.reduce((s, l) => s + (l.accrued_interest ?? 0), 0);

      this.loaded = true;
      this.cdr.markForCheck();
    });
  }
}
