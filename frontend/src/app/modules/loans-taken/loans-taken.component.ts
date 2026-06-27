import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { NgFor, NgIf, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { LoansSummaryComponent } from '../loans/loans-summary.component';

interface LoanTaken {
  id: string;
  currency: string;
  is_active: boolean;
  notes: string | null;
  interest_rate: number;
  compounding: string;
  loan_date: string | null;
  due_date: string | null;
  loan_type: string;
  outstanding: number;
  accrued_interest: number;
  total_outstanding: number;
  original_amount: number;
  days_elapsed: number;
  is_overdue: boolean;
  lender_name: string;
  lender_email: string;
}

interface LenderGroup {
  lenderName: string;
  lenderEmail: string;
  loans: LoanTaken[];
  totalOriginal: number;
  totalOutstanding: number;
  hasOverdue: boolean;
}

interface Repayment {
  id: string;
  repayment_date: string;
  amount_paid: number;
  principal: number;
  interest: number;
  notes: string | null;
}

interface ApiResponse<T> { success: boolean; data: T; }

@Component({
  selector: 'app-loans-taken',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor, NgIf, CurrencyPipe, DatePipe, TitleCasePipe,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, LoansSummaryComponent],
  styles: [`
    :host { display: block; }

    .page-header    { margin-bottom: 24px; }
    .page-title     { font-size: 1.5rem; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .page-subtitle  { font-size: 0.875rem; color: #64748B; margin: 0; }

    .spinner-wrap { display: flex; justify-content: center; padding: 60px; }

    .empty-state  { background: white; border-radius: 12px; border: 1px solid #E2E8F0; padding: 60px 24px; text-align: center; }
    .empty-icon   { font-size: 48px; width: 48px; height: 48px; color: #CBD5E1; margin-bottom: 16px; }
    .empty-title  { font-size: 1.125rem; font-weight: 600; color: #475569; margin: 0 0 8px; }
    .empty-desc   { font-size: 0.875rem; color: #94A3B8; margin: 0; }

    /* ── Lender group card ──────────────────────────── */
    .group-card {
      background: white;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
      cursor: pointer;
      user-select: none;
    }
    .group-header:hover { background: #F1F5F9; }

    .lender-avatar {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: linear-gradient(135deg, #8B5CF6, #6D28D9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .lender-info    { flex: 1; min-width: 0; }
    .lender-name    { font-size: 0.9375rem; font-weight: 700; color: #0F172A; }
    .lender-meta    { font-size: 0.8125rem; color: #64748B; margin-top: 2px; }

    .group-totals   { display: flex; gap: 28px; align-items: center; flex-shrink: 0; }

    .total-block    { text-align: right; }
    .total-label    { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8; }
    .total-value    { font-size: 0.9375rem; font-weight: 700; color: #0F172A; margin-top: 2px; }
    .total-value.red   { color: #DC2626; }
    .total-value.green { color: #16A34A; }

    .overdue-badge {
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.625rem;
      font-weight: 700;
      background: #FEE2E2;
      color: #DC2626;
    }

    .count-badge {
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #EFF6FF;
      color: #2563EB;
    }

    .group-chevron { color: #94A3B8; transition: transform 0.2s; flex-shrink: 0; }
    .group-chevron.open { transform: rotate(180deg); }

    /* ── Individual loan rows ───────────────────────── */
    .loan-row { border-bottom: 1px solid #F1F5F9; }
    .loan-row:last-child { border-bottom: none; }

    .loan-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .loan-summary:hover { background: #FAFBFC; }

    .loan-date-badge {
      background: #EFF6FF;
      color: #2563EB;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 0.6875rem;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .loan-info       { flex: 1; min-width: 0; }
    .loan-amount     { font-size: 0.9375rem; font-weight: 700; color: #0F172A; }
    .loan-meta-text  { font-size: 0.75rem; color: #94A3B8; margin-top: 2px; }

    .loan-right      { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

    .loan-outstanding { text-align: right; }
    .lo-label { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; }
    .lo-val   { font-size: 0.9375rem; font-weight: 700; }
    .lo-val.active  { color: #B45309; }
    .lo-val.settled { color: #16A34A; }

    .status-pill {
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .pill-green  { background: #DCFCE7; color: #15803D; }
    .pill-red    { background: #FEE2E2; color: #DC2626; }
    .pill-orange { background: #FEF3C7; color: #D97706; }

    .expand-ic { color: #94A3B8; font-size: 18px; width: 18px; height: 18px; transition: transform 0.15s; flex-shrink: 0; }
    .expand-ic.open { transform: rotate(180deg); }

    /* ── Loan detail panel ──────────────────────────── */
    .loan-detail { background: #FAFBFC; border-top: 1px solid #F1F5F9; }

    .detail-meta {
      display: flex;
      gap: 20px;
      padding: 12px 20px;
      flex-wrap: wrap;
      border-bottom: 1px solid #F1F5F9;
    }
    .meta-item  { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8; }
    .meta-value { font-size: 0.8125rem; font-weight: 500; color: #334155; }
    .meta-value.overdue { color: #DC2626; }

    .repayments-wrap { padding: 14px 20px; }
    .rep-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #475569; margin: 0 0 10px; }
    .rep-loading { text-align: center; padding: 16px; color: #94A3B8; font-size: 0.8125rem; }
    .rep-empty   { font-size: 0.8125rem; color: #94A3B8; }

    table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    th {
      text-align: left; font-size: 0.625rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8;
      padding: 5px 10px 5px 0; border-bottom: 1px solid #E2E8F0;
    }
    td { padding: 9px 10px 9px 0; color: #334155; border-bottom: 1px solid #F1F5F9; }
    tr:last-child td { border-bottom: none; }

    .summary-row {
      display: flex; gap: 16px; padding: 10px 14px;
      background: #F1F5F9; border-radius: 8px; margin-top: 8px; flex-wrap: wrap;
    }
    .summary-item { font-size: 0.8125rem; color: #475569; }
    .summary-item strong { color: #0F172A; }
  `],
  template: `
    <app-loans-summary></app-loans-summary>

    <div class="page-header">
      <h1 class="page-title">Loans Taken</h1>
      <p class="page-subtitle">Loans borrowed from other users in the system</p>
    </div>

    <div *ngIf="loading" class="spinner-wrap">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <div *ngIf="!loading && groups.length === 0" class="empty-state">
      <mat-icon class="empty-icon">account_balance_wallet</mat-icon>
      <p class="empty-title">No loans taken</p>
      <p class="empty-desc">You haven't borrowed any loans from other users yet.</p>
    </div>

    <div *ngFor="let group of groups" class="group-card">

      <!-- Lender group header -->
      <div class="group-header" (click)="toggleGroup(group.lenderEmail)">
        <div class="lender-avatar">{{ group.lenderName.charAt(0).toUpperCase() }}</div>

        <div class="lender-info">
          <div class="lender-name">{{ group.lenderName }}</div>
          <div class="lender-meta">{{ group.lenderEmail }}</div>
        </div>

        <span class="count-badge">{{ group.loans.length }} loan{{ group.loans.length !== 1 ? 's' : '' }}</span>
        <span class="overdue-badge" *ngIf="group.hasOverdue">Overdue</span>

        <div class="group-totals">
          <div class="total-block">
            <div class="total-label">Total Lent</div>
            <div class="total-value">{{ group.totalOriginal | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          </div>
          <div class="total-block">
            <div class="total-label">Total Due</div>
            <div class="total-value" [class.red]="group.totalOutstanding > 0" [class.green]="group.totalOutstanding === 0">
              {{ group.totalOutstanding | currency:'INR':'symbol-narrow':'1.0-0' }}
            </div>
          </div>
        </div>

        <mat-icon class="group-chevron" [class.open]="!collapsed[group.lenderEmail]">expand_more</mat-icon>
      </div>

      <!-- Individual loans (shown unless group is collapsed) -->
      <ng-container *ngIf="!collapsed[group.lenderEmail]">
        <div *ngFor="let loan of group.loans" class="loan-row">

          <div class="loan-summary" (click)="toggleLoan(loan.id)">
            <span class="loan-date-badge" *ngIf="loan.loan_date">{{ loan.loan_date | date:'MMM yyyy' }}</span>

            <div class="loan-info">
              <div class="loan-amount">{{ loan.original_amount | currency:loan.currency:'symbol-narrow':'1.0-0' }}</div>
              <div class="loan-meta-text">
                {{ loan.interest_rate }}% · {{ loan.compounding | titlecase }}
                <ng-container *ngIf="loan.loan_type"> · {{ loan.loan_type | titlecase }}</ng-container>
              </div>
            </div>

            <div class="loan-right">
              <div class="loan-outstanding">
                <div class="lo-label">Outstanding</div>
                <div class="lo-val" [class.active]="loan.outstanding > 0" [class.settled]="loan.outstanding === 0">
                  {{ loan.total_outstanding | currency:loan.currency:'symbol-narrow':'1.0-0' }}
                </div>
              </div>
              <span class="status-pill"
                [class.pill-red]="loan.is_overdue"
                [class.pill-orange]="!loan.is_overdue && loan.outstanding > 0"
                [class.pill-green]="loan.outstanding === 0">
                {{ loan.outstanding === 0 ? 'Settled' : (loan.is_overdue ? 'Overdue' : 'Active') }}
              </span>
              <mat-icon class="expand-ic" [class.open]="expandedLoan[loan.id]">expand_more</mat-icon>
            </div>
          </div>

          <!-- Loan detail + repayments -->
          <div class="loan-detail" *ngIf="expandedLoan[loan.id]">
            <div class="detail-meta">
              <div class="meta-item" *ngIf="loan.due_date">
                <span class="meta-label">Due Date</span>
                <span class="meta-value" [class.overdue]="loan.is_overdue">{{ loan.due_date | date:'dd MMM yyyy' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Days Elapsed</span>
                <span class="meta-value">{{ loan.days_elapsed }} days</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Accrued Interest</span>
                <span class="meta-value">{{ loan.accrued_interest | currency:loan.currency:'symbol-narrow':'1.2-2' }}</span>
              </div>
              <div class="meta-item" *ngIf="loan.notes">
                <span class="meta-label">Notes</span>
                <span class="meta-value">{{ loan.notes }}</span>
              </div>
            </div>

            <div class="repayments-wrap">
              <p class="rep-title">Repayment History</p>

              <div *ngIf="repLoading[loan.id]" class="rep-loading">Loading…</div>

              <div *ngIf="!repLoading[loan.id] && repayments[loan.id]?.length === 0" class="rep-empty">
                No repayments recorded yet.
              </div>

              <table *ngIf="!repLoading[loan.id] && (repayments[loan.id] ?? []).length > 0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount Paid</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of repayments[loan.id]">
                    <td>{{ r.repayment_date | date:'dd MMM yyyy' }}</td>
                    <td>{{ r.amount_paid | currency:loan.currency:'symbol-narrow':'1.2-2' }}</td>
                    <td>{{ r.principal   | currency:loan.currency:'symbol-narrow':'1.2-2' }}</td>
                    <td>{{ r.interest    | currency:loan.currency:'symbol-narrow':'1.2-2' }}</td>
                    <td>{{ r.notes ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="summary-row" *ngIf="!repLoading[loan.id] && (repayments[loan.id] ?? []).length > 0">
                <span class="summary-item">Total paid: <strong>{{ totalPaid(loan.id) | currency:loan.currency:'symbol-narrow':'1.2-2' }}</strong></span>
                <span class="summary-item">Balance remaining: <strong>{{ loan.outstanding | currency:loan.currency:'symbol-narrow':'1.2-2' }}</strong></span>
              </div>
            </div>
          </div>

        </div>
      </ng-container>
    </div>
  `,
})
export class LoansTakenComponent implements OnInit {
  loading = true;
  groups: LenderGroup[] = [];

  collapsed:    Record<string, boolean>    = {};
  expandedLoan: Record<string, boolean>    = {};
  repayments:   Partial<Record<string, Repayment[]>> = {};
  repLoading:   Record<string, boolean>    = {};

  private readonly base = `${environment.apiUrl}/loans`;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.http.get<ApiResponse<{ loans: LoanTaken[] }>>(`${this.base}/my`).subscribe({
      next:  res => { this.groups = this.buildGroups(res.data.loans); this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private buildGroups(loans: LoanTaken[]): LenderGroup[] {
    const map = new Map<string, LenderGroup>();
    for (const loan of loans) {
      const key = loan.lender_email;
      if (!map.has(key)) {
        map.set(key, { lenderName: loan.lender_name, lenderEmail: loan.lender_email,
          loans: [], totalOriginal: 0, totalOutstanding: 0, hasOverdue: false });
      }
      const g = map.get(key)!;
      g.loans.push(loan);
      g.totalOriginal    += loan.original_amount;
      g.totalOutstanding += loan.total_outstanding;
      g.hasOverdue        = g.hasOverdue || loan.is_overdue;
    }
    return Array.from(map.values());
  }

  toggleGroup(email: string): void {
    this.collapsed[email] = !this.collapsed[email];
    this.cdr.markForCheck();
  }

  toggleLoan(id: string): void {
    const opening = !this.expandedLoan[id];
    this.expandedLoan = {};         // collapse all open loans first
    if (opening) {
      this.expandedLoan[id] = true;
      if (!this.repayments[id]) this.loadRepayments(id);
    }
    this.cdr.markForCheck();
  }

  private loadRepayments(loanId: string): void {
    this.repLoading[loanId] = true;
    this.http.get<ApiResponse<{ repayments: Repayment[] }>>(`${this.base}/my/${loanId}/repayments`).subscribe({
      next:  res => { this.repayments[loanId] = res.data.repayments; this.repLoading[loanId] = false; this.cdr.markForCheck(); },
      error: ()  => { this.repayments[loanId] = [];                  this.repLoading[loanId] = false; this.cdr.markForCheck(); },
    });
  }

  totalPaid(loanId: string): number {
    return (this.repayments[loanId] ?? []).reduce((sum, r) => sum + r.amount_paid, 0);
  }
}
