import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface LoanRow {
  id: string;
  name: string;
  balance: number;
  outstanding: number;
  accrued_interest: number;
  total_outstanding: number;
  original_amount: number;
  interest_earned: number;
  days_elapsed: number;
  is_overdue: boolean;
  borrower_email: string | null;
  meta: {
    borrower_name?: string;
    interest_rate?: number;
    compounding?: string;
    loan_date?: string;
    due_date?: string;
    loan_type?: string;
    notes?: string;
    [key: string]: unknown;
  };
}

interface LoanRepayment {
  id: string;
  loan_id: string;
  repayment_type: string;
  repayment_date: string;
  amount_paid: number;
  days: number;
  interest: number;
  principal: number;
  notes: string | null;
}

@Component({
  selector: 'app-my-loans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgFor, NgClass, CurrencyPipe, DatePipe, DecimalPipe, TitleCasePipe, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  styles: [`
    :host { display:block;min-height:100vh;background:#F8FAFC;font-family:'Inter',sans-serif; }

    .top-bar {
      background:white;border-bottom:1px solid #E2E8F0;
      padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between;
      position:sticky;top:0;z-index:10;
    }
    .brand { display:flex;align-items:center;gap:10px;font-weight:700;font-size:1rem;color:#0F172A; }
    .brand mat-icon { color:#3B82F6;font-size:22px;width:22px;height:22px; }
    .logout-btn { font-size:.8125rem; }

    .page { max-width:900px;margin:0 auto;padding:24px 16px; }

    .welcome { margin-bottom:20px; }
    .welcome h1 { font-size:1.375rem;font-weight:700;color:#0F172A;margin:0 0 4px; }
    .welcome p  { font-size:.875rem;color:#64748B;margin:0; }

    .stat-row { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px; }
    .stat-card { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:16px 18px; }
    .stat-lbl  { font-size:.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:4px; }
    .stat-val  { font-size:1.25rem;font-weight:700;color:#0F172A; }
    .stat-val.amber { color:#B45309; }
    .stat-val.green { color:#16A34A; }

    .loan-card { background:white;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:14px;overflow:hidden; }
    .loan-hdr  {
      padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;
      border-bottom:1px solid #F1F5F9;
    }
    .loan-hdr:hover { background:#FAFAFA; }
    .loan-icon { width:36px;height:36px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .loan-icon mat-icon { color:#3B82F6;font-size:18px;width:18px;height:18px; }
    .loan-title { flex:1; }
    .loan-name  { font-size:.9375rem;font-weight:700;color:#0F172A;margin:0 0 2px; }
    .loan-sub   { font-size:.75rem;color:#64748B; }
    .badge-active { background:#DCFCE7;color:#16A34A;font-size:.6875rem;font-weight:700;padding:2px 8px;border-radius:99px; }
    .badge-over   { background:#FEE2E2;color:#DC2626;font-size:.6875rem;font-weight:700;padding:2px 8px;border-radius:99px; }
    .outstanding-box { text-align:right; }
    .out-lbl { font-size:.625rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#92400E; }
    .out-val { font-size:1rem;font-weight:700;color:#B45309; }
    .chevron { color:#94A3B8;transition:transform .2s; }
    .chevron.open { transform:rotate(180deg); }

    .tab-bar { display:flex;border-bottom:1px solid #E2E8F0;background:#F8FAFC; }
    .tab-btn { flex:1;padding:10px;font-size:.8125rem;font-weight:600;color:#64748B;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s; }
    .tab-btn.active { color:#3B82F6;border-bottom-color:#3B82F6;background:white; }

    .details-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:0; }
    .dg-item  { padding:12px 14px;border-right:1px solid #F1F5F9;border-bottom:1px solid #F1F5F9; }
    .dg-label { font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin-bottom:4px; }
    .dg-val   { font-size:.9375rem;font-weight:700;color:#0F172A; }
    .dg-val.amber { color:#B45309; }
    .dg-val.green { color:#16A34A; }

    .repay-wrap { padding:12px 14px; }
    .repay-empty { text-align:center;padding:24px;color:#94A3B8;font-size:.875rem; }
    .repay-spinner { display:flex;justify-content:center;padding:24px; }
    table { width:100%;border-collapse:collapse;font-size:.8125rem; }
    th { text-align:left;padding:6px 10px;font-size:.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#94A3B8;border-bottom:1px solid #E2E8F0; }
    td { padding:8px 10px;border-bottom:1px solid #F1F5F9;color:#374151; }
    td.mono { font-family:monospace; }
    td.green { color:#16A34A;font-weight:600; }
    td.amber { color:#B45309;font-weight:600; }

    .spinner-wrap { display:flex;justify-content:center;padding:80px; }
  `],
  template: `
    <div class="top-bar">
      <div class="brand">
        <mat-icon>account_balance_wallet</mat-icon>
        PWMS · Loan Portal
      </div>
      <button mat-stroked-button class="logout-btn" (click)="logout()">
        <mat-icon style="font-size:16px;width:16px;height:16px;margin-right:4px">logout</mat-icon>
        Sign Out
      </button>
    </div>

    <div class="page">
      <div *ngIf="loading" class="spinner-wrap">
        <mat-spinner diameter="36"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading">
        <div class="welcome">
          <h1>My Loans</h1>
          <p>Read-only view of your loan details and repayment history.</p>
        </div>

        <!-- Stats -->
        <div class="stat-row">
          <div class="stat-card">
            <div class="stat-lbl">Total Loans</div>
            <div class="stat-val">{{ loans.length }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-lbl">Total Outstanding</div>
            <div class="stat-val amber">{{ totalOutstanding | currency:'INR':'symbol-narrow':'1.0-2' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-lbl">Accrued Interest</div>
            <div class="stat-val amber">{{ totalAccrued | currency:'INR':'symbol-narrow':'1.0-2' }}</div>
          </div>
        </div>

        <div *ngIf="loans.length === 0" style="text-align:center;padding:60px 0;color:#94A3B8">
          <mat-icon style="font-size:48px;width:48px;height:48px;display:block;margin:0 auto 12px">handshake</mat-icon>
          No loan records found for your account.
        </div>

        <!-- Loan cards -->
        <div *ngFor="let loan of loans" class="loan-card">
          <div class="loan-hdr" (click)="toggle(loan.id)">
            <div class="loan-icon"><mat-icon>handshake</mat-icon></div>
            <div class="loan-title">
              <div class="loan-name">{{ loan.meta.loan_date | date:'d MMM y' }} — {{ loan.meta.loan_type | titlecase }}</div>
              <div class="loan-sub">{{ loan.meta.interest_rate ?? 0 }}% p.a. · {{ loan.days_elapsed }} days elapsed
                <ng-container *ngIf="loan.meta.due_date"> · Due {{ loan.meta.due_date | date:'d MMM y' }}</ng-container>
              </div>
            </div>
            <span [ngClass]="loan.is_overdue ? 'badge-over' : 'badge-active'">
              {{ loan.is_overdue ? 'Overdue' : 'Active' }}
            </span>
            <div class="outstanding-box">
              <div class="out-lbl">Total Outstanding</div>
              <div class="out-val">{{ loan.total_outstanding | currency:'INR':'symbol-narrow':'1.0-2' }}</div>
            </div>
            <mat-icon class="chevron" [class.open]="expanded.has(loan.id)">expand_more</mat-icon>
          </div>

          <ng-container *ngIf="expanded.has(loan.id)">
            <div class="tab-bar">
              <button class="tab-btn" [class.active]="activeTab(loan.id) === 0" (click)="setTab(loan.id, 0)">Loan Details</button>
              <button class="tab-btn" [class.active]="activeTab(loan.id) === 1" (click)="setTab(loan.id, 1)">Repayments</button>
            </div>

            <!-- Details tab -->
            <div *ngIf="activeTab(loan.id) === 0" class="details-grid">
              <div class="dg-item">
                <div class="dg-label">Original Amount</div>
                <div class="dg-val">{{ loan.original_amount | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Principal Balance</div>
                <div class="dg-val">{{ loan.outstanding | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Accrued Interest</div>
                <div class="dg-val amber">{{ loan.accrued_interest | currency:'INR':'symbol-narrow':'1.2-2' }}</div>
              </div>
              <div class="dg-item" style="background:#FFF7ED">
                <div class="dg-label" style="color:#92400E">Total Outstanding</div>
                <div class="dg-val amber" style="font-size:1rem">{{ loan.total_outstanding | currency:'INR':'symbol-narrow':'1.0-2' }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Interest Paid</div>
                <div class="dg-val green">{{ loan.interest_earned | currency:'INR':'symbol-narrow':'1.2-2' }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Days Elapsed</div>
                <div class="dg-val" [class.amber]="loan.is_overdue">{{ loan.days_elapsed }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Interest Rate</div>
                <div class="dg-val">{{ loan.meta.interest_rate ?? 0 }}% p.a.</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Compounding</div>
                <div class="dg-val" style="font-size:.8125rem">{{ compoundingLabel(loan.meta.compounding) }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Loan Type</div>
                <div class="dg-val" style="text-transform:capitalize">{{ loan.meta.loan_type ?? 'Personal' }}</div>
              </div>
              <div *ngIf="loan.meta.notes" class="dg-item" style="grid-column:1/-1">
                <div class="dg-label">Notes</div>
                <div class="dg-val" style="font-weight:400;font-size:.875rem">{{ loan.meta.notes }}</div>
              </div>
            </div>

            <!-- Repayments tab -->
            <div *ngIf="activeTab(loan.id) === 1">
              <div *ngIf="repaymentLoading.has(loan.id)" class="repay-spinner">
                <mat-spinner diameter="24"></mat-spinner>
              </div>
              <div *ngIf="!repaymentLoading.has(loan.id)">
                <div *ngIf="(repayments.get(loan.id) || []).length === 0" class="repay-empty">
                  No repayments recorded yet.
                </div>
                <div class="repay-wrap" *ngIf="(repayments.get(loan.id) || []).length > 0">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th><th>Amount Paid</th><th>Days</th><th>Interest</th><th>Principal</th><th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let r of repayments.get(loan.id)">
                        <td>{{ r.repayment_date | date:'d MMM y' }}</td>
                        <td class="mono">{{ r.amount_paid | currency:'INR':'symbol-narrow':'1.2-2' }}</td>
                        <td>{{ r.days }}</td>
                        <td class="amber mono">{{ r.interest | number:'1.2-2' }}</td>
                        <td class="green mono">{{ r.principal | number:'1.2-4' }}</td>
                        <td style="color:#64748B">{{ r.notes || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ng-container>
        </div>
      </ng-container>
    </div>
  `,
})
export class MyLoansComponent implements OnInit {
  loading = true;
  loans: LoanRow[] = [];
  expanded  = new Set<string>();
  tabs      = new Map<string, 0 | 1>();
  repayments        = new Map<string, LoanRepayment[]>();
  repaymentLoading  = new Set<string>();
  totalOutstanding  = 0;
  totalAccrued      = 0;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.http.get<{ data: { loans: LoanRow[] } }>(`${environment.apiUrl}/loans/my`).subscribe({
      next: (res) => {
        this.loans = res.data.loans;
        this.totalOutstanding = this.loans.reduce((s, l) => s + Number(l.total_outstanding), 0);
        this.totalAccrued     = this.loans.reduce((s, l) => s + Number(l.accrued_interest), 0);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  toggle(id: string): void {
    if (this.expanded.has(id)) { this.expanded.delete(id); }
    else { this.expanded.add(id); this.setTab(id, 0); }
    this.cdr.markForCheck();
  }

  activeTab(id: string): 0 | 1 { return this.tabs.get(id) ?? 0; }

  setTab(id: string, tab: 0 | 1): void {
    this.tabs.set(id, tab);
    if (tab === 1 && !this.repayments.has(id)) { this.loadRepayments(id); }
    this.cdr.markForCheck();
  }

  private loadRepayments(loanId: string): void {
    this.repaymentLoading.add(loanId);
    this.cdr.markForCheck();
    this.http.get<{ data: { repayments: LoanRepayment[] } }>(`${environment.apiUrl}/loans/my/${loanId}/repayments`).subscribe({
      next: (res) => {
        this.repayments.set(loanId, res.data.repayments);
        this.repaymentLoading.delete(loanId);
        this.cdr.markForCheck();
      },
      error: () => { this.repaymentLoading.delete(loanId); this.cdr.markForCheck(); },
    });
  }

  compoundingLabel(c?: string): string {
    return ({ monthly: 'Monthly (12×/yr)', quarterly: 'Quarterly (4×/yr)', half_yearly: 'Half-yearly (2×/yr)', annually: 'Annually (1×/yr)' } as Record<string, string>)[c ?? 'monthly'] ?? 'Monthly';
  }

  logout(): void {
    this.auth.clearTokens();
    this.router.navigate(['/auth/login']);
  }
}
