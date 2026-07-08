import {
  Component, Inject, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MfTransaction {
  id: string;
  fund_id: string;
  units: number;
  nav: number;
  amount: number;
  type: 'purchase' | 'redemption';
  txn_date: string;
  notes: string | null;
}

interface MfFund {
  id: string;
  name: string;
  scheme_code: string | null;
  latest_nav: number;
  notes: string | null;
  total_units: number;
  total_invested: number;
  total_value: number;
  profit_loss: number;
  transactions: MfTransaction[];
}

interface FundDialogData { fund: MfFund | null; }
interface TxnDialogData  { fundId: string; fundName: string; }

// ── Shared form styles ────────────────────────────────────────────────────────

const FORM_STYLES = `
  .h { background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:14px 16px;display:flex;align-items:center;justify-content:space-between; }
  .hl { display:flex;align-items:center;gap:10px; }
  .hi { width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
  .hi mat-icon { font-size:16px;width:16px;height:16px; }
  .ht { font-size:.875rem;font-weight:700;color:#F8FAFC;margin:0;line-height:1.2; }
  .hs { font-size:.6875rem;color:rgba(255,255,255,.4);margin:1px 0 0; }
  .hx { background:rgba(255,255,255,.07);border:none;cursor:pointer;width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4); }
  .hx:hover { background:rgba(255,255,255,.14);color:#fff; }
  .hx mat-icon { font-size:13px;width:13px;height:13px; }
  .b { padding:12px 16px 8px;overflow-y:auto;max-height:calc(90vh - 110px); }
  .sl { font-size:.625rem;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;display:block; }
  .fg { display:flex;flex-direction:column;gap:2px;margin-bottom:8px; }
  .fg:last-child { margin-bottom:0; }
  .r2 { display:grid;grid-template-columns:1fr 1fr;gap:8px; }

  @media (max-width: 480px) {
    .r2 { grid-template-columns: 1fr; }
  }

  label { font-size:.6875rem;font-weight:600;color:#374151;display:block;margin-bottom:3px; }
  label .opt { color:#9CA3AF;font-weight:400; }
  label .req { color:#EF4444; }
  input.fi, select.fi { display:block;width:100%;height:34px;padding:0 9px;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:6px;font-size:.8125rem;color:#111827;background:#fff;font-family:inherit;outline:none;transition:border-color .12s,box-shadow .12s; }
  input.fi::placeholder { color:#D1D5DB; }
  input.fi:focus,select.fi:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }
  input.fi.err { border-color:#EF4444; }
  .ferr { font-size:.625rem;color:#EF4444;margin-top:2px; }
  select.fi { appearance:none;padding-right:24px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center; }
  .pfx { position:relative; }
  .pfx .sym { position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:.75rem;color:#9CA3AF;pointer-events:none; }
  .pfx input.fi { padding-left:18px; }
  textarea.fta { display:block;width:100%;padding:7px 9px;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:6px;font-size:.8125rem;color:#111827;background:#fff;font-family:inherit;outline:none;resize:none;line-height:1.45;transition:border-color .12s,box-shadow .12s; }
  textarea.fta::placeholder { color:#D1D5DB; }
  textarea.fta:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }
  .f { padding:9px 16px 13px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
`;

// ── Fund dialog ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-mf-fund-dialog',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styles: [FORM_STYLES + `
    .divider { border:none;border-top:1px dashed #E5E7EB;margin:12px 0 10px; }
  `],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi" style="background:rgba(8,145,178,.25);border:1px solid rgba(8,145,178,.4)">
          <mat-icon style="color:#67E8F9">trending_up</mat-icon>
        </div>
        <div>
          <p class="ht">{{ isEdit ? 'Edit Fund' : 'New Mutual Fund' }}</p>
          <p class="hs">{{ isEdit ? 'Update fund details' : 'Add a mutual fund to track' }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="b">
      <form [formGroup]="form">

        <span class="sl">Fund Details</span>
        <div class="r2">
          <div class="fg">
            <label>Fund Name <span class="req">*</span></label>
            <input class="fi" formControlName="name" placeholder="e.g. SBI Equity Hybrid Fund"
              [class.err]="inv('name')">
            <span class="ferr" *ngIf="inv('name')">Required</span>
          </div>
          <div class="fg">
            <label>Scheme Code <span class="opt">(optional)</span></label>
            <input class="fi" formControlName="schemeCode" placeholder="e.g. 120503">
          </div>
        </div>
        <div class="r2">
          <div class="fg">
            <label>Latest NAV <span class="req">*</span></label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="latestNav"
                placeholder="e.g. 311.50" step="0.0001" min="0" [class.err]="inv('latestNav')">
            </div>
            <span class="ferr" *ngIf="inv('latestNav')">Required</span>
          </div>
          <div class="fg">
            <label>Notes <span class="opt">(optional)</span></label>
            <input class="fi" formControlName="notes" placeholder="Fund house, category...">
          </div>
        </div>

        <!-- First transaction — only shown when adding a new fund -->
        <ng-container *ngIf="!isEdit">
          <hr class="divider">
          <span class="sl">First Transaction <span style="font-weight:400;color:#9CA3AF;text-transform:none;letter-spacing:0">(optional — fill all three fields to record)</span></span>
          <div class="r2">
            <div class="fg">
              <label>Type</label>
              <select class="fi" formControlName="txnType">
                <option value="purchase">Purchase</option>
                <option value="redemption">Redemption</option>
              </select>
            </div>
            <div class="fg">
              <label>Date</label>
              <input class="fi" type="date" formControlName="txnDate">
            </div>
          </div>
          <div class="r2">
            <div class="fg">
              <label>Units</label>
              <input class="fi" type="number" formControlName="txnUnits"
                placeholder="e.g. 337.50" step="0.0001" min="0.0001">
            </div>
            <div class="fg">
              <label>Purchase NAV</label>
              <div class="pfx">
                <span class="sym">₹</span>
                <input class="fi" type="number" formControlName="txnNav"
                  placeholder="e.g. 284.00" step="0.0001" min="0.0001">
              </div>
            </div>
          </div>
          <div class="fg">
            <label>Invested Amount</label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="txnAmount"
                placeholder="e.g. 99994" min="0.01">
            </div>
          </div>
          <div class="fg">
            <label>Transaction Notes <span class="opt">(optional)</span></label>
            <input class="fi" formControlName="txnNotes" placeholder="SIP, lump-sum, folio...">
          </div>
        </ng-container>

      </form>
    </div>
    <div class="f">
      <button mat-stroked-button (click)="cancel()" style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:110px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Fund') }}
      </button>
    </div>
  `,
})
export class MfFundDialogComponent implements OnInit {
  isEdit: boolean;
  form!: FormGroup;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: FundDialogData,
    private dialogRef: MatDialogRef<MfFundDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) { this.isEdit = data.fund !== null; }

  ngOnInit(): void {
    const f = this.data.fund;
    const today = new Date().toISOString().slice(0, 10);
    this.form = this.fb.group({
      name:       [f?.name ?? '',         Validators.required],
      schemeCode: [f?.scheme_code ?? ''],
      latestNav:  [f?.latest_nav ?? null, [Validators.required, Validators.min(0)]],
      notes:      [f?.notes ?? ''],
      // transaction fields — optional; included only when all three numeric fields are filled
      txnType:    ['purchase'],
      txnDate:    [today],
      txnUnits:   [null],
      txnNav:     [null],
      txnAmount:  [null],
      txnNotes:   [''],
    });
  }

  inv(c: string): boolean { const ctrl = this.form.get(c); return !!(ctrl?.invalid && ctrl?.touched); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.getRawValue();
    const fundBody: Record<string, unknown> = { name: v.name, latestNav: Number(v.latestNav) };
    if (v.schemeCode) fundBody['schemeCode'] = v.schemeCode;
    if (v.notes)      fundBody['notes']      = v.notes;

    if (this.isEdit) {
      this.http.patch(`${environment.apiUrl}/mutual-funds/${this.data.fund!.id}`, fundBody)
        .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
      return;
    }

    const hasTransaction = v.txnUnits != null && v.txnNav != null && v.txnAmount != null
      && Number(v.txnUnits) > 0 && Number(v.txnNav) > 0 && Number(v.txnAmount) > 0;

    const createFund$ = this.http.post<{ data: { fund: { id: string } } }>(
      `${environment.apiUrl}/mutual-funds`, fundBody
    );

    if (!hasTransaction) {
      createFund$.subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
      return;
    }

    createFund$.pipe(
      switchMap(res => {
        const fundId = res.data.fund.id;
        const txnBody = {
          type:    v.txnType,
          txnDate: v.txnDate,
          units:   Number(v.txnUnits),
          nav:     Number(v.txnNav),
          amount:  Number(v.txnAmount),
          notes:   v.txnNotes || undefined,
        };
        return this.http.post(`${environment.apiUrl}/mutual-funds/${fundId}/transactions`, txnBody);
      })
    ).subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── Transaction dialog ────────────────────────────────────────────────────────

@Component({
  selector: 'app-mf-txn-dialog',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styles: [FORM_STYLES],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi" style="background:rgba(22,163,74,.2);border:1px solid rgba(22,163,74,.35)">
          <mat-icon style="color:#86EFAC">swap_horiz</mat-icon>
        </div>
        <div>
          <p class="ht">Add Transaction</p>
          <p class="hs">{{ data.fundName }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="b">
      <span class="sl">Transaction Details</span>
      <form [formGroup]="form">
        <div class="r2">
          <div class="fg">
            <label>Type <span class="req">*</span></label>
            <select class="fi" formControlName="type">
              <option value="purchase">Purchase</option>
              <option value="redemption">Redemption</option>
            </select>
          </div>
          <div class="fg">
            <label>Date <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="txnDate"
              [class.err]="inv('txnDate')">
            <span class="ferr" *ngIf="inv('txnDate')">Required</span>
          </div>
        </div>
        <div class="r2">
          <div class="fg">
            <label>Units <span class="req">*</span></label>
            <input class="fi" type="number" formControlName="units"
              placeholder="e.g. 337.50" step="0.0001" min="0.0001"
              [class.err]="inv('units')">
            <span class="ferr" *ngIf="inv('units')">Enter positive units</span>
          </div>
          <div class="fg">
            <label>Purchase NAV <span class="req">*</span></label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="nav"
                placeholder="e.g. 284.00" step="0.0001" min="0.0001"
                [class.err]="inv('nav')">
            </div>
            <span class="ferr" *ngIf="inv('nav')">Required</span>
          </div>
        </div>
        <div class="fg">
          <label>Invested Amount <span class="req">*</span></label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="amount"
              placeholder="e.g. 99994" min="0.01"
              [class.err]="inv('amount')">
          </div>
          <span class="ferr" *ngIf="inv('amount')">Required</span>
        </div>
        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <textarea class="fta" formControlName="notes" rows="2" placeholder="SIP, lump-sum, folio..."></textarea>
        </div>
      </form>
    </div>
    <div class="f">
      <button mat-stroked-button (click)="cancel()" style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:120px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : 'Add Transaction' }}
      </button>
    </div>
  `,
})
export class MfTxnDialogComponent {
  form: FormGroup;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: TxnDialogData,
    private dialogRef: MatDialogRef<MfTxnDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      type:    ['purchase', Validators.required],
      txnDate: [new Date().toISOString().slice(0, 10), Validators.required],
      units:   [null, [Validators.required, Validators.min(0.0001)]],
      nav:     [null, [Validators.required, Validators.min(0.0001)]],
      amount:  [null, [Validators.required, Validators.min(0.01)]],
      notes:   [''],
    });
  }

  inv(c: string): boolean { const ctrl = this.form.get(c); return !!(ctrl?.invalid && ctrl?.touched); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;
    const body = {
      type:    v.type,
      txnDate: v.txnDate,
      units:   Number(v.units),
      nav:     Number(v.nav),
      amount:  Number(v.amount),
      notes:   v.notes || undefined,
    };
    this.http.post(`${environment.apiUrl}/mutual-funds/${this.data.fundId}/transactions`, body)
      .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── List component ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-mf-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, CurrencyPipe, DatePipe, DecimalPipe, TitleCasePipe,
    MatProgressSpinnerModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatDialogModule,
  ],
  styles: [`
    :host { display:block;padding:24px;background:#F8FAFC;min-height:100%; }

    .spinner-wrap { display:flex;justify-content:center;padding:80px; }

    /* ── Stats ── */
    .stats-row { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px; }
    .stat-card  { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px; }
    .stat-lbl   { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .stat-val   { font-size:1.5rem;font-weight:700;letter-spacing:-.5px;color:#0F172A; }
    .stat-val.cyan  { color:#0891B2; }
    .stat-val.green { color:#16A34A; }
    .stat-val.red   { color:#DC2626; }
    @media (max-width: 640px) { .stats-row { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 400px) { .stats-row { grid-template-columns: 1fr; } }

    /* ── Page header ── */
    .page-hdr   { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
    .page-title { font-size:1.125rem;font-weight:700;color:#0F172A; }

    /* ── Main table ── */
    .table-wrap { background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden; }
    table { width:100%;border-collapse:collapse; }
    th {
      text-align:left;padding:10px 14px;
      font-size:.6875rem;font-weight:700;text-transform:uppercase;
      letter-spacing:.06em;color:#94A3B8;
      border-bottom:1px solid #E2E8F0;background:#F8FAFC;
    }
    td { padding:12px 14px;border-bottom:1px solid #F1F5F9;font-size:.875rem;color:#374151;vertical-align:middle; }
    tr:last-child > td { border-bottom:none; }
    tr.fund-row:hover > td { background:#FAFAFA;cursor:pointer; }

    .fund-name  { font-weight:600;color:#0F172A; }
    .fund-meta  { font-size:.75rem;color:#94A3B8;margin-top:2px; }
    .mono { font-family:monospace;font-size:.8125rem; }
    .cyan  { color:#0891B2; }
    .green { color:#16A34A;font-weight:600; }
    .red   { color:#DC2626;font-weight:600; }

    .txn-badge {
      display:inline-flex;align-items:center;justify-content:center;
      background:#F1F5F9;color:#475569;border-radius:10px;
      padding:0 6px;height:18px;font-size:.6875rem;font-weight:700;
    }

    /* ── Expanded transactions ── */
    .txn-expand td { padding:0;background:#F8FAFC; }
    .txn-inner  { border-top:1px solid #E2E8F0; }
    .txn-table  { width:100%;border-collapse:collapse; }
    .txn-table th {
      padding:7px 14px 7px 28px;
      font-size:.625rem;font-weight:700;text-transform:uppercase;
      letter-spacing:.06em;color:#94A3B8;background:#F8FAFC;
      border-bottom:1px solid #E2E8F0;
    }
    .txn-table td {
      padding:9px 14px 9px 28px;border-bottom:1px solid #F1F5F9;
      font-size:.8125rem;color:#374151;background:#F8FAFC;
    }
    .txn-table tr:last-child td { border-bottom:none; }
    .txn-table tr:hover td { background:#F1F5F9; }
    .txn-table th.r, .txn-table td.r { text-align:right; }

    .type-badge {
      display:inline-flex;padding:2px 8px;border-radius:20px;
      font-size:.6875rem;font-weight:600;
    }
    .type-badge.purchase   { background:#F0FDF4;color:#15803D; }
    .type-badge.redemption { background:#FEF2F2;color:#B91C1C; }

    /* ── Action buttons ── */
    .actions { display:flex;gap:4px; }
    .btn-i { width:28px;height:28px;border-radius:7px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:none; }
    .btn-i mat-icon { font-size:15px;width:15px;height:15px; }
    .btn-add  { color:#059669; } .btn-add:hover  { background:#ECFDF5; }
    .btn-edit { color:#3B82F6; } .btn-edit:hover { background:#EFF6FF; }
    .btn-del  { color:#EF4444; } .btn-del:hover  { background:#FEF2F2; }

    /* ── Refresh status bar ── */
    .rs { display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;border:1px solid;font-size:.8125rem;font-weight:500;margin-bottom:12px; }
    .rs mat-icon { font-size:16px;width:16px;height:16px;flex-shrink:0; }
    .rs.ok   { background:#F0FDF4;border-color:#86EFAC;color:#15803D; }
    .rs.warn { background:#FFFBEB;border-color:#FCD34D;color:#92400E; }
    .rs.err  { background:#FEF2F2;border-color:#FCA5A5;color:#B91C1C; }

    /* ── Empty ── */
    .empty { text-align:center;padding:60px 0; }
    .empty mat-icon { font-size:48px;width:48px;height:48px;color:#CBD5E1;display:block;margin:0 auto 12px; }
    .empty p { color:#94A3B8;margin:0; }

    /* ── Delete overlay ── */
    .del-overlay { position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:100; }
    .del-box { background:white;border-radius:14px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .del-title { font-size:1rem;font-weight:700;color:#0F172A;margin:0 0 8px; }
    .del-body  { font-size:.875rem;color:#64748B;margin:0 0 20px; }
    .del-actions { display:flex;justify-content:flex-end;gap:8px; }
  `],
  template: `
    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>

    <ng-container *ngIf="!loading">

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">Total Invested</div>
          <div class="stat-val">{{ totalInvested | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Current Value</div>
          <div class="stat-val cyan">{{ totalValue | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total Profit / Loss</div>
          <div class="stat-val" [class.green]="totalPL >= 0" [class.red]="totalPL < 0">
            {{ totalPL >= 0 ? '+' : '' }}{{ totalPL | currency:'INR':'symbol-narrow':'1.0-0' }}
          </div>
        </div>
      </div>

      <!-- Refresh status bar -->
      <div *ngIf="refreshStatus" class="rs" [class.ok]="refreshStatus.type==='ok'" [class.warn]="refreshStatus.type==='warn'" [class.err]="refreshStatus.type==='err'">
        <mat-icon>{{ refreshStatus.type==='ok' ? 'check_circle' : refreshStatus.type==='warn' ? 'info' : 'error_outline' }}</mat-icon>
        {{ refreshStatus.msg }}
      </div>

      <!-- Header -->
      <div class="page-hdr">
        <span class="page-title">Mutual Funds</span>
        <div style="display:flex;align-items:center;gap:8px">
          <button mat-stroked-button (click)="refreshAllNav()" [disabled]="refreshing || funds.length === 0"
            style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
            <mat-spinner *ngIf="refreshing" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
            <mat-icon *ngIf="!refreshing" style="font-size:16px;width:16px;height:16px;margin-right:4px">sync</mat-icon>
            {{ refreshing ? 'Refreshing…' : 'Refresh NAV' }}
          </button>
          <button mat-flat-button color="primary" (click)="openAddFund()"
            style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
            <mat-icon style="font-size:16px;width:16px;height:16px;margin-right:4px">add</mat-icon>
            Add Fund
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <div *ngIf="funds.length === 0" class="empty">
          <mat-icon>trending_up</mat-icon>
          <p>No mutual funds yet. Click <strong>Add Fund</strong> to get started.</p>
        </div>

        <table *ngIf="funds.length > 0">
          <thead>
            <tr>
              <th>Fund Name</th>
              <th>Units</th>
              <th>Latest NAV</th>
              <th>Invested</th>
              <th>Current Value</th>
              <th>P&amp;L</th>
              <th>Txns</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let fund of funds">

              <!-- Fund row -->
              <tr class="fund-row" (click)="toggle(fund.id)">
                <td>
                  <div class="fund-name">{{ fund.name }}</div>
                  <div class="fund-meta" *ngIf="fund.scheme_code">Scheme: {{ fund.scheme_code }}</div>
                  <div class="fund-meta" *ngIf="fund.notes">{{ fund.notes }}</div>
                </td>
                <td class="mono">{{ fund.total_units | number:'1.4-4' }}</td>
                <td class="mono cyan">₹{{ fund.latest_nav | number:'1.2-2' }}</td>
                <td class="mono">{{ fund.total_invested | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
                <td class="mono">{{ fund.total_value | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
                <td>
                  <span class="mono" [class.green]="fund.profit_loss >= 0" [class.red]="fund.profit_loss < 0">
                    {{ fund.profit_loss >= 0 ? '+' : '' }}{{ fund.profit_loss | currency:'INR':'symbol-narrow':'1.0-0' }}
                  </span>
                </td>
                <td>
                  <span class="txn-badge">{{ fund.transactions.length }}</span>
                </td>
                <td (click)="$event.stopPropagation()">
                  <div class="actions">
                    <button class="btn-i btn-add" (click)="openAddTxn(fund)" matTooltip="Add Transaction">
                      <mat-icon>add</mat-icon>
                    </button>
                    <button class="btn-i btn-edit" (click)="openEditFund(fund)" matTooltip="Edit Fund">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button class="btn-i btn-del" (click)="confirmDeleteFund(fund)" matTooltip="Delete Fund">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Expanded transactions -->
              <tr class="txn-expand" *ngIf="expanded.has(fund.id)">
                <td colspan="8">
                  <div class="txn-inner">
                    <table class="txn-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th class="r">Units</th>
                          <th class="r">Purchase NAV</th>
                          <th class="r">Amount</th>
                          <th class="r"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngIf="fund.transactions.length === 0">
                          <td colspan="6" style="text-align:center;color:#94A3B8;padding:20px">
                            No transactions — click <strong>+</strong> to add one.
                          </td>
                        </tr>
                        <tr *ngFor="let txn of fund.transactions">
                          <td style="white-space:nowrap">{{ txn.txn_date | date:'d MMM y' }}</td>
                          <td>
                            <span class="type-badge" [class.purchase]="txn.type==='purchase'" [class.redemption]="txn.type==='redemption'">
                              {{ txn.type | titlecase }}
                            </span>
                          </td>
                          <td class="r mono">{{ txn.units | number:'1.4-4' }}</td>
                          <td class="r mono">₹{{ txn.nav | number:'1.2-2' }}</td>
                          <td class="r mono" style="font-weight:600">{{ txn.amount | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
                          <td class="r">
                            <button class="btn-i btn-del" (click)="confirmDeleteTxn(txn, fund)" matTooltip="Delete">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>

            </ng-container>
          </tbody>
        </table>
      </div>

    </ng-container>

    <!-- Delete confirm -->
    <div class="del-overlay" *ngIf="deleteTarget" (click)="deleteTarget = null">
      <div class="del-box" (click)="$event.stopPropagation()">
        <p class="del-title">{{ deleteTarget.type === 'fund' ? 'Delete Fund?' : 'Delete Transaction?' }}</p>
        <p class="del-body">
          <ng-container *ngIf="deleteTarget.type === 'fund'">
            <strong>{{ deleteTarget.label }}</strong> and all its transactions will be permanently removed.
          </ng-container>
          <ng-container *ngIf="deleteTarget.type === 'txn'">
            This transaction from <strong>{{ deleteTarget.label }}</strong> will be permanently removed.
          </ng-container>
        </p>
        <div class="del-actions">
          <button mat-stroked-button (click)="deleteTarget = null"
            style="height:32px;font-size:.8125rem;border-radius:7px">Cancel</button>
          <button mat-flat-button color="warn" (click)="doDelete()" [disabled]="deleting"
            style="height:32px;font-size:.8125rem;font-weight:600;border-radius:7px;min-width:90px">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MfListComponent implements OnInit {
  loading    = true;
  deleting   = false;
  refreshing = false;
  funds: MfFund[] = [];
  expanded = new Set<string>();
  deleteTarget: { type: 'fund' | 'txn'; id: string; label: string; } | null = null;
  refreshStatus: { type: 'ok' | 'warn' | 'err'; msg: string } | null = null;
  totalInvested = 0;
  totalValue    = 0;
  totalPL       = 0;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading = true;
    this.http.get<{ data: { funds: MfFund[] } }>(`${environment.apiUrl}/mutual-funds`).subscribe({
      next: (r) => {
        this.funds = r.data.funds ?? [];
        this.calcTotals();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private calcTotals(): void {
    this.totalInvested = this.funds.reduce((s, f) => s + f.total_invested, 0);
    this.totalValue    = this.funds.reduce((s, f) => s + f.total_value, 0);
    this.totalPL       = this.totalValue - this.totalInvested;
  }

  toggle(id: string): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
    this.cdr.markForCheck();
  }

  refreshAllNav(): void {
    if (this.refreshing) return;
    const withCode = this.funds.filter(f => f.scheme_code);
    const noCode   = this.funds.length - withCode.length;
    if (withCode.length === 0) {
      this.refreshStatus = { type: 'warn', msg: `No funds have a scheme code — edit a fund to add its AMFI scheme code and enable auto-refresh` };
      this.cdr.markForCheck();
      return;
    }
    this.refreshing = true;
    this.refreshStatus = null;
    this.cdr.markForCheck();

    const navReqs = withCode.map(f =>
      this.http.get<{ data: { nav: { nav: number } } }>(
        `${environment.apiUrl}/mutual-funds/nav/${encodeURIComponent(f.scheme_code!)}`
      ).pipe(
        map(res => ({ fund: f, nav: res.data.nav.nav })),
        catchError(() => of(null as { fund: MfFund; nav: number } | null))
      )
    );

    forkJoin(navReqs).pipe(
      switchMap(results => {
        const valid       = results.filter((r): r is { fund: MfFund; nav: number } => r !== null);
        const fetchFailed = results.length - valid.length;
        if (valid.length === 0) return of({ updated: 0, fetchFailed, noCode });
        const patchReqs = valid.map(r =>
          this.http.patch(`${environment.apiUrl}/mutual-funds/${r.fund.id}`, { latestNav: r.nav }).pipe(
            map(() => true), catchError(() => of(false))
          )
        );
        return forkJoin(patchReqs).pipe(
          map(patches => ({
            updated: patches.filter(Boolean).length,
            fetchFailed: fetchFailed + patches.filter(p => !p).length,
            noCode,
          }))
        );
      })
    ).subscribe({
      next: ({ updated, fetchFailed, noCode: nc }) => {
        this.refreshing = false;
        const skippedNote = nc > 0 ? ` · ${nc} skipped (no scheme code)` : '';
        if (updated === withCode.length) {
          this.refreshStatus = { type: 'ok', msg: `All ${updated} NAVs updated successfully${skippedNote}` };
          setTimeout(() => { this.refreshStatus = null; this.cdr.markForCheck(); }, 8000);
        } else if (updated > 0) {
          this.refreshStatus = { type: 'warn', msg: `${updated} of ${withCode.length} NAVs updated · ${fetchFailed} could not be fetched${skippedNote}` };
        } else {
          this.refreshStatus = { type: 'err', msg: `Could not fetch any NAVs — verify your scheme codes at mfapi.in${skippedNote}` };
        }
        this.load();
      },
      error: () => {
        this.refreshing = false;
        this.refreshStatus = { type: 'err', msg: 'Could not connect to the server — make sure the backend is running' };
        this.cdr.markForCheck();
      },
    });
  }

  openAddFund(): void {
    this.dialog.open(MfFundDialogComponent, {
      data: { fund: null } as FundDialogData,
      width: '460px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openEditFund(fund: MfFund): void {
    this.dialog.open(MfFundDialogComponent, {
      data: { fund } as FundDialogData,
      width: '460px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openAddTxn(fund: MfFund): void {
    this.expanded.add(fund.id);
    this.dialog.open(MfTxnDialogComponent, {
      data: { fundId: fund.id, fundName: fund.name } as TxnDialogData,
      width: '460px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  confirmDeleteFund(fund: MfFund): void {
    this.deleteTarget = { type: 'fund', id: fund.id, label: fund.name };
    this.cdr.markForCheck();
  }

  confirmDeleteTxn(txn: MfTransaction, fund: MfFund): void {
    this.deleteTarget = { type: 'txn', id: txn.id, label: fund.name };
    this.cdr.markForCheck();
  }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    const url = this.deleteTarget.type === 'fund'
      ? `${environment.apiUrl}/mutual-funds/${this.deleteTarget.id}`
      : `${environment.apiUrl}/mutual-funds/transactions/${this.deleteTarget.id}`;
    this.http.delete(url).subscribe({
      next: () => { this.deleting = false; this.deleteTarget = null; this.load(); },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }
}
