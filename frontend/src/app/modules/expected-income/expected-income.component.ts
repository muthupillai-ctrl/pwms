import {
  Component, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BondPayout {
  payout_date: string;
  interest_payout: number;
  tds: number;
  principal_amount: number;
  total_payout: number;
  frequency: string;
}

interface BondRow {
  id: string;
  name: string;
  payouts: BondPayout[];
}

interface MonthGroup {
  monthKey: string;   // "2026-07"
  label: string;      // "July 2026"
  isPast: boolean;
  bonds: number;
  total: number;
}

type Range = '3M' | '6M' | '12M' | 'All';

// ── Helpers ────────────────────────────────────────────────────────────────────

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function thisMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(key: string, n: number): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-expected-income',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgFor, CurrencyPipe, MatProgressSpinnerModule, MatIconModule],
  styles: [`
    :host { display:block;padding:24px;background:#F8FAFC;min-height:100%; }

    .spinner-wrap { display:flex;justify-content:center;padding:80px; }

    /* Header */
    .page-hdr  { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px; }
    .page-title { font-size:1.125rem;font-weight:700;color:#0F172A; }

    /* Range toggle */
    .range-bar { display:flex;gap:4px; }
    .range-btn {
      padding:5px 14px;border-radius:7px;border:1.5px solid #E2E8F0;
      background:white;font-size:.8125rem;font-weight:600;color:#64748B;
      cursor:pointer;transition:all .12s;
    }
    .range-btn.active {
      background:#1D4ED8;border-color:#1D4ED8;color:white;
    }
    .range-btn:hover:not(.active) { border-color:#94A3B8;color:#0F172A; }

    /* Summary strip */
    .summary-strip {
      display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;
    }
    @media (max-width: 640px) {
      :host { padding: 16px; }
      .summary-strip { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 400px) {
      .summary-strip { grid-template-columns: 1fr; }
    }
    .sum-card {
      background:white;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px;
    }
    .sum-lbl { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .sum-val { font-size:1.375rem;font-weight:700;letter-spacing:-.5px; }
    .sum-val.green { color:#16A34A; }
    .sum-val.blue  { color:#1D4ED8; }
    .sum-val.amber { color:#B45309; }

    /* Month cards */
    .month-card {
      background:white;border:1px solid #E2E8F0;border-radius:12px;
      overflow:hidden;margin-bottom:12px;
    }
    .month-card.past { opacity:.55; }

    .month-hdr {
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;
    }
    .month-name { font-size:.875rem;font-weight:700;color:#0F172A; }
    .past-badge {
      font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
      padding:2px 8px;border-radius:20px;background:#F1F5F9;color:#94A3B8;
    }
    .future-badge {
      font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
      padding:2px 8px;border-radius:20px;background:#EFF6FF;color:#1D4ED8;
    }

    /* Source rows */
    .source-row {
      display:flex;align-items:center;gap:10px;
      padding:10px 16px;border-bottom:1px solid #F1F5F9;
    }
    .source-icon {
      width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .source-icon.bond { background:rgba(180,83,9,.1); }
    .source-icon.bond mat-icon { color:#B45309;font-size:15px;width:15px;height:15px; }
    .source-lbl { flex:1;font-size:.8125rem;font-weight:500;color:#374151; }
    .source-val { font-size:.875rem;font-weight:600;color:#0F172A;font-family:monospace; }

    /* Total row */
    .total-row {
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 16px;background:#F0FDF4;
    }
    .total-lbl { font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#15803D; }
    .total-val { font-size:1rem;font-weight:700;color:#15803D;font-family:monospace; }

    /* Empty */
    .empty { text-align:center;padding:60px 0; }
    .empty mat-icon { font-size:48px;width:48px;height:48px;color:#CBD5E1;display:block;margin:0 auto 12px; }
    .empty p { color:#94A3B8;margin:0; }
  `],
  template: `
    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>

    <ng-container *ngIf="!loading">

      <!-- Header -->
      <div class="page-hdr">
        <span class="page-title">Expected Income</span>
        <div class="range-bar">
          <button class="range-btn" [class.active]="range==='3M'"  (click)="setRange('3M')">3M</button>
          <button class="range-btn" [class.active]="range==='6M'"  (click)="setRange('6M')">6M</button>
          <button class="range-btn" [class.active]="range==='12M'" (click)="setRange('12M')">12M</button>
          <button class="range-btn" [class.active]="range==='All'" (click)="setRange('All')">All</button>
        </div>
      </div>

      <!-- Summary strip -->
      <div class="summary-strip">
        <div class="sum-card">
          <div class="sum-lbl">Months Shown</div>
          <div class="sum-val blue">{{ visible.length }}</div>
        </div>
        <div class="sum-card">
          <div class="sum-lbl">Bond Interest (Net)</div>
          <div class="sum-val amber">{{ totalBonds | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="sum-card">
          <div class="sum-lbl">Total Expected</div>
          <div class="sum-val green">{{ grandTotal | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="visible.length === 0" class="empty">
        <mat-icon>event_note</mat-icon>
        <p>No income data for this period.</p>
      </div>

      <!-- Month cards -->
      <div *ngFor="let m of visible" class="month-card" [class.past]="m.isPast">
        <div class="month-hdr">
          <span class="month-name">{{ m.label }}</span>
          <span [class]="m.isPast ? 'past-badge' : 'future-badge'">
            {{ m.isPast ? 'Past' : 'Expected' }}
          </span>
        </div>

        <!-- Bonds row -->
        <div *ngIf="m.bonds > 0" class="source-row">
          <div class="source-icon bond"><mat-icon>receipt_long</mat-icon></div>
          <span class="source-lbl">Bonds</span>
          <span class="source-val">{{ m.bonds | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
        </div>

        <!-- Total -->
        <div class="total-row">
          <span class="total-lbl">Total</span>
          <span class="total-val">{{ m.total | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
        </div>
      </div>

    </ng-container>
  `,
})
export class ExpectedIncomeComponent implements OnInit {
  loading = true;
  range: Range = '3M';

  allGroups: MonthGroup[] = [];
  visible:   MonthGroup[] = [];

  totalBonds  = 0;
  grandTotal  = 0;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.http.get<{ data: { bonds: BondRow[] } }>(`${environment.apiUrl}/bonds`).subscribe({
      next: (r) => {
        this.allGroups = this.buildGroups(r.data.bonds ?? []);
        this.applyRange();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  setRange(r: Range): void {
    this.range = r;
    this.applyRange();
    this.cdr.markForCheck();
  }

  private buildGroups(bonds: BondRow[]): MonthGroup[] {
    const map = new Map<string, MonthGroup>();
    const today = thisMonthKey();

    for (const bond of bonds) {
      for (const p of bond.payouts) {
        const key = p.payout_date.slice(0, 7);
        if (!map.has(key)) {
          map.set(key, {
            monthKey: key,
            label:    monthLabel(key),
            isPast:   key < today,
            bonds:    0,
            total:    0,
          });
        }
        const g = map.get(key)!;
        const net = Math.round((p.interest_payout - p.tds) * 100) / 100;
        g.bonds = Math.round((g.bonds + net) * 100) / 100;
        g.total = Math.round((g.total + net) * 100) / 100;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }

  private applyRange(): void {
    const today = thisMonthKey();

    if (this.range === 'All') {
      this.visible = this.allGroups;
    } else {
      const months = this.range === '3M' ? 3 : this.range === '6M' ? 6 : 12;
      const cutoff = addMonths(today, months);
      this.visible = this.allGroups.filter(g => g.monthKey >= today && g.monthKey < cutoff);
    }

    this.totalBonds = this.visible.reduce((s, g) => s + g.bonds, 0);
    this.grandTotal = this.visible.reduce((s, g) => s + g.total, 0);
  }
}
