import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
  meta?: { source?: string | null } | null;
}

interface ManualIncomeRow {
  id: string;
  income_date: string;
  amount: number;
  notes: string | null;
  frequency: string;      // 'once' | 'monthly' | 'quarterly' | 'half_yearly' | 'annually'
  end_date: string | null;
}

interface IncomeEntry {
  kind: 'bond' | 'manual';
  id?: string;          // manual entry id, used for delete
  label: string;
  sub: string;
  net: number;
  recurring?: boolean;
}

const FREQ_STEP_MONTHS: Record<string, number> = {
  monthly: 1, quarterly: 3, half_yearly: 6, annually: 12,
};

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-Yearly', annually: 'Annually',
};

interface MonthGroup {
  monthKey: string;   // "2026-07"
  label: string;      // "July 2026"
  isPast: boolean;
  bonds: number;
  manual: number;
  total: number;
  entries: IncomeEntry[];
  expanded: boolean;
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

// ── Shared form dialog styles ────────────────────────────────────────────────

const FORM_STYLES = `
  .h  { display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #F3F4F6; }
  .hl { display:flex;align-items:center;gap:12px; }
  .hi { width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
  .hi mat-icon { font-size:20px;width:20px;height:20px; }
  .ht { font-size:.9375rem;font-weight:700;color:#0F172A;margin:0; }
  .hs { font-size:.75rem;color:#64748B;margin:0; }
  .hx { background:none;border:none;cursor:pointer;color:#94A3B8;padding:4px;display:flex;align-items:center;border-radius:6px; }
  .hx:hover { background:#F1F5F9;color:#475569; }
  .b  { padding:16px 20px;display:flex;flex-direction:column;gap:10px; }
  .fg { display:flex;flex-direction:column;gap:4px; }
  label { font-size:.8125rem;font-weight:600;color:#374151; }
  .req { color:#EF4444; }
  .opt { font-weight:400;color:#9CA3AF; }
  .fi { height:36px;padding:0 10px;border:1px solid #D1D5DB;border-radius:8px;font-size:.875rem;color:#111827;outline:none;width:100%;box-sizing:border-box;background:white; }
  .fi:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.12); }
  .fi.err { border-color:#EF4444; }
  textarea.fi { height:72px;padding:8px 10px;resize:vertical; }
  .ferr { font-size:.75rem;color:#EF4444; }
  .pfx { position:relative; }
  .pfx .sym { position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:.8125rem;color:#6B7280;pointer-events:none; }
  .pfx input.fi { padding-left:22px; }
  .f { padding:9px 16px 13px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
  .chk-row { display:flex;align-items:center;gap:8px; }
  .chk-row input[type="checkbox"] { width:16px;height:16px;accent-color:#3B82F6;cursor:pointer; }
  .chk-row label { cursor:pointer;margin:0; }
  select.fi { appearance:auto; }
`;

// ── Add manual income dialog ──────────────────────────────────────────────────

@Component({
  selector: 'app-manual-income-dialog',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styles: [FORM_STYLES],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi" style="background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3)">
          <mat-icon style="color:#059669">edit_note</mat-icon>
        </div>
        <div>
          <p class="ht">Add Expected Income</p>
          <p class="hs">Record income not tracked elsewhere</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="b">
      <form [formGroup]="form">
        <div class="fg">
          <label>Date <span class="req">*</span></label>
          <input class="fi" type="date" formControlName="incomeDate" [class.err]="inv('incomeDate')">
          <span class="ferr" *ngIf="inv('incomeDate')">Required</span>
        </div>

        <div class="fg">
          <label>Amount <span class="req">*</span></label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="amount" placeholder="0.00" min="0" step="0.01"
              [class.err]="inv('amount')">
          </div>
          <span class="ferr" *ngIf="inv('amount')">Required</span>
        </div>

        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <textarea class="fi" formControlName="notes" placeholder="e.g. Freelance payment"></textarea>
        </div>

        <div class="chk-row">
          <input type="checkbox" id="recurring" formControlName="recurring">
          <label for="recurring">Recurring income</label>
        </div>

        <ng-container *ngIf="form.value.recurring">
          <div class="fg">
            <label>Repeats <span class="req">*</span></label>
            <select class="fi" formControlName="frequency">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half-Yearly</option>
              <option value="annually">Annually</option>
            </select>
          </div>

          <div class="fg">
            <label>Ends On <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="endDate" [class.err]="inv('endDate')">
            <span class="ferr" *ngIf="inv('endDate')">Required for a recurring entry</span>
          </div>
        </ng-container>
      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()"
        style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:90px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : 'Add Income' }}
      </button>
    </div>
  `,
})
export class ManualIncomeDialogComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  saving = false;

  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<ManualIncomeDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      incomeDate: ['', Validators.required],
      amount:     [null, [Validators.required, Validators.min(0)]],
      notes:      [''],
      recurring:  [false],
      frequency:  ['monthly'],
      endDate:    [''],
    });

    this.form.get('recurring')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((recurring: boolean) => {
      const endDateCtrl = this.form.get('endDate')!;
      endDateCtrl.setValidators(recurring ? [Validators.required] : []);
      endDateCtrl.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  inv(c: string): boolean { const ctrl = this.form.get(c); return !!(ctrl?.invalid && ctrl?.touched); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;
    const body: Record<string, unknown> = {
      incomeDate: v.incomeDate,
      amount:     Number(v.amount),
      frequency:  v.recurring ? v.frequency : 'once',
    };
    if (v.notes) body['notes'] = v.notes;
    if (v.recurring) body['endDate'] = v.endDate;

    this.http.post(`${environment.apiUrl}/manual-income`, body).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => { this.saving = false; },
    });
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-expected-income',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgFor, CurrencyPipe, MatProgressSpinnerModule, MatIconModule, MatButtonModule, MatDialogModule],
  styles: [`
    :host { display:block;padding:24px;background:#F8FAFC;min-height:100%; }

    .spinner-wrap { display:flex;justify-content:center;padding:80px; }

    /* Header */
    .page-hdr  { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px; }
    .page-title { font-size:1.125rem;font-weight:700;color:#0F172A; }
    .page-hdr-actions { display:flex;align-items:center;gap:8px; }

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
      display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;
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
    .sum-val.teal  { color:#0F766E; }

    /* Month cards */
    .month-card {
      background:white;border:1px solid #E2E8F0;border-radius:12px;
      overflow:hidden;margin-bottom:12px;
    }
    .month-card.past { opacity:.55; }

    .month-hdr {
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;
      cursor:pointer;user-select:none;
    }
    .month-name { font-size:.875rem;font-weight:700;color:#0F172A; }
    .chevron {
      font-size:18px;width:18px;height:18px;color:#94A3B8;
      transition:transform .15s;flex-shrink:0;
    }
    .chevron.open { transform:rotate(90deg); }
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
    .source-icon.manual { background:rgba(15,118,110,.1); }
    .source-icon.manual mat-icon { color:#0F766E;font-size:15px;width:15px;height:15px; }
    .source-lbl { flex:1;font-size:.8125rem;font-weight:500;color:#374151;min-width:0; }
    .source-name { white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .source-sub { font-size:.6875rem;font-weight:400;color:#94A3B8;margin-top:1px; }
    .source-val { font-size:.875rem;font-weight:600;color:#0F172A;font-family:monospace;flex-shrink:0;text-align:right; }
    .del-btn {
      background:none;border:none;cursor:pointer;color:#CBD5E1;padding:4px;
      display:flex;align-items:center;border-radius:6px;flex-shrink:0;
    }
    .del-btn:hover { background:#FEF2F2;color:#EF4444; }
    .del-btn mat-icon { font-size:16px;width:16px;height:16px; }

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

    /* Delete confirm overlay */
    .del-overlay { position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:100; }
    .del-box { background:white;border-radius:14px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .del-title { font-size:1rem;font-weight:700;color:#0F172A;margin:0 0 8px; }
    .del-body  { font-size:.875rem;color:#64748B;margin:0 0 20px; }
    .del-actions { display:flex;justify-content:flex-end;gap:8px; }
  `],
  template: `
    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>

    <ng-container *ngIf="!loading">

      <!-- Header -->
      <div class="page-hdr">
        <span class="page-title">Expected Income</span>
        <div class="page-hdr-actions">
          <div class="range-bar">
            <button class="range-btn" [class.active]="range==='3M'"  (click)="setRange('3M')">3M</button>
            <button class="range-btn" [class.active]="range==='6M'"  (click)="setRange('6M')">6M</button>
            <button class="range-btn" [class.active]="range==='12M'" (click)="setRange('12M')">12M</button>
            <button class="range-btn" [class.active]="range==='All'" (click)="setRange('All')">All</button>
          </div>
          <button mat-flat-button color="primary" (click)="openAddManual()"
            style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
            <mat-icon style="font-size:16px;width:16px;height:16px;margin-right:4px">add</mat-icon>
            Add Income
          </button>
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
          <div class="sum-lbl">Other Income</div>
          <div class="sum-val teal">{{ totalManual | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
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
        <div class="month-hdr" (click)="toggleMonth(m)">
          <div style="display:flex;align-items:center;gap:6px">
            <mat-icon class="chevron" [class.open]="m.expanded">chevron_right</mat-icon>
            <span class="month-name">{{ m.label }}</span>
          </div>
          <span [class]="m.isPast ? 'past-badge' : 'future-badge'">
            {{ m.isPast ? 'Past' : 'Expected' }}
          </span>
        </div>

        <!-- Per-entry breakup -->
        <ng-container *ngIf="m.expanded">
          <div *ngFor="let e of m.entries" class="source-row">
            <div class="source-icon" [class.bond]="e.kind==='bond'" [class.manual]="e.kind==='manual'">
              <mat-icon>{{ e.kind === 'bond' ? 'receipt_long' : 'edit_note' }}</mat-icon>
            </div>
            <div class="source-lbl">
              <div class="source-name">{{ e.label }}</div>
              <div class="source-sub">{{ e.sub }}</div>
            </div>
            <span class="source-val">{{ e.net | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
            <button *ngIf="e.kind === 'manual'" class="del-btn" (click)="confirmDeleteManual(e, $event)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </ng-container>

        <!-- Total -->
        <div class="total-row">
          <span class="total-lbl">Total</span>
          <span class="total-val">{{ m.total | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
        </div>
      </div>

    </ng-container>

    <!-- Delete confirm -->
    <div class="del-overlay" *ngIf="deleteTarget" (click)="deleteTarget = null">
      <div class="del-box" (click)="$event.stopPropagation()">
        <p class="del-title">Delete income entry?</p>
        <p class="del-body">
          Remove this manually added income entry?
          <ng-container *ngIf="deleteTarget.recurring"> This is a <strong>recurring</strong> entry — deleting it removes all its scheduled occurrences.</ng-container>
          This cannot be undone.
        </p>
        <div class="del-actions">
          <button mat-stroked-button (click)="deleteTarget = null"
            style="height:32px;font-size:.8125rem;border-radius:7px">Cancel</button>
          <button mat-flat-button color="warn" (click)="doDeleteManual()" [disabled]="deleting"
            style="height:32px;font-size:.8125rem;font-weight:600;border-radius:7px;min-width:80px">
            <mat-spinner *ngIf="deleting" diameter="14" style="display:inline-block;margin-right:4px"></mat-spinner>
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ExpectedIncomeComponent implements OnInit {
  loading  = true;
  deleting = false;
  range: Range = '3M';

  allGroups: MonthGroup[] = [];
  visible:   MonthGroup[] = [];

  totalBonds  = 0;
  totalManual = 0;
  grandTotal  = 0;

  deleteTarget: IncomeEntry | null = null;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    forkJoin({
      bonds:  this.http.get<{ data: { bonds: BondRow[] } }>(`${environment.apiUrl}/bonds`)
        .pipe(catchError(() => of({ data: { bonds: [] as BondRow[] } }))),
      manual: this.http.get<{ data: { entries: ManualIncomeRow[] } }>(`${environment.apiUrl}/manual-income`)
        .pipe(catchError(() => of({ data: { entries: [] as ManualIncomeRow[] } }))),
    }).subscribe({
      next: ({ bonds, manual }) => {
        this.allGroups = this.buildGroups(bonds.data.bonds ?? [], manual.data.entries ?? []);
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

  toggleMonth(m: MonthGroup): void {
    m.expanded = !m.expanded;
    this.cdr.markForCheck();
  }

  openAddManual(): void {
    this.dialog.open(ManualIncomeDialogComponent, {
      width: '440px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  confirmDeleteManual(e: IncomeEntry, ev: MouseEvent): void {
    ev.stopPropagation();
    this.deleteTarget = e;
    this.cdr.markForCheck();
  }

  doDeleteManual(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.http.delete(`${environment.apiUrl}/manual-income/${this.deleteTarget.id}`).subscribe({
      next: () => { this.deleteTarget = null; this.deleting = false; this.load(); },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }

  private buildGroups(bonds: BondRow[], manual: ManualIncomeRow[]): MonthGroup[] {
    const map = new Map<string, MonthGroup>();
    const today = thisMonthKey();

    const getGroup = (key: string): MonthGroup => {
      if (!map.has(key)) {
        map.set(key, {
          monthKey: key,
          label:    monthLabel(key),
          isPast:   key < today,
          bonds:    0,
          manual:   0,
          total:    0,
          entries:  [],
          expanded: false,
        });
      }
      return map.get(key)!;
    };

    for (const bond of bonds) {
      for (const p of bond.payouts) {
        const key = p.payout_date.slice(0, 7);
        const g = getGroup(key);
        const net = Math.round((p.interest_payout - p.tds) * 100) / 100;
        g.bonds = Math.round((g.bonds + net) * 100) / 100;
        g.total = Math.round((g.total + net) * 100) / 100;

        const source = bond.meta?.source || '—';
        const sub = `Source: ${source} · Interest ${formatINR(p.interest_payout)}` +
          (p.tds > 0 ? ` − TDS ${formatINR(p.tds)}` : '');
        g.entries.push({ kind: 'bond', label: bond.name, sub, net });
      }
    }

    const addManualOccurrence = (entry: ManualIncomeRow, key: string, sub: string): void => {
      const g = getGroup(key);
      g.manual = Math.round((g.manual + entry.amount) * 100) / 100;
      g.total  = Math.round((g.total + entry.amount) * 100) / 100;
      g.entries.push({
        kind:      'manual',
        id:        entry.id,
        label:     entry.notes || 'Manual entry',
        sub,
        net:       entry.amount,
        recurring: entry.frequency !== 'once',
      });
    };

    for (const entry of manual) {
      const startKey = entry.income_date.slice(0, 7);

      if (entry.frequency === 'once' || !entry.end_date) {
        addManualOccurrence(entry, startKey, 'Source: Manual');
        continue;
      }

      const step   = FREQ_STEP_MONTHS[entry.frequency] ?? 1;
      const endKey = entry.end_date.slice(0, 7);
      const sub    = `Source: Manual · ${FREQ_LABELS[entry.frequency]}, ends ${monthLabel(endKey)}`;

      let key = startKey;
      while (key <= endKey) {
        addManualOccurrence(entry, key, sub);
        key = addMonths(key, step);
      }
    }

    for (const g of map.values()) {
      g.entries.sort((a, b) => b.net - a.net);
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

    this.totalBonds  = this.visible.reduce((s, g) => s + g.bonds, 0);
    this.totalManual = this.visible.reduce((s, g) => s + g.manual, 0);
    this.grandTotal  = this.visible.reduce((s, g) => s + g.total, 0);
  }
}

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
