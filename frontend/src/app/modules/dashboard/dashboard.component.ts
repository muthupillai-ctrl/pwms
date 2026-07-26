import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ApexNonAxisChartSeries, ApexChart, ApexDataLabels, ApexLegend, ApexTooltip, ApexPlotOptions, ApexResponsive } from 'ng-apexcharts';
import { HttpClient } from '@angular/common/http';
import { PortfolioService } from '../../core/services/portfolio.service';
import { AccountsService } from '../../core/services/accounts.service';
import { PortfolioSummary, ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from '../../shared/models/portfolio.models';
import { Account } from '../../shared/models/accounts.models';
import { environment } from '../../../environments/environment';

interface LoanTaken {
  id: string;
  original_amount: number;
  outstanding: number;
  total_outstanding: number;
  accrued_interest: number;
  currency: string;
  loan_date: string | null;
  due_date: string | null;
  is_overdue: boolean;
  lender_name: string;
  lender_email: string;
}

interface ApiResponse<T> { success: boolean; data: T; }

const ASSET_TYPES = ['bank','fixed_deposit','stocks','mutual_fund','bond','loan_given','sip','cash','other'] as const;

const TYPE_ICONS: Record<string, string> = {
  bank: 'account_balance', fixed_deposit: 'savings', stocks: 'show_chart',
  mutual_fund: 'trending_up', bond: 'receipt_long', loan_given: 'handshake',
  liability: 'credit_card', cash: 'payments', other: 'category',
};

// Compact Indian-scale currency (₹3.1Cr, ₹85L) - the full digit-grouped value
// overflows the donut chart's center label on narrow screens.
function formatCompactINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return '₹' + (n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, '') + 'Cr';
  if (abs >= 1_00_000)    return '₹' + (n / 1_00_000).toFixed(2).replace(/\.?0+$/, '') + 'L';
  if (abs >= 1_000)       return '₹' + (n / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const TYPE_BADGE: Record<string, string> = {
  bank: 'badge-blue', fixed_deposit: 'badge-purple', stocks: 'badge-green',
  mutual_fund: 'badge-cyan', bond: 'badge-amber', loan_given: 'badge-green',
  liability: 'badge-red', cash: 'badge-gray', other: 'badge-gray',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgFor, CurrencyPipe, DatePipe, RouterLink,
    MatProgressSpinnerModule, MatIconModule, MatButtonModule, NgApexchartsModule],
  styles: [`
    /* ── Hero ─────────────────────────────────────────── */
    .hero {
      background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
      border-radius: 16px;
      padding: 28px 32px 24px;
      color: white;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }

    @media (max-width: 768px) {
      .hero { padding: 20px 18px 18px; border-radius: 12px; }
      .hero-amount { font-size: 2rem; }
      .hero-stats { grid-template-columns: 1fr 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      .loans-taken-summary { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 480px) {
      .hero-stats { grid-template-columns: 1fr; }
      .loans-taken-summary { grid-template-columns: 1fr; }
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 200px; height: 200px;
      background: rgba(59,130,246,0.12);
      border-radius: 50%;
    }
    .hero::after {
      content: '';
      position: absolute;
      bottom: -40px; left: 30%;
      width: 160px; height: 160px;
      background: rgba(99,102,241,0.08);
      border-radius: 50%;
    }

    .hero-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 6px;
    }

    .hero-amount {
      font-size: 2.75rem;
      font-weight: 700;
      letter-spacing: -1.5px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .hero-date {
      font-size: 0.8125rem;
      color: rgba(255,255,255,0.4);
      margin-bottom: 24px;
    }

    .hero-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }

    .hero-stat {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 14px 16px;
    }

    .hero-stat-label {
      font-size: 0.6875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 6px;
    }

    .hero-stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .hero-stat-value.positive { color: #4ADE80; }
    .hero-stat-value.negative { color: #F87171; }

    /* ── Grid layout ────────────────────────────────── */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    /* ── Chart card ─────────────────────────────────── */
    .chart-card { padding: 20px 24px 8px; }

    /* ── Breakdown card ─────────────────────────────── */
    .breakdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #F1F5F9;
    }
    .breakdown-item:last-child { border-bottom: none; }

    .breakdown-left { display: flex; align-items: center; gap: 10px; }

    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .breakdown-label {
      font-size: 0.875rem;
      color: #374151;
      font-weight: 500;
    }

    .breakdown-count {
      font-size: 0.6875rem;
      color: #94A3B8;
      margin-left: 4px;
    }

    .breakdown-value {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
    }

    /* ── Accounts card ──────────────────────────────── */
    .accounts-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .account-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #F8FAFC;
      cursor: default;
      transition: background 0.1s;
      border-radius: 8px;
    }
    .account-row:last-child { border-bottom: none; }

    .acc-icon {
      width: 38px; height: 38px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .acc-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .acc-info   { flex: 1; min-width: 0; }
    .acc-name   { font-size: 0.875rem; font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .acc-meta   { font-size: 0.75rem; color: #94A3B8; margin-top: 2px; }
    .acc-amount { font-size: 0.9375rem; font-weight: 700; color: #0F172A; text-align: right; }
    .acc-ccy    { font-size: 0.6875rem; color: #94A3B8; text-align: right; margin-top: 1px; }

    /* ── Misc ───────────────────────────────────────── */
    .section-title { font-size: 0.9375rem; font-weight: 700; color: #0F172A; margin: 0; }
    .see-all { font-size: 0.8125rem; font-weight: 600; color: #3B82F6; text-decoration: none; }
    .see-all:hover { text-decoration: underline; }

    .empty-msg { text-align: center; padding: 40px 0; color: #94A3B8; font-size: 0.875rem; }

    .spinner-wrap { display: flex; justify-content: center; align-items: center; padding: 100px 0; }

    /* ── Welcome / no-data state ────────────────────── */
    .welcome-state {
      text-align: center;
      padding: 64px 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
      border-radius: 16px;
      border: 1px dashed #CBD5E1;
      margin-bottom: 16px;
    }
    .welcome-icon {
      width: 64px; height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e3a5f, #3B82F6);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .welcome-icon mat-icon { font-size: 30px; width: 30px; height: 30px; color: white; }
    .welcome-title { font-size: 1.125rem; font-weight: 700; color: #0F172A; margin: 0 0 8px; }
    .welcome-text {
      font-size: 0.875rem; color: #64748B; line-height: 1.5;
      max-width: 380px; margin: 0 auto 24px;
    }

    /* ── Loans Taken card ───────────────────────────────── */
    .loan-taken-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #F8FAFC;
    }
    .loan-taken-row:last-child { border-bottom: none; }

    .lender-avatar {
      width: 38px; height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #8B5CF6, #6D28D9);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.875rem; font-weight: 700; color: white;
      flex-shrink: 0;
    }

    .lender-info   { flex: 1; min-width: 0; }
    .lender-name   { font-size: 0.875rem; font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lender-meta   { font-size: 0.75rem; color: #94A3B8; margin-top: 2px; }

    .loan-amounts  { text-align: right; flex-shrink: 0; }
    .loan-original { font-size: 0.75rem; color: #94A3B8; }
    .loan-due      { font-size: 0.9375rem; font-weight: 700; color: #DC2626; }
    .loan-settled  { font-size: 0.9375rem; font-weight: 700; color: #16A34A; }

    .overdue-pill {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 20px;
      font-size: 0.625rem;
      font-weight: 700;
      background: #FEE2E2;
      color: #DC2626;
      margin-left: 6px;
    }

    .loans-taken-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
      padding: 14px;
      background: #FDF4FF;
      border-radius: 10px;
      border: 1px solid #E9D5FF;
    }
    .lt-stat { display: flex; flex-direction: column; gap: 2px; }
    .lt-stat-label { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #7E22CE; }
    .lt-stat-value { font-size: 1rem; font-weight: 700; color: #4B0082; }
  `],
  template: `
    <div *ngIf="loading" class="spinner-wrap">
      <mat-spinner diameter="44"></mat-spinner>
    </div>

    <ng-container *ngIf="!loading && summary">

      <!-- ── Welcome / no-data state ────────────────── -->
      <div class="welcome-state" *ngIf="isEmpty">
        <div class="welcome-icon"><mat-icon>account_balance_wallet</mat-icon></div>
        <p class="welcome-title">Welcome to your dashboard</p>
        <p class="welcome-text">
          You haven't added any accounts, fixed deposits, bonds, or other assets yet.
          Add your first account to start tracking your net worth.
        </p>
        <a routerLink="/accounts" mat-flat-button color="primary">
          <mat-icon>add</mat-icon> Add your first account
        </a>
      </div>

      <ng-container *ngIf="!isEmpty">

      <!-- ── Hero: net worth ──────────────────────── -->
      <div class="hero">
        <div class="hero-label">Total Net Worth</div>
        <div class="hero-amount">{{ adjustedNetWorth | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        <div class="hero-date">Updated {{ summary.asOf | date:'d MMM y, h:mm a' }}</div>

        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-label">Total Assets</div>
            <div class="hero-stat-value positive">{{ summary.totalAssets | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-label">Total Liabilities</div>
            <div class="hero-stat-value negative">{{ adjustedLiabilities | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-label">FD Maturity Value</div>
            <div class="hero-stat-value">{{ summary.breakdown.fixed_deposit.maturityValue | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          </div>
        </div>
      </div>

      <!-- ── Chart + Breakdown ─────────────────────── -->
      <div class="grid-2">

        <!-- Donut chart -->
        <div class="card chart-card">
          <p class="section-title" style="margin-bottom:4px">Asset Allocation</p>
          <p style="font-size:0.8125rem;color:#94A3B8;margin:0 0 8px">By account type</p>
          <apx-chart *ngIf="chart.series.length"
            [series]="chart.series" [chart]="chart.config" [labels]="chart.labels"
            [colors]="chart.colors" [legend]="chart.legend" [dataLabels]="chart.dataLabels"
            [tooltip]="chart.tooltip" [plotOptions]="chart.plotOptions">
          </apx-chart>
          <div *ngIf="!chart.series.length" class="empty-msg">No data yet</div>
        </div>

        <!-- Breakdown list -->
        <div class="card" style="padding:20px 24px">
          <p class="section-title" style="margin-bottom:16px">Breakdown by Type</p>
          <div *ngFor="let item of breakdown" class="breakdown-item">
            <div class="breakdown-left">
              <div class="dot" [style.background]="item.color"></div>
              <span class="breakdown-label">{{ item.label }}</span>
              <span class="breakdown-count" *ngIf="item.count > 0">({{ item.count }})</span>
            </div>
            <span class="breakdown-value">{{ item.balance | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <!-- Loans Taken liability row -->
          <ng-container *ngIf="loansTakenLoaded && loansTaken.length > 0">
            <div class="breakdown-item" style="border-top: 1px dashed #E2E8F0; margin-top:4px; padding-top:12px">
              <div class="breakdown-left">
                <div class="dot" style="background:#9333EA"></div>
                <span class="breakdown-label">Loans Taken</span>
                <span class="breakdown-count">({{ loansTaken.length }})</span>
              </div>
              <span class="breakdown-value" style="color:#DC2626">−{{ loansTakenTotalDue | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
            </div>
          </ng-container>
        </div>

      </div>

      <!-- ── Accounts list ─────────────────────────── -->
      <div class="card" style="padding:20px 24px">
        <div class="accounts-header">
          <div>
            <p class="section-title">Bank Accounts</p>
            <p style="font-size:0.8125rem;color:#94A3B8;margin:2px 0 0">{{ accounts.length }} account{{ accounts.length !== 1 ? 's' : '' }}</p>
          </div>
          <a routerLink="/accounts" class="see-all">View all →</a>
        </div>

        <div *ngIf="accounts.length === 0" class="empty-msg">
          No bank accounts yet. <a routerLink="/accounts" style="color:#3B82F6">Add your first account</a>
        </div>

        <div *ngFor="let acc of accounts.slice(0, 8)" class="account-row">
          <div class="acc-icon" [style.background]="typeColor(acc.account_type) + '18'">
            <mat-icon [style.color]="typeColor(acc.account_type)">{{ typeIcon(acc.account_type) }}</mat-icon>
          </div>
          <div class="acc-info">
            <div class="acc-name">{{ acc.name }}</div>
            <div class="acc-meta">
              {{ typeLabel(acc.account_type) }}<ng-container *ngIf="acc.institution"> · {{ acc.institution }}</ng-container>
            </div>
          </div>
          <div>
            <div class="acc-amount">{{ acc.balance | currency:acc.currency:'symbol-narrow':'1.2-2' }}</div>
            <div class="acc-ccy">{{ acc.currency }}</div>
          </div>
        </div>
      </div>

      </ng-container>

    </ng-container>

    <!-- ── Loans Taken (independent of portfolio load) ── -->
    <div class="card" style="padding:20px 24px;margin-top:16px">
      <div class="accounts-header">
        <div>
          <p class="section-title">Loans Taken</p>
          <p style="font-size:0.8125rem;color:#94A3B8;margin:2px 0 0">
            <ng-container *ngIf="loansTakenLoaded">
              {{ loansTaken.length }} loan{{ loansTaken.length !== 1 ? 's' : '' }} borrowed from others
            </ng-container>
          </p>
        </div>
        <a routerLink="/loans-taken" class="see-all">View all →</a>
      </div>

      <div *ngIf="!loansTakenLoaded" style="display:flex;justify-content:center;padding:32px 0">
        <mat-spinner diameter="28"></mat-spinner>
      </div>

      <div *ngIf="loansTakenLoaded && loansTaken.length === 0" class="empty-msg">
        No loans taken yet.
      </div>

      <ng-container *ngIf="loansTakenLoaded && loansTaken.length > 0">
        <div class="loans-taken-summary">
          <div class="lt-stat">
            <span class="lt-stat-label">Total Borrowed</span>
            <span class="lt-stat-value">{{ loansTakenPrincipal | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="lt-stat">
            <span class="lt-stat-label">Outstanding</span>
            <span class="lt-stat-value">{{ loansTakenOutstanding | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="lt-stat">
            <span class="lt-stat-label">Total Due</span>
            <span class="lt-stat-value">{{ loansTakenTotalDue | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
          </div>
        </div>

        <div *ngFor="let loan of loansTaken.slice(0, 5)" class="loan-taken-row">
          <div class="lender-avatar">{{ loan.lender_name.charAt(0).toUpperCase() }}</div>
          <div class="lender-info">
            <div class="lender-name">
              {{ loan.lender_name }}
              <span class="overdue-pill" *ngIf="loan.is_overdue">Overdue</span>
            </div>
            <div class="lender-meta">
              {{ loan.lender_email }}
              <ng-container *ngIf="loan.loan_date"> · since {{ loan.loan_date | date:'MMM yyyy' }}</ng-container>
            </div>
          </div>
          <div class="loan-amounts">
            <div class="loan-original">of {{ loan.original_amount | currency:loan.currency:'symbol-narrow':'1.0-0' }}</div>
            <div [class.loan-due]="loan.outstanding > 0" [class.loan-settled]="loan.outstanding === 0">
              {{ loan.total_outstanding | currency:loan.currency:'symbol-narrow':'1.0-0' }} due
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  loading = true;
  summary: PortfolioSummary | null = null;
  accounts: Account[] = [];
  breakdown: { label: string; balance: number; count: number; color: string }[] = [];

  loansTaken: LoanTaken[]   = [];
  loansTakenLoaded          = false;
  loansTakenPrincipal       = 0;
  loansTakenOutstanding     = 0;
  loansTakenTotalDue        = 0;

  chart: {
    series: ApexNonAxisChartSeries;
    config: ApexChart;
    labels: string[];
    colors: string[];
    legend: ApexLegend;
    dataLabels: ApexDataLabels;
    tooltip: ApexTooltip;
    plotOptions: ApexPlotOptions;
  } = {
    series: [], labels: [], colors: [],
    config: { type: 'donut', height: 260, fontFamily: 'Inter, sans-serif' },
    legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Inter, sans-serif',
      markers: { size: 6 } as any },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: '68%', labels: { show: true,
      total: { show: true, label: 'Total', fontSize: '13px', fontWeight: 600,
        formatter: (w: any) => {
          const t = (w.globals.seriesTotals as number[]).reduce((a, b) => a + b, 0);
          return formatCompactINR(t);
        }
      }
    }}}},
    tooltip: { y: { formatter: (v: number) => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }) } },
  };

  constructor(
    private portfolioService: PortfolioService,
    private accountsService: AccountsService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    Promise.all([
      this.portfolioService.getSummary().toPromise(),
      this.accountsService.list().toPromise(),
    ]).then(([summary, accounts]) => {
      this.summary  = summary!;
      this.accounts = accounts ?? [];
      this.buildBreakdown();
      this.buildChart();
      this.loading = false;
      this.cdr.markForCheck();
    }).catch(() => {
      this.loading = false;
      this.cdr.markForCheck();
    });

    this.http.get<ApiResponse<{ loans: LoanTaken[] }>>(`${environment.apiUrl}/loans/my`)
      .subscribe({
        next: res => {
          this.loansTaken           = res.data.loans;
          this.loansTakenPrincipal  = this.loansTaken.reduce((s, l) => s + l.original_amount,  0);
          this.loansTakenOutstanding= this.loansTaken.reduce((s, l) => s + l.outstanding,       0);
          this.loansTakenTotalDue   = this.loansTaken.reduce((s, l) => s + l.total_outstanding, 0);
          this.loansTakenLoaded     = true;
          this.cdr.markForCheck();
        },
        error: () => { this.loansTakenLoaded = true; this.cdr.markForCheck(); },
      });
  }

  get adjustedLiabilities(): number {
    return (this.summary?.totalLiabilities ?? 0) + this.loansTakenTotalDue;
  }

  get adjustedNetWorth(): number {
    return (this.summary?.netWorth ?? 0) - this.loansTakenTotalDue;
  }

  get isEmpty(): boolean {
    return !!this.summary
      && this.summary.totalAssets === 0
      && this.summary.totalLiabilities === 0
      && this.accounts.length === 0;
  }

  private buildBreakdown(): void {
    if (!this.summary) return;
    this.breakdown = Object.entries(this.summary.breakdown).map(([k, v]) => ({
      label: ASSET_TYPE_LABELS[k] ?? k, balance: v.balance,
      count: v.count, color: ASSET_TYPE_COLORS[k] ?? '#9ca3af',
    }));
  }

  private buildChart(): void {
    if (!this.summary) return;
    const entries = ASSET_TYPES
      .map(t => ({ label: ASSET_TYPE_LABELS[t], balance: this.summary!.breakdown[t].balance, color: ASSET_TYPE_COLORS[t] }))
      .filter(e => e.balance > 0);
    this.chart = { ...this.chart, series: entries.map(e => e.balance), labels: entries.map(e => e.label), colors: entries.map(e => e.color) };
  }

  typeColor(t: string): string { return ASSET_TYPE_COLORS[t] ?? '#9ca3af'; }
  typeLabel(t: string): string { return ASSET_TYPE_LABELS[t] ?? t; }
  typeIcon(t: string):  string { return TYPE_ICONS[t]  ?? 'category'; }
}
