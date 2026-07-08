import {
  Component, Inject, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BondPayout {
  id: string;
  bond_id: string;
  payout_date: string;
  frequency: string;
  interest_payout: number;
  tds: number;
  principal_amount: number;
  total_payout: number;
  notes: string | null;
}

interface BondRow {
  id: string;
  name: string;
  symbol: string | null;
  investment_amount: number;
  total_tds: number;
  expected_total_interest: number;
  total: number;
  purchase_date: string | null;
  maturity_date: string | null;
  meta: Record<string, unknown>;
  payouts: BondPayout[];
}

interface DialogData       { bond: BondRow | null; }
interface PayoutDialogData {
  bondId: string;
  bondName: string;
  prefillDate?: string;
  prefillFrequency?: string;
}

function nextPayoutDate(date: string, frequency: string): string {
  const d = new Date(date);
  switch (frequency) {
    case 'monthly':     d.setMonth(d.getMonth() + 1);          break;
    case 'quarterly':   d.setMonth(d.getMonth() + 3);          break;
    case 'half_yearly': d.setMonth(d.getMonth() + 6);          break;
    case 'annually':    d.setFullYear(d.getFullYear() + 1);    break;
  }
  return d.toISOString().slice(0, 10);
}

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly',
  half_yearly: 'Half Yearly', annually: 'Annually', one_time: 'One Time',
};

// ── Shared form styles ────────────────────────────────────────────────────────

const FORM_STYLES = [`
  .h { background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:14px 16px;display:flex;align-items:center;justify-content:space-between; }
  .hl { display:flex;align-items:center;gap:10px; }
  .hi { width:32px;height:32px;border-radius:8px;background:rgba(180,83,9,.2);border:1px solid rgba(180,83,9,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0; }
  .hi mat-icon { color:#FCD34D;font-size:16px;width:16px;height:16px; }
  .hi.green { background:rgba(22,163,74,.15);border-color:rgba(22,163,74,.3); }
  .hi.green mat-icon { color:#4ADE80; }
  .ht { font-size:.875rem;font-weight:700;color:#F8FAFC;margin:0;line-height:1.2; }
  .hs { font-size:.6875rem;color:rgba(255,255,255,.4);margin:1px 0 0; }
  .hx { background:rgba(255,255,255,.07);border:none;cursor:pointer;width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4); }
  .hx:hover { background:rgba(255,255,255,.14);color:#fff; }
  .hx mat-icon { font-size:13px;width:13px;height:13px; }

  .b { padding:12px 16px 8px;overflow-y:auto;max-height:calc(90vh - 120px); }
  .sl { font-size:.625rem;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;display:block; }
  .fg { display:flex;flex-direction:column;gap:2px;margin-bottom:8px; }
  .fg:last-child { margin-bottom:0; }
  .r2 { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
  .r3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px; }

  @media (max-width: 480px) {
    .r2, .r3 { grid-template-columns: 1fr; }
  }

  label { font-size:.6875rem;font-weight:600;color:#374151;display:block;margin-bottom:3px; }
  label .opt { color:#9CA3AF;font-weight:400; }
  label .req { color:#EF4444; }

  input.fi, select.fi { display:block;width:100%;height:34px;padding:0 9px;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:6px;font-size:.8125rem;color:#111827;background:#fff;font-family:inherit;outline:none;transition:border-color .12s,box-shadow .12s; }
  input.fi[disabled], input.fi:disabled { background:#F9FAFB;color:#6B7280;cursor:not-allowed; }
  input.fi::placeholder { color:#D1D5DB; }
  input.fi:focus,select.fi:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }

  .pfx { position:relative; }
  .pfx .sym { position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:.75rem;color:#9CA3AF;pointer-events:none; }
  .pfx input.fi { padding-left:18px; }

  textarea.fta { display:block;width:100%;padding:7px 9px;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:6px;font-size:.8125rem;color:#111827;background:#fff;font-family:inherit;outline:none;resize:none;line-height:1.45;transition:border-color .12s,box-shadow .12s; }
  textarea.fta:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }

  .total-box { border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px; }
  .total-box.green { background:#F0FDF4;border:1px solid #BBF7D0; }
  .total-box.blue  { background:#EFF6FF;border:1px solid #BFDBFE; }
  .total-lbl { font-size:.6875rem;font-weight:600; }
  .total-lbl.green { color:#15803D; }
  .total-lbl.blue  { color:#1D4ED8; }
  .total-val { font-size:1rem;font-weight:700; }
  .total-val.green { color:#15803D; }
  .total-val.blue  { color:#1D4ED8; }

  .f { padding:9px 16px 13px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
`];

// ── Payout Dialog ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-bond-payout-dialog',
  standalone: true,
  imports: [
    NgIf, CurrencyPipe, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  styles: FORM_STYLES,
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi green"><mat-icon>payments</mat-icon></div>
        <div>
          <p class="ht">Add Interest Payout</p>
          <p class="hs">{{ data.bondName }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="b">
      <form [formGroup]="form">

        <div class="r2">
          <div class="fg">
            <label>Date <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="payoutDate">
          </div>
          <div class="fg">
            <label>Frequency <span class="req">*</span></label>
            <select class="fi" formControlName="frequency">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half Yearly</option>
              <option value="annually">Annually</option>
              <option value="one_time">One Time</option>
            </select>
          </div>
        </div>

        <div class="r2">
          <div class="fg">
            <label>Interest Payout <span class="req">*</span></label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="interestPayout"
                     placeholder="0.00" min="0" step="0.01"
                     (input)="onInterestChange()">
            </div>
          </div>
          <div class="fg">
            <label>TDS (10%)</label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="tds"
                     placeholder="0.00" min="0" step="0.01">
            </div>
          </div>
        </div>

        <div class="fg">
          <label>Principal Amount <span class="opt">(optional)</span></label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="principalAmount"
                   placeholder="0.00" min="0" step="0.01">
          </div>
        </div>

        <div class="total-box green">
          <span class="total-lbl green">Total Payout &nbsp;<span style="font-weight:400;font-size:.625rem">(Interest + Principal − TDS)</span></span>
          <span class="total-val green">{{ totalPayout | currency:'INR':'symbol-narrow':'1.2-2' }}</span>
        </div>

        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <textarea class="fta" formControlName="notes" rows="2" placeholder="Any remarks…"></textarea>
        </div>

      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()"
        style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:104px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : 'Add Payout' }}
      </button>
    </div>
  `,
})
export class BondPayoutDialogComponent {
  form: FormGroup;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PayoutDialogData,
    private dialogRef: MatDialogRef<BondPayoutDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      payoutDate:      [data.prefillDate ?? new Date().toISOString().slice(0, 10), Validators.required],
      frequency:       [data.prefillFrequency ?? 'annually', Validators.required],
      interestPayout:  [null, [Validators.required, Validators.min(0)]],
      tds:             [0, Validators.min(0)],
      principalAmount: [0, Validators.min(0)],
      notes:           [''],
    });
  }

  get totalPayout(): number {
    const i = Number(this.form.value.interestPayout ?? 0);
    const t = Number(this.form.value.tds ?? 0);
    const p = Number(this.form.value.principalAmount ?? 0);
    return (isNaN(i) ? 0 : i) + (isNaN(p) ? 0 : p) - (isNaN(t) ? 0 : t);
  }

  onInterestChange(): void {
    const interest = Number(this.form.value.interestPayout ?? 0);
    const tds = isNaN(interest) ? 0 : Math.round(interest * 0.10 * 100) / 100;
    this.form.patchValue({ tds }, { emitEvent: false });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;
    this.http.post(`${environment.apiUrl}/bonds/${this.data.bondId}/payouts`, {
      payoutDate:      v.payoutDate,
      frequency:       v.frequency,
      interestPayout:  Number(v.interestPayout),
      tds:             Number(v.tds ?? 0),
      principalAmount: Number(v.principalAmount ?? 0),
      notes:           v.notes || null,
    }).subscribe({
      next:  () => this.dialogRef.close(true),
      error: () => { this.saving = false; },
    });
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── Bond Form Dialog ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-bond-form-dialog',
  standalone: true,
  imports: [
    NgIf, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  styles: FORM_STYLES,
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi"><mat-icon>receipt_long</mat-icon></div>
        <div>
          <p class="ht">{{ isEdit ? 'Edit Bond' : 'New Bond' }}</p>
          <p class="hs">{{ isEdit ? 'Update bond details' : 'Record a new bond holding' }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="b">
      <form [formGroup]="form">

        <span class="sl">Identification</span>
        <div class="r2">
          <div class="fg">
            <label>Bond Name <span class="req">*</span></label>
            <input class="fi" formControlName="name" placeholder="e.g. 7.26% GOI 2033">
          </div>
          <div class="fg">
            <label>ISIN <span class="opt">(optional)</span></label>
            <input class="fi" formControlName="isin" placeholder="e.g. IN0020180049">
          </div>
        </div>

        <span class="sl" style="margin-top:4px">Dates</span>
        <div class="r2">
          <div class="fg">
            <label>Purchase Date <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="purchaseDate">
          </div>
          <div class="fg">
            <label>Expiry Date <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="maturityDate">
          </div>
        </div>

        <span class="sl" style="margin-top:4px">Investment</span>
        <div class="fg">
          <label>Investment Amount <span class="req">*</span></label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="investmentAmount"
                   placeholder="e.g. 100000" min="0.01" step="0.01">
          </div>
        </div>

        <span class="sl" style="margin-top:4px">Notes</span>
        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <textarea class="fta" formControlName="notes" rows="2" placeholder="Broker, ISIN, any remarks…"></textarea>
        </div>

      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()"
        style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:104px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Bond') }}
      </button>
    </div>
  `,
})
export class BondFormDialogComponent {
  isEdit: boolean;
  form: FormGroup;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<BondFormDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.isEdit = data.bond !== null;
    this.form   = this.buildForm();
  }

  private buildForm(): FormGroup {
    const b = this.data.bond;
    if (b) {
      return this.fb.group({
        name:             [b.name, Validators.required],
        isin:             [b.symbol ?? ''],
        purchaseDate:     [b.purchase_date ? b.purchase_date.slice(0, 10) : '', Validators.required],
        maturityDate:     [b.maturity_date ? b.maturity_date.slice(0, 10) : '', Validators.required],
        investmentAmount: [b.investment_amount, [Validators.required, Validators.min(0.01)]],
        notes:            [(b.meta?.['notes'] as string) ?? ''],
      });
    }
    return this.fb.group({
      name:             ['', Validators.required],
      isin:             [''],
      purchaseDate:     [this.today(), Validators.required],
      maturityDate:     ['', Validators.required],
      investmentAmount: [null, [Validators.required, Validators.min(0.01)]],
      notes:            [''],
    });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;

    const body: Record<string, unknown> = {
      name:             v.name,
      isin:             v.isin || null,
      purchaseDate:     v.purchaseDate,
      maturityDate:     v.maturityDate,
      investmentAmount: Number(v.investmentAmount),
      notes:            v.notes || null,
    };

    const url = this.isEdit
      ? `${environment.apiUrl}/bonds/${this.data.bond!.id}`
      : `${environment.apiUrl}/bonds`;
    const req = this.isEdit
      ? this.http.patch(url, body)
      : this.http.post(url, body);

    req.subscribe({
      next:  () => this.dialogRef.close(true),
      error: () => { this.saving = false; },
    });
  }

  cancel(): void { this.dialogRef.close(false); }
  private today(): string { return new Date().toISOString().slice(0, 10); }
}

// ── List component ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-bonds-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, CurrencyPipe, DatePipe,
    MatProgressSpinnerModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatDialogModule,
  ],
  styles: [`
    :host { display:block;padding:24px;background:#F8FAFC;min-height:100%; }

    .spinner-wrap { display:flex;justify-content:center;padding:80px; }

    /* Stats */
    .stats-row { display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px; }
    .stat-card  { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px; }
    .stat-lbl   { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .stat-val   { font-size:1.5rem;font-weight:700;letter-spacing:-.5px;color:#0F172A; }
    .stat-val.amber { color:#B45309; }
    @media (max-width: 900px) { .stats-row { grid-template-columns: repeat(3,1fr); } }
    @media (max-width: 640px) { .stats-row { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 400px) { .stats-row { grid-template-columns: 1fr; } }
    .stat-val.green { color:#16A34A; }
    .stat-val.blue  { color:#1D4ED8; }
    .stat-val.red   { color:#DC2626; }

    /* Header */
    .page-hdr   { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
    .page-title { font-size:1.125rem;font-weight:700;color:#0F172A; }

    /* Column grid: icon | name | purchase | expiry | investment | tds | interest | total | actions */
    .col-grid { display:grid;grid-template-columns:28px minmax(140px,1fr) 106px 106px 118px 78px 128px 108px 76px;align-items:center;gap:0; }

    /* Column header row */
    .col-hdr { padding:8px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:8px; }
    .th { font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8; }

    /* Bond cards */
    .bond-card { background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:10px; }
    .bond-summary { padding:12px 14px;cursor:pointer;transition:background .1s; }
    .bond-summary:hover { background:#FAFBFC; }

    .expand-ic { color:#94A3B8;font-size:20px;width:20px;height:20px;transition:transform .15s;flex-shrink:0; }
    .expand-ic.open { transform:rotate(180deg); }

    .bond-name { font-weight:600;color:#0F172A;font-size:.8125rem; }
    .bond-isin { font-size:.6875rem;color:#94A3B8;margin-top:1px;font-family:monospace; }

    .mono  { font-family:monospace;font-size:.8125rem; }
    .green { color:#16A34A;font-weight:600; }
    .blue  { color:#1D4ED8;font-weight:600; }
    .red   { color:#DC2626;font-weight:600; }
    .muted { color:#94A3B8; }

    /* Actions */
    .actions { display:flex;gap:2px; }
    .btn-i { width:24px;height:24px;border-radius:6px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:none; }
    .btn-i mat-icon { font-size:14px;width:14px;height:14px; }
    .btn-edit   { color:#3B82F6; } .btn-edit:hover   { background:#EFF6FF; }
    .btn-payout { color:#16A34A; } .btn-payout:hover { background:#F0FDF4; }
    .btn-del    { color:#EF4444; } .btn-del:hover    { background:#FEF2F2; }

    /* Payout section inside card */
    .payout-wrap  { background:#F8FAFC;border-top:2px solid #E2E8F0; }
    .payout-header { display:flex;align-items:center;justify-content:space-between;padding:10px 16px 8px; }
    .payout-title  { font-size:.6875rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em; }
    .payout-empty  { padding:14px 16px;color:#94A3B8;font-size:.8125rem; }

    .ptable { width:100%;border-collapse:collapse; }
    .ptable th { text-align:left;padding:5px 12px;font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;border-bottom:1px solid #E2E8F0;background:#F1F5F9; }
    .ptable td { padding:6px 12px;border-bottom:1px solid #F1F5F9;font-size:.8125rem;color:#374151; }
    .ptable tr:last-child td { border-bottom:none; }

    .freq-badge  { display:inline-flex;padding:1px 7px;border-radius:20px;font-size:.625rem;font-weight:600;background:#EFF6FF;color:#1D4ED8;white-space:nowrap; }
    .tds-badge   { display:inline-flex;padding:1px 7px;border-radius:20px;font-size:.625rem;font-weight:600;background:#FEF2F2;color:#B91C1C;white-space:nowrap;font-family:monospace; }
    .total-green { color:#16A34A;font-weight:600;font-family:monospace; }

    /* Empty */
    .empty { text-align:center;padding:60px 0; }
    .empty mat-icon { font-size:48px;width:48px;height:48px;color:#CBD5E1;display:block;margin:0 auto 12px; }
    .empty p { color:#94A3B8;margin:0; }

    /* Delete confirm */
    .del-overlay { position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:100; }
    .del-box     { background:white;border-radius:14px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .del-title   { font-size:1rem;font-weight:700;color:#0F172A;margin:0 0 8px; }
    .del-body    { font-size:.875rem;color:#64748B;margin:0 0 20px; }
    .del-actions { display:flex;justify-content:flex-end;gap:8px; }
  `],
  template: `
    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>

    <ng-container *ngIf="!loading">

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">Holdings</div>
          <div class="stat-val">{{ bonds.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total Invested</div>
          <div class="stat-val amber">{{ totalInvested | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">TDS Deducted</div>
          <div class="stat-val red">{{ totalTds | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Expected Interest (Net)</div>
          <div class="stat-val green">{{ totalExpectedInterest | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total (Invested + Interest)</div>
          <div class="stat-val blue">{{ grandTotal | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
      </div>

      <!-- Header -->
      <div class="page-hdr">
        <span class="page-title">Bond Holdings</span>
        <button mat-flat-button color="primary" (click)="openAdd()"
          style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
          <mat-icon style="font-size:16px;width:16px;height:16px;margin-right:4px">add</mat-icon>
          Add Bond
        </button>
      </div>

      <!-- Empty state -->
      <div *ngIf="bonds.length === 0" class="empty">
        <mat-icon>receipt_long</mat-icon>
        <p>No bond holdings yet. Click <strong>Add Bond</strong> to get started.</p>
      </div>

      <!-- Column header -->
      <div *ngIf="bonds.length > 0" class="col-hdr col-grid">
        <div></div>
        <div class="th">Bond</div>
        <div class="th">Purchase Date</div>
        <div class="th">Expiry Date</div>
        <div class="th">Investment Amount</div>
        <div class="th">TDS</div>
        <div class="th">Expected Interest</div>
        <div class="th">Total</div>
        <div class="th"></div>
      </div>

      <!-- Bond cards -->
      <div *ngFor="let b of bonds" class="bond-card">

        <!-- Clickable summary row -->
        <div class="bond-summary col-grid" (click)="toggleExpand(b.id)">
          <mat-icon class="expand-ic" [class.open]="expanded[b.id]">expand_more</mat-icon>
          <div>
            <div class="bond-name">{{ b.name }}</div>
            <div class="bond-isin" *ngIf="b.symbol">{{ b.symbol }}</div>
          </div>
          <div class="mono">
            <span *ngIf="b.purchase_date">{{ b.purchase_date | date:'d MMM y' }}</span>
            <span *ngIf="!b.purchase_date" class="muted">—</span>
          </div>
          <div class="mono">
            <span *ngIf="b.maturity_date">{{ b.maturity_date | date:'d MMM y' }}</span>
            <span *ngIf="!b.maturity_date" class="muted">—</span>
          </div>
          <div class="mono">{{ b.investment_amount | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          <div class="mono red">{{ b.total_tds | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          <div class="mono green">{{ b.expected_total_interest | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          <div class="mono blue">{{ b.total | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
          <div (click)="$event.stopPropagation()">
            <div class="actions">
              <button class="btn-i btn-edit" (click)="openEdit(b)" matTooltip="Edit">
                <mat-icon>edit</mat-icon>
              </button>
              <button class="btn-i btn-payout" (click)="openAddPayout(b)" matTooltip="Add Payout">
                <mat-icon>payments</mat-icon>
              </button>
              <button class="btn-i btn-del" (click)="confirmDelete(b)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Expanded payout section -->
        <div class="payout-wrap" *ngIf="expanded[b.id]">
          <div class="payout-header">
            <span class="payout-title">Interest Payouts ({{ b.payouts.length }})</span>
            <button mat-stroked-button (click)="openAddPayout(b)"
              style="height:26px;font-size:.75rem;font-weight:600;border-radius:6px;line-height:1">
              <mat-icon style="font-size:13px;width:13px;height:13px;margin-right:3px">add</mat-icon>
              Add Payout
            </button>
          </div>

          <div *ngIf="b.payouts.length === 0" class="payout-empty">
            No payouts recorded yet. Add one to update Expected Interest.
          </div>

          <table *ngIf="b.payouts.length > 0" class="ptable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Frequency</th>
                <th>Interest</th>
                <th>TDS (10%)</th>
                <th>Principal</th>
                <th>Total Payout</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of b.payouts; let first = first" [style.opacity]="isPast(p.payout_date) ? '0.4' : '1'">
                <td class="mono">{{ p.payout_date | date:'d MMM y' }}</td>
                <td><span class="freq-badge">{{ freqLabel(p.frequency) }}</span></td>
                <td class="mono">{{ p.interest_payout | currency:'INR':'symbol-narrow':'1.2-2' }}</td>
                <td><span class="tds-badge">− {{ p.tds | currency:'INR':'symbol-narrow':'1.2-2' }}</span></td>
                <td class="mono">{{ p.principal_amount | currency:'INR':'symbol-narrow':'1.2-2' }}</td>
                <td class="total-green">{{ p.total_payout | currency:'INR':'symbol-narrow':'1.2-2' }}</td>
                <td>
                  <div class="actions">
                    <button class="btn-i btn-del" (click)="deletePayout(p, b)" matTooltip="Delete payout">
                      <mat-icon>delete</mat-icon>
                    </button>
                    <button *ngIf="first" class="btn-i btn-payout" (click)="addPayoutFromPrevious(b, p)" matTooltip="Add next payout">
                      <mat-icon>add_circle_outline</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </ng-container>

    <!-- Delete bond confirm -->
    <div class="del-overlay" *ngIf="deleteTarget" (click)="deleteTarget = null">
      <div class="del-box" (click)="$event.stopPropagation()">
        <p class="del-title">Delete Bond?</p>
        <p class="del-body"><strong>{{ deleteTarget.name }}</strong> will be permanently removed along with all payout records.</p>
        <div class="del-actions">
          <button mat-stroked-button (click)="deleteTarget = null"
            style="height:32px;font-size:.8125rem;border-radius:7px">Cancel</button>
          <button mat-flat-button color="warn" (click)="deleteBond()" [disabled]="deleting"
            style="height:32px;font-size:.8125rem;font-weight:600;border-radius:7px;min-width:80px">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class BondsListComponent implements OnInit {
  loading  = true;
  deleting = false;
  today    = new Date().toISOString().slice(0, 10);
  bonds: BondRow[] = [];
  deleteTarget: BondRow | null = null;
  expanded: Record<string, boolean> = {};

  totalInvested         = 0;
  totalTds              = 0;
  totalExpectedInterest = 0;
  grandTotal            = 0;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadBonds(); }

  private loadBonds(): void {
    this.loading = true;
    this.http.get<{ data: { bonds: BondRow[] } }>(`${environment.apiUrl}/bonds`).subscribe({
      next: (r) => {
        this.bonds                = r.data.bonds ?? [];
        this.totalInvested        = this.bonds.reduce((s, x) => s + x.investment_amount,       0);
        this.totalTds             = this.bonds.reduce((s, x) => s + x.total_tds,               0);
        this.totalExpectedInterest= this.bonds.reduce((s, x) => s + x.expected_total_interest,  0);
        this.grandTotal           = this.bonds.reduce((s, x) => s + x.total,                   0);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  toggleExpand(id: string): void {
    this.expanded = { ...this.expanded, [id]: !this.expanded[id] };
    this.cdr.markForCheck();
  }

  freqLabel(freq: string): string { return FREQ_LABELS[freq] ?? freq; }

  isPast(payoutDate: string): boolean {
    return payoutDate.slice(0, 10) < this.today;
  }

  openAdd(): void {
    this.dialog.open(BondFormDialogComponent, {
      data: { bond: null } as DialogData,
      width: '480px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.loadBonds(); });
  }

  openEdit(b: BondRow): void {
    this.dialog.open(BondFormDialogComponent, {
      data: { bond: b } as DialogData,
      width: '480px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.loadBonds(); });
  }

  openAddPayout(b: BondRow): void {
    this.dialog.open(BondPayoutDialogComponent, {
      data: { bondId: b.id, bondName: b.name } as PayoutDialogData,
      width: '440px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => {
      if (saved) { this.expanded = { ...this.expanded, [b.id]: true }; this.loadBonds(); }
    });
  }

  addPayoutFromPrevious(b: BondRow, p: BondPayout): void {
    const prefillDate = nextPayoutDate(p.payout_date, p.frequency);
    this.dialog.open(BondPayoutDialogComponent, {
      data: { bondId: b.id, bondName: b.name, prefillDate, prefillFrequency: p.frequency } as PayoutDialogData,
      width: '440px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => {
      if (saved) { this.expanded = { ...this.expanded, [b.id]: true }; this.loadBonds(); }
    });
  }

  deletePayout(p: BondPayout, b: BondRow): void {
    this.http.delete(`${environment.apiUrl}/bonds/payouts/${p.id}`).subscribe({
      next: () => {
        b.payouts = b.payouts.filter(x => x.id !== p.id);
        const today        = new Date().toISOString().slice(0, 10);
        const futurePays   = b.payouts.filter(x => x.payout_date >= today);
        b.total_tds               = Math.round(futurePays.reduce((s, x) => s + x.tds,             0) * 100) / 100;
        const grossInterest        = Math.round(futurePays.reduce((s, x) => s + x.interest_payout, 0) * 100) / 100;
        b.expected_total_interest  = Math.round((grossInterest - b.total_tds) * 100) / 100;
        b.total                    = Math.round(futurePays.reduce((s, x) => s + x.total_payout,  0) * 100) / 100;
        this.totalTds              = this.bonds.reduce((s, x) => s + x.total_tds,               0);
        this.totalExpectedInterest = this.bonds.reduce((s, x) => s + x.expected_total_interest, 0);
        this.grandTotal            = this.bonds.reduce((s, x) => s + x.total,                   0);
        this.cdr.markForCheck();
      },
    });
  }

  confirmDelete(b: BondRow): void { this.deleteTarget = b; this.cdr.markForCheck(); }

  deleteBond(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.http.delete(`${environment.apiUrl}/bonds/${this.deleteTarget.id}`).subscribe({
      next:  () => { this.deleting = false; this.deleteTarget = null; this.loadBonds(); },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }
}
