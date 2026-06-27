import {
  Component, Inject, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

// ── Shared types ──────────────────────────────────────────────────────────────

interface FdRow {
  id: string;
  name: string;
  symbol: string | null;
  principal: number;
  maturity_amount: number;
  interest_rate: number;
  purchase_date: string;
  maturity_date: string;
  tenure_days: number;
  account_id: string;
  account_name: string;
  currency: string;
  meta: Record<string, unknown>;
}

interface DialogData { fd: FdRow | null; }

const COMPOUNDING_OPTIONS = [
  { value: 'simple',     label: 'Simple Interest' },
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly (most common)' },
  { value: 'half_yearly',label: 'Half-Yearly' },
  { value: 'annual',     label: 'Annual' },
] as const;

const COMPOUNDING_LABELS: Record<string, string> = Object.fromEntries(
  COMPOUNDING_OPTIONS.map(o => [o.value, o.label])
);

const N_MAP: Record<string, number> = {
  simple: 0, monthly: 12, quarterly: 4, half_yearly: 2, annual: 1,
};

function calcMaturity(
  principal: number,
  ratePct: number,
  startIso: string,
  maturityIso: string,
  compounding: string,
): { amount: number; days: number; gain: number; gainPct: number } | null {
  if (!principal || !ratePct || !startIso || !maturityIso) return null;
  const start = new Date(startIso);
  const end   = new Date(maturityIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
  const days  = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  const years = days / 365;
  const r     = ratePct / 100;
  const n     = N_MAP[compounding] ?? 4;
  const amount = n === 0
    ? principal * (1 + r * years)
    : principal * Math.pow(1 + r / n, n * years);
  const rounded = Math.round(amount * 100) / 100;
  return { amount: rounded, days, gain: rounded - principal, gainPct: ((rounded - principal) / principal) * 100 };
}

// ── Dialog component ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-fd-form-dialog',
  standalone: true,
  imports: [
    NgIf, NgFor, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, CurrencyPipe, DecimalPipe,
  ],
  styles: [`
    .fg  { display:flex;flex-direction:column;gap:2px;margin-bottom:8px; }
    .fg:last-child { margin-bottom:0; }
    .r2  { display:grid;grid-template-columns:1fr 1fr;gap:8px; }

    label { font-size:.6875rem;font-weight:600;color:#374151;display:block;margin-bottom:3px; }
    label .opt { color:#9CA3AF;font-weight:400; }
    label .req { color:#EF4444; }

    input.fi, select.fi {
      display:block;width:100%;height:34px;padding:0 9px;box-sizing:border-box;
      border:1.5px solid #E5E7EB;border-radius:6px;
      font-size:.8125rem;color:#111827;background:#fff;
      font-family:inherit;outline:none;
      transition:border-color .12s,box-shadow .12s;
    }
    input.fi::placeholder { color:#D1D5DB; }
    input.fi:focus,select.fi:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }
    input.fi.err { border-color:#EF4444; }
    .ferr { font-size:.625rem;color:#EF4444;margin-top:2px; }

    select.fi {
      appearance:none;padding-right:24px;cursor:pointer;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat:no-repeat;background-position:right 8px center;
    }

    .pfx { position:relative; }
    .pfx .sym { position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:.75rem;color:#9CA3AF;pointer-events:none; }
    .pfx .sfx { position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:.75rem;color:#9CA3AF;pointer-events:none; }
    .pfx input.fi { padding-left:18px; }
    .pfx input.fi.has-sfx { padding-right:40px; }

    textarea.fta {
      display:block;width:100%;padding:7px 9px;box-sizing:border-box;
      border:1.5px solid #E5E7EB;border-radius:6px;
      font-size:.8125rem;color:#111827;background:#fff;
      font-family:inherit;outline:none;resize:none;line-height:1.45;
      transition:border-color .12s,box-shadow .12s;
    }
    textarea.fta::placeholder { color:#D1D5DB; }
    textarea.fta:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }

    .h { background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:14px 16px;display:flex;align-items:center;justify-content:space-between; }
    .hl { display:flex;align-items:center;gap:10px; }
    .hi { width:32px;height:32px;border-radius:8px;background:rgba(139,92,246,.25);border:1px solid rgba(139,92,246,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .hi mat-icon { color:#C4B5FD;font-size:16px;width:16px;height:16px; }
    .ht { font-size:.875rem;font-weight:700;color:#F8FAFC;margin:0;line-height:1.2; }
    .hs { font-size:.6875rem;color:rgba(255,255,255,.4);margin:1px 0 0; }
    .hx { background:rgba(255,255,255,.07);border:none;cursor:pointer;width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4); }
    .hx:hover { background:rgba(255,255,255,.14);color:#fff; }
    .hx mat-icon { font-size:13px;width:13px;height:13px; }

    .prev { background:#F8FAFC;border-bottom:1px solid #E5E7EB;padding:10px 16px;display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:6px; }
    .pi { text-align:center; }
    .pl { font-size:.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94A3B8;margin-bottom:2px; }
    .pv { font-size:.9375rem;font-weight:700;color:#0F172A; }
    .pv.green { color:#16A34A; }
    .pv.purple { color:#7C3AED; }
    .pv.muted { color:#CBD5E1; }
    .pa { font-size:.875rem;color:#CBD5E1;text-align:center; }
    .ps { font-size:.625rem;color:#94A3B8;margin-top:1px; }

    .b { padding:12px 16px 8px;overflow-y:auto;max-height:calc(90vh - 145px); }
    .sl { font-size:.625rem;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;display:block; }

    .f { padding:9px 16px 13px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
  `],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi"><mat-icon>savings</mat-icon></div>
        <div>
          <p class="ht">{{ isEdit ? 'Edit Fixed Deposit' : 'New Fixed Deposit' }}</p>
          <p class="hs">{{ isEdit ? 'Update FD details' : 'Record a new FD and track maturity' }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="prev">
      <div class="pi">
        <div class="pl">Principal</div>
        <div class="pv" [class.muted]="!preview">
          <ng-container *ngIf="preview">{{ principalDisplay | currency:'INR':'symbol-narrow':'1.0-0' }}</ng-container>
          <ng-container *ngIf="!preview">₹ —</ng-container>
        </div>
      </div>
      <div class="pa">→</div>
      <div class="pi">
        <div class="pl">Maturity Value</div>
        <div class="pv purple" [class.muted]="!preview">
          <ng-container *ngIf="preview">{{ preview.amount | currency:'INR':'symbol-narrow':'1.0-0' }}</ng-container>
          <ng-container *ngIf="!preview">₹ —</ng-container>
        </div>
        <div class="ps" *ngIf="preview">{{ preview.days }} days</div>
      </div>
      <div class="pa">→</div>
      <div class="pi">
        <div class="pl">Interest Gain</div>
        <div class="pv green" [class.muted]="!preview">
          <ng-container *ngIf="preview">+{{ preview.gain | currency:'INR':'symbol-narrow':'1.0-0' }}</ng-container>
          <ng-container *ngIf="!preview">₹ —</ng-container>
        </div>
        <div class="ps" *ngIf="preview">{{ preview.gainPct | number:'1.2-2' }}% return</div>
      </div>
    </div>

    <div class="b">
      <form [formGroup]="form">

        <span class="sl">Details</span>

        <div class="r2">
          <div class="fg">
            <label>FD Name <span class="req">*</span></label>
            <input class="fi" formControlName="name" placeholder="e.g. SBI FD – Jan 2025">
          </div>
          <div class="fg">
            <label>FD Number <span class="opt">(optional)</span></label>
            <input class="fi" formControlName="fdNumber" placeholder="e.g. FD123456">
          </div>
        </div>

        <div class="r2" *ngIf="!isEdit">
          <div class="fg">
            <label>Principal <span class="req">*</span></label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="principal" placeholder="100000" min="1">
            </div>
          </div>
          <div class="fg">
            <label>Interest Rate <span class="req">*</span></label>
            <div class="pfx">
              <input class="fi has-sfx" type="number" formControlName="interestRate" step="0.01" placeholder="7.50">
              <span class="sfx">% p.a.</span>
            </div>
          </div>
        </div>

        <div class="fg" *ngIf="isEdit">
          <label>Interest Rate <span class="req">*</span></label>
          <div class="pfx">
            <input class="fi has-sfx" type="number" formControlName="interestRate" step="0.01" placeholder="7.50">
            <span class="sfx">% p.a.</span>
          </div>
        </div>

        <div class="fg">
          <label>Compounding Frequency</label>
          <select class="fi" formControlName="compounding">
            <option *ngFor="let o of compoundingOptions" [value]="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div class="r2" *ngIf="!isEdit">
          <div class="fg">
            <label>Start Date <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="startDate">
          </div>
          <div class="fg">
            <label>Maturity Date <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="maturityDate">
          </div>
        </div>

        <div class="fg" *ngIf="isEdit">
          <label>Maturity Date <span class="req">*</span></label>
          <input class="fi" type="date" formControlName="maturityDate">
        </div>

        <div class="fg">
          <label>Assured Maturity Amount <span class="opt">(optional — overrides calculated)</span></label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="assuredMaturityAmount"
              placeholder="Leave blank to use calculated value" min="1">
          </div>
        </div>

        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <textarea class="fta" formControlName="notes" rows="2" placeholder="Bank branch, nominee..."></textarea>
        </div>

      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()" style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:104px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add FD') }}
      </button>
    </div>
  `,
})
export class FdFormDialogComponent implements OnDestroy {
  isEdit: boolean;
  form: FormGroup;
  saving = false;
  preview: ReturnType<typeof calcMaturity> = null;
  principalDisplay = 0;

  readonly compoundingOptions = COMPOUNDING_OPTIONS;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<FdFormDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.isEdit = data.fd !== null;
    this.form   = this.buildForm();
    this.watchPreview();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private buildForm(): FormGroup {
    const fd = this.data.fd;
    if (fd) {
      return this.fb.group({
        name:                  [fd.name, Validators.required],
        fdNumber:              [fd.symbol ?? ''],
        interestRate:          [fd.interest_rate, Validators.required],
        compounding:           [(fd.meta?.['compounding'] as string) ?? 'quarterly', Validators.required],
        maturityDate:          [fd.maturity_date?.slice(0, 10) ?? '', Validators.required],
        assuredMaturityAmount: [(fd.meta?.['assuredMaturityAmount'] as number) ?? null],
        notes:                 [(fd.meta?.['notes'] as string) ?? ''],
        _principal:            [{ value: fd.principal, disabled: true }],
        _startDate:            [{ value: fd.purchase_date?.slice(0, 10) ?? '', disabled: true }],
      });
    }
    return this.fb.group({
      name:                  ['', Validators.required],
      fdNumber:              [''],
      principal:             [null, [Validators.required, Validators.min(1)]],
      interestRate:          [null, Validators.required],
      compounding:           ['quarterly', Validators.required],
      startDate:             [this.today(), Validators.required],
      maturityDate:          ['', Validators.required],
      assuredMaturityAmount: [null],
      notes:                 [''],
    });
  }

  private watchPreview(): void {
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const v = this.form.getRawValue();
      const principal    = this.isEdit ? v._principal     : Number(v.principal);
      const startDate    = this.isEdit ? v._startDate     : v.startDate;
      const maturityDate = v.maturityDate;
      const rate         = Number(v.interestRate);
      const compounding  = v.compounding;
      const assured      = v.assuredMaturityAmount ? Number(v.assuredMaturityAmount) : null;
      this.principalDisplay = principal;

      if (assured && assured > 0 && principal > 0) {
        const days = this.calcDays(startDate, maturityDate);
        this.preview = {
          amount: assured, days,
          gain: assured - principal,
          gainPct: ((assured - principal) / principal) * 100,
        };
      } else {
        this.preview = calcMaturity(principal, rate, startDate, maturityDate, compounding);
      }
    });
    if (this.isEdit) this.form.updateValueAndValidity();
  }

  private calcDays(start: string, end: string): number {
    if (!start || !end) return 0;
    const s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 86_400_000));
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;

    if (this.isEdit) {
      const body: Record<string, unknown> = {
        name:         v.name,
        fdNumber:     v.fdNumber || null,
        interestRate: Number(v.interestRate),
        compounding:  v.compounding,
        maturityDate: v.maturityDate,
        assuredMaturityAmount: v.assuredMaturityAmount ? Number(v.assuredMaturityAmount) : null,
        notes:        v.notes || null,
      };
      this.http.patch(`${environment.apiUrl}/fixed-deposits/${this.data.fd!.id}`, body).subscribe({
        next:  () => this.dialogRef.close(true),
        error: () => { this.saving = false; },
      });
    } else {
      const body: Record<string, unknown> = {
        name:         v.name,
        principal:    Number(v.principal),
        interestRate: Number(v.interestRate),
        compounding:  v.compounding,
        startDate:    v.startDate,
        maturityDate: v.maturityDate,
      };
      if (v.fdNumber)              body['fdNumber']             = v.fdNumber;
      if (v.assuredMaturityAmount) body['assuredMaturityAmount'] = Number(v.assuredMaturityAmount);
      if (v.notes)                 body['notes']                = v.notes;
      this.http.post(`${environment.apiUrl}/fixed-deposits`, body).subscribe({
        next:  () => this.dialogRef.close(true),
        error: () => { this.saving = false; },
      });
    }
  }

  cancel(): void { this.dialogRef.close(false); }
  private today(): string { return new Date().toISOString().slice(0, 10); }
}

// ── List component ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-fd-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, CurrencyPipe, DatePipe,
    MatProgressSpinnerModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatDialogModule,
  ],
  styles: [`
    .spinner-wrap { display:flex;justify-content:center;padding:100px 0; }

    .stats-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px; }
    .stat-card  { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px; }
    .stat-label { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .stat-val   { font-size:1.5rem;font-weight:700;letter-spacing:-.5px;color:#0F172A; }
    .stat-val.green  { color:#16A34A; }
    .stat-val.purple { color:#7C3AED; }

    .card-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px; }

    .table-wrap { overflow-x:auto; }
    table { width:100%;border-collapse:collapse; }
    th {
      text-align:left;font-size:.6875rem;font-weight:700;text-transform:uppercase;
      letter-spacing:.06em;color:#94A3B8;padding:8px 12px;
      border-bottom:2px solid #F1F5F9;white-space:nowrap;
    }
    th.right, td.right { text-align:right; }
    td { padding:13px 12px;border-bottom:1px solid #F8FAFC;font-size:.875rem;color:#374151;vertical-align:middle; }
    tr:last-child td  { border-bottom:none; }
    tr:hover td       { background:#FAFBFC; }

    .fd-name   { font-weight:600;color:#0F172A; }
    .fd-number { font-size:.75rem;color:#94A3B8;margin-top:2px; }
    .rate-chip { display:inline-flex;padding:2px 9px;border-radius:20px;font-size:.6875rem;font-weight:600;background:#FEF9C3;color:#A16207; }

    .maturity-val { font-size:.875rem;font-weight:700;color:#7C3AED; }
    .gain-val     { font-size:.75rem;color:#16A34A;font-weight:600;margin-top:2px; }

    .actions { display:flex;gap:4px;justify-content:flex-end; }
    .btn-icon { width:30px;height:30px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .12s; }
    .btn-edit   { background:#EFF6FF;color:#2563EB; }
    .btn-edit:hover   { background:#DBEAFE; }
    .btn-delete { background:#FEF2F2;color:#DC2626; }
    .btn-delete:hover { background:#FEE2E2; }
    .btn-icon mat-icon { font-size:15px;width:15px;height:15px; }

    .del-overlay { position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45); }
    .del-card    { background:white;border-radius:16px;padding:28px 32px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center; }
    .del-icon    { width:52px;height:52px;border-radius:50%;background:#FEF2F2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px; }
    .del-actions { display:flex;gap:10px;justify-content:center; }
  `],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Fixed Deposits</h1>
        <p class="page-subtitle">Track investments and projected maturity values</p>
      </div>
      <button mat-flat-button color="primary" (click)="openAdd()" style="border-radius:8px;font-weight:600">
        <mat-icon style="font-size:18px;width:18px;height:18px;margin-right:4px">add</mat-icon>
        Add FD
      </button>
    </div>

    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="44"></mat-spinner></div>

    <ng-container *ngIf="!loading">

      <div class="stats-grid" *ngIf="fds.length > 0">
        <div class="stat-card">
          <div class="stat-label">Total Principal</div>
          <div class="stat-val">{{ totalPrincipal | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Maturity Value</div>
          <div class="stat-val purple">{{ totalMaturity | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Interest Gain</div>
          <div class="stat-val green">{{ totalGain | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
      </div>

      <div class="card" style="padding:20px 24px">
        <div class="card-header">
          <div>
            <p class="card-title">All Fixed Deposits</p>
            <p class="card-subtitle">{{ fds.length }} FD{{ fds.length !== 1 ? 's' : '' }}</p>
          </div>
        </div>

        <div *ngIf="fds.length === 0" style="display:flex;flex-direction:column;align-items:center;padding:60px 0;gap:12px;text-align:center">
          <div style="width:64px;height:64px;border-radius:16px;background:#F5F3FF;display:flex;align-items:center;justify-content:center">
            <mat-icon style="color:#8B5CF6;font-size:28px;width:28px;height:28px">savings</mat-icon>
          </div>
          <p style="font-size:1rem;font-weight:600;color:#0F172A;margin:0">No fixed deposits yet</p>
          <p style="font-size:.875rem;color:#64748B;margin:0">Click "Add FD" to record your first fixed deposit.</p>
          <button mat-stroked-button color="primary" (click)="openAdd()" style="border-radius:8px;margin-top:4px">
            <mat-icon>add</mat-icon> Add FD
          </button>
        </div>

        <div class="table-wrap" *ngIf="fds.length > 0">
          <table>
            <thead>
              <tr>
                <th>FD Name</th>
                <th>Rate / Compounding</th>
                <th>Tenure</th>
                <th class="right">Principal</th>
                <th class="right">Maturity Value</th>
                <th class="right">Matures On</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let fd of fds">
                <td>
                  <div class="fd-name">{{ fd.name }}</div>
                  <div class="fd-number" *ngIf="fd.symbol">FD# {{ fd.symbol }}</div>
                </td>
                <td>
                  <span class="rate-chip">{{ fd.interest_rate }}% p.a.</span>
                  <div style="font-size:.6875rem;color:#94A3B8;margin-top:3px">
                    {{ compoundingLabel(fd.meta['compounding']) }}
                  </div>
                </td>
                <td>{{ fd.tenure_days }} days</td>
                <td class="right" style="font-weight:600">{{ fd.principal | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
                <td class="right">
                  <div class="maturity-val">{{ fd.maturity_amount | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
                  <div class="gain-val">+{{ (fd.maturity_amount - fd.principal) | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
                </td>
                <td class="right" style="white-space:nowrap;color:#374151">{{ fd.maturity_date | date:'d MMM y' }}</td>
                <td class="right">
                  <div class="actions">
                    <button class="btn-icon btn-edit" (click)="openEdit(fd)" matTooltip="Edit">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button class="btn-icon btn-delete" (click)="confirmDelete(fd)" matTooltip="Delete">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </ng-container>

    <div class="del-overlay" *ngIf="deleteTarget">
      <div class="del-card">
        <div class="del-icon">
          <mat-icon style="color:#DC2626;font-size:24px;width:24px;height:24px">warning</mat-icon>
        </div>
        <p style="font-size:1.0625rem;font-weight:700;color:#0F172A;margin:0 0 8px">Delete Fixed Deposit?</p>
        <p style="font-size:.875rem;color:#64748B;line-height:1.5;margin:0 0 24px">
          "<strong>{{ deleteTarget.name }}</strong>" will be permanently removed.
        </p>
        <div class="del-actions">
          <button mat-stroked-button (click)="deleteTarget = null" style="border-radius:8px">Cancel</button>
          <button mat-flat-button color="warn" (click)="deleteFd()" [disabled]="deleting"
            style="border-radius:8px;font-weight:600;min-width:100px">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class FdListComponent implements OnInit {
  loading  = true;
  deleting = false;
  fds: FdRow[] = [];
  deleteTarget: FdRow | null = null;
  totalPrincipal = 0;
  totalMaturity  = 0;
  totalGain      = 0;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadFds(); }

  private loadFds(): void {
    this.loading = true;
    this.http.get<{ data: { fixedDeposits: FdRow[] } }>(`${environment.apiUrl}/fixed-deposits`).subscribe({
      next: (r) => {
        this.fds = r.data.fixedDeposits ?? [];
        this.calcTotals();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private calcTotals(): void {
    this.totalPrincipal = this.fds.reduce((s, f) => s + Number(f.principal), 0);
    this.totalMaturity  = this.fds.reduce((s, f) => s + Number(f.maturity_amount), 0);
    this.totalGain      = this.totalMaturity - this.totalPrincipal;
  }

  openAdd(): void {
    this.dialog.open(FdFormDialogComponent, {
      data: { fd: null } as DialogData,
      width: '480px',
      maxHeight: '90vh',
      panelClass: 'pwms-dialog',
      autoFocus: 'first-tabbable',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.loadFds(); });
  }

  openEdit(fd: FdRow): void {
    this.dialog.open(FdFormDialogComponent, {
      data: { fd } as DialogData,
      width: '480px',
      maxHeight: '90vh',
      panelClass: 'pwms-dialog',
      autoFocus: 'first-tabbable',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.loadFds(); });
  }

  confirmDelete(fd: FdRow): void { this.deleteTarget = fd; this.cdr.markForCheck(); }

  deleteFd(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.http.delete(`${environment.apiUrl}/fixed-deposits/${this.deleteTarget.id}`).subscribe({
      next: () => { this.deleting = false; this.deleteTarget = null; this.loadFds(); },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }

  compoundingLabel(c: unknown): string {
    const k = String(c ?? 'quarterly');
    return COMPOUNDING_LABELS[k] ?? k;
  }
}
