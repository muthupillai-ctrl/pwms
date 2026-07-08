import {
  Component, Inject, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { LoansSummaryComponent } from './loans-summary.component';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LoanRow {
  id: string;
  name: string;
  balance: number;
  outstanding: number;
  accrued_interest: number;
  total_outstanding: number;
  original_amount: number;
  interest_earned: number;
  total_due: number;
  days_elapsed: number;
  is_overdue: boolean;
  borrower_email: string | null;
  meta: {
    borrower_name?: string;
    borrower_email?: string;
    interest_rate?: number;
    compounding?: string;
    loan_date?: string;
    due_date?: string;
    loan_type?: string;
    original_amount?: number;
    interest_earned?: number;
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

interface BorrowerGroup {
  borrowerName: string;
  loans: LoanRow[];
  totalOutstanding: number;
  borrowerEmail: string | null;
}

interface LoanDialogData  { loan: LoanRow | null; prefillBorrower?: string; }
interface RepayDialogData { loan: LoanRow; }

// ── Shared form styles ─────────────────────────────────────────────────────────

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
  .sfx { position:relative; }
  .sfx .unit { position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:.75rem;color:#9CA3AF;pointer-events:none; }
  .sfx input.fi { padding-right:34px; }
  .f { padding:9px 16px 13px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
`;

// ── Loan form dialog ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-loan-form-dialog',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styles: [FORM_STYLES],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi" style="background:rgba(22,163,74,.2);border:1px solid rgba(22,163,74,.35)">
          <mat-icon style="color:#86EFAC">handshake</mat-icon>
        </div>
        <div>
          <p class="ht">{{ isEdit ? 'Edit Loan' : 'New Loan' }}</p>
          <p class="hs">{{ isEdit ? 'Update loan details' : 'Record money lent out' }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="b">
      <form [formGroup]="form">
        <span class="sl">Borrower</span>
        <div class="r2">
          <div class="fg">
            <label>Borrower Name <span class="req">*</span></label>
            <input class="fi" formControlName="borrowerName" placeholder="e.g. Ravi Kumar"
              [class.err]="inv('borrowerName')">
            <span class="ferr" *ngIf="inv('borrowerName')">Required</span>
          </div>
          <div class="fg">
            <label>Loan Type</label>
            <select class="fi" formControlName="loanType">
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div class="fg">
          <label>Borrower Email <span class="opt">(for portal access)</span></label>
          <input class="fi" type="email" formControlName="borrowerEmail" placeholder="borrower@example.com"
            [class.err]="inv('borrowerEmail')">
          <span class="ferr" *ngIf="inv('borrowerEmail')">Enter a valid email</span>
        </div>

        <span class="sl" style="margin-top:10px">Loan Details</span>
        <div class="r2">
          <div class="fg">
            <label>Amount <span class="req">*</span></label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="amount" placeholder="50000" min="0.01"
                [class.err]="inv('amount')">
            </div>
            <span class="ferr" *ngIf="inv('amount')">Required</span>
          </div>
          <div class="fg">
            <label>Interest Rate <span class="opt">(p.a.)</span></label>
            <div class="sfx">
              <input class="fi" type="number" formControlName="interestRate" step="0.01" placeholder="12" min="0" max="100">
              <span class="unit">%</span>
            </div>
          </div>
        </div>
        <div class="fg">
          <label>Compounding Frequency</label>
          <select class="fi" formControlName="compounding">
            <option value="monthly">Monthly (12×/year)</option>
            <option value="quarterly">Quarterly (4×/year)</option>
            <option value="half_yearly">Half-yearly (2×/year)</option>
            <option value="annually">Annually (1×/year)</option>
          </select>
        </div>
        <div class="r2">
          <div class="fg">
            <label>Loan Date <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="loanDate" [class.err]="inv('loanDate')">
            <span class="ferr" *ngIf="inv('loanDate')">Required</span>
          </div>
          <div class="fg">
            <label>Due Date <span class="opt">(optional)</span></label>
            <input class="fi" type="date" formControlName="dueDate">
          </div>
        </div>
        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <input class="fi" formControlName="notes" placeholder="Purpose, collateral...">
        </div>
      </form>
    </div>
    <div class="f">
      <button mat-stroked-button (click)="cancel()" style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:100px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Loan') }}
      </button>
    </div>
  `,
})
export class LoanFormDialogComponent implements OnInit {
  isEdit: boolean;
  form!: FormGroup;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: LoanDialogData,
    private dialogRef: MatDialogRef<LoanFormDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) { this.isEdit = data.loan !== null; }

  ngOnInit(): void {
    const l = this.data.loan;
    this.form = this.fb.group({
      borrowerName:  [l?.meta.borrower_name ?? this.data.prefillBorrower ?? '', Validators.required],
      borrowerEmail: [l?.borrower_email ?? l?.meta.borrower_email ?? '', Validators.email],
      loanType:      [l?.meta.loan_type ?? 'personal'],
      amount:        [null, this.isEdit ? [] : [Validators.required, Validators.min(0.01)]],
      interestRate:  [l?.meta.interest_rate ?? 0],
      compounding:   [l?.meta.compounding ?? 'monthly'],
      loanDate:      [l?.meta.loan_date ?? this.today(), this.isEdit ? [] : Validators.required],
      dueDate:       [l?.meta.due_date ?? ''],
      notes:         [l?.meta['notes'] ?? ''],
    });
  }

  inv(c: string): boolean { const ctrl = this.form.get(c); return !!(ctrl?.invalid && ctrl?.touched); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;

    if (this.isEdit) {
      const body: Record<string, unknown> = {
        borrowerName: v.borrowerName,
        interestRate: Number(v.interestRate) || 0,
        compounding:  v.compounding,
        loanType:     v.loanType,
        borrowerEmail: v.borrowerEmail || null,
      };
      if (v.dueDate)  body['dueDate'] = v.dueDate;
      if (v.notes)    body['notes']   = v.notes;
      this.http.patch(`${environment.apiUrl}/loans/${this.data.loan!.id}`, body)
        .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
    } else {
      const body: Record<string, unknown> = {
        borrowerName: v.borrowerName,
        amount:       Number(v.amount),
        interestRate: Number(v.interestRate) || 0,
        compounding:  v.compounding,
        loanDate:     v.loanDate,
        loanType:     v.loanType,
        currency:     'INR',
      };
      if (v.dueDate)       body['dueDate']       = v.dueDate;
      if (v.notes)         body['notes']         = v.notes;
      if (v.borrowerEmail) body['borrowerEmail'] = v.borrowerEmail;
      this.http.post(`${environment.apiUrl}/loans`, body)
        .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
    }
  }

  cancel(): void { this.dialogRef.close(false); }
  private today(): string { return new Date().toISOString().slice(0, 10); }
}

// ── Repayment dialog ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-repayment-dialog',
  standalone: true,
  imports: [NgIf, DecimalPipe, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styles: [FORM_STYLES + `
    .preview { background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:10px 12px;margin-top:10px; }
    .preview-title { font-size:.625rem;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px; }
    .preview-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
    .pv-item { text-align:center; }
    .pv-label { font-size:.625rem;color:#6B7280;margin-bottom:2px; }
    .pv-val { font-size:.9375rem;font-weight:700;color:#0F172A; }
    .pv-val.interest { color:#16A34A; }
    .pv-val.principal { color:#2563EB; }
  `],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi" style="background:rgba(37,99,235,.2);border:1px solid rgba(37,99,235,.35)">
          <mat-icon style="color:#93C5FD">payments</mat-icon>
        </div>
        <div>
          <p class="ht">Add Repayment</p>
          <p class="hs">{{ data.loan.meta.borrower_name }} · {{ data.loan.meta.interest_rate }}% p.a.</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="b">
      <form [formGroup]="form">
        <span class="sl">Repayment Details</span>
        <div class="r2">
          <div class="fg">
            <label>Date of Repayment <span class="req">*</span></label>
            <input class="fi" type="date" formControlName="repaymentDate" [class.err]="inv('repaymentDate')">
            <span class="ferr" *ngIf="inv('repaymentDate')">Required</span>
          </div>
          <div class="fg">
            <label>Amount Paid <span class="req">*</span></label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="amountPaid"
                placeholder="e.g. 10000" min="0.01" [class.err]="inv('amountPaid')">
            </div>
            <span class="ferr" *ngIf="inv('amountPaid')">Required</span>
          </div>
        </div>
        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <input class="fi" formControlName="notes" placeholder="Cash, UPI, bank transfer...">
        </div>
      </form>

      <!-- Live preview -->
      <div class="preview" *ngIf="preview">
        <div class="preview-title">Calculated Breakdown</div>
        <div class="preview-grid">
          <div class="pv-item">
            <div class="pv-label">Days</div>
            <div class="pv-val">{{ preview.days }}</div>
          </div>
          <div class="pv-item">
            <div class="pv-label">Interest</div>
            <div class="pv-val interest">₹{{ preview.interest | number:'1.2-2' }}</div>
          </div>
          <div class="pv-item">
            <div class="pv-label">Principal</div>
            <div class="pv-val principal">₹{{ preview.principal | number:'1.2-2' }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="f">
      <button mat-stroked-button (click)="cancel()" style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:120px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : 'Save Repayment' }}
      </button>
    </div>
  `,
})
export class RepaymentDialogComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  saving = false;
  preview: { days: number; interest: number; principal: number } | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RepayDialogData,
    private dialogRef: MatDialogRef<RepaymentDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      repaymentDate: [new Date().toISOString().slice(0, 10), Validators.required],
      amountPaid:    [null, [Validators.required, Validators.min(0.01)]],
      notes:         [''],
    });
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.calcPreview());
    this.calcPreview();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private calcPreview(): void {
    const v = this.form.value;
    const loanDate = this.data.loan.meta.loan_date;
    if (!v.repaymentDate || !v.amountPaid || Number(v.amountPaid) <= 0 || !loanDate) {
      this.preview = null; return;
    }
    const days = Math.max(0, Math.floor(
      (new Date(v.repaymentDate).getTime() - new Date(loanDate).getTime()) / 86_400_000
    ));
    const rate        = Number(this.data.loan.meta.interest_rate ?? 0);
    const compounding = this.data.loan.meta.compounding ?? 'monthly';
    const n           = ({ monthly: 12, quarterly: 4, half_yearly: 2, annually: 1 } as Record<string, number>)[compounding] ?? 12;
    const t           = days / 365;
    const P           = Number(v.amountPaid);
    const interest    = P > 0 && rate > 0 && t > 0
      ? Math.round(P * (Math.pow(1 + rate / (n * 100), n * t) - 1) * 100) / 100
      : 0;
    const principal   = Math.round((P - interest) * 100) / 100;
    this.preview = { days, interest, principal };
  }

  inv(c: string): boolean { const ctrl = this.form.get(c); return !!(ctrl?.invalid && ctrl?.touched); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;
    const body: Record<string, unknown> = {
      repaymentDate: v.repaymentDate,
      amountPaid:    Number(v.amountPaid),
    };
    if (v.notes) body['notes'] = v.notes;
    this.http.post(`${environment.apiUrl}/loans/${this.data.loan.id}/repayments`, body)
      .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── List component ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-loans-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, NgClass, CurrencyPipe, DatePipe, DecimalPipe,
    MatProgressSpinnerModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatDialogModule,
    LoansSummaryComponent,
  ],
  styles: [`
    .spinner-wrap { display:flex;justify-content:center;padding:100px 0; }

    /* Stats */
    .stats-row { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px; }
    .stat-card  { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px; }
    .stat-lbl   { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .stat-val   { font-size:1.5rem;font-weight:700;letter-spacing:-.5px;color:#0F172A; }
    .stat-val.green { color:#16A34A; }
    @media (max-width: 768px) { .stats-row { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 400px) { .stats-row { grid-template-columns: 1fr; } }

    /* Borrower group card */
    .borrower-card { background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:12px; }

    .borrower-hdr {
      display:flex;align-items:center;gap:10px;
      padding:12px 16px;border-bottom:1px solid #F1F5F9;
      background:#F8FAFC;
    }
    .borrower-ic { width:34px;height:34px;border-radius:50%;background:#F0FDF4;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .borrower-ic mat-icon { color:#22C55E;font-size:18px;width:18px;height:18px; }
    .borrower-name { font-size:.9375rem;font-weight:700;color:#0F172A;flex:1; }
    .borrower-count { font-size:.75rem;color:#94A3B8; }

    /* Loan row */
    .loan-row { border-bottom:1px solid #F1F5F9; }
    .loan-row:last-child { border-bottom:none; }

    .loan-summary {
      display:flex;align-items:center;gap:12px;
      padding:12px 16px;cursor:pointer;
      transition:background .1s;
    }
    .loan-summary:hover { background:#FAFBFC; }
    .loan-date-badge {
      background:#EFF6FF;color:#2563EB;border-radius:6px;
      padding:4px 8px;font-size:.6875rem;font-weight:600;white-space:nowrap;flex-shrink:0;
    }
    .loan-info { flex:1;min-width:0; }
    .loan-amount { font-size:.9375rem;font-weight:700;color:#0F172A; }
    .loan-meta   { font-size:.75rem;color:#94A3B8;margin-top:2px; }
    .loan-outstanding { text-align:right;min-width:110px; }
    .lo-label { font-size:.625rem;font-weight:600;text-transform:uppercase;color:#94A3B8;letter-spacing:.06em; }
    .lo-val   { font-size:.9375rem;font-weight:700;color:#B45309; }
    .badge-over  { display:inline-flex;padding:2px 8px;border-radius:20px;font-size:.6875rem;font-weight:600;background:#FEF2F2;color:#B91C1C; }
    .badge-active{ display:inline-flex;padding:2px 8px;border-radius:20px;font-size:.6875rem;font-weight:600;background:#F0FDF4;color:#15803D; }
    .loan-actions { display:flex;gap:4px;align-items:center;flex-shrink:0; }
    .btn-i { width:28px;height:28px;border-radius:7px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .12s; }
    .btn-add  { background:#F0FDF4;color:#16A34A; }
    .btn-add:hover  { background:#DCFCE7; }
    .btn-edit { background:#EFF6FF;color:#2563EB; }
    .btn-edit:hover { background:#DBEAFE; }
    .btn-del  { background:#FEF2F2;color:#DC2626; }
    .btn-del:hover  { background:#FEE2E2; }
    .btn-i mat-icon { font-size:14px;width:14px;height:14px; }
    .expand-ic { color:#94A3B8;font-size:18px;width:18px;height:18px;transition:transform .15s;flex-shrink:0; }
    .expand-ic.open { transform:rotate(180deg); }

    /* Tabs */
    .tab-wrap { border-top:1px solid #F1F5F9;background:#FAFBFC; }
    .tab-bar  { display:flex;border-bottom:1px solid #F1F5F9;padding:0 16px;background:white; }
    .tab-btn  { padding:8px 14px;font-size:.8125rem;font-weight:600;color:#94A3B8;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .12s,border-color .12s; }
    .tab-btn.active { color:#16A34A;border-bottom-color:#22C55E; }

    /* Details tab */
    .details-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:0; }
    .dg-item { padding:12px 16px;border-right:1px solid #F1F5F9;border-bottom:1px solid #F1F5F9; }
    .dg-item:nth-child(3n) { border-right:none; }
    .dg-item:nth-last-child(-n+3) { border-bottom:none; }
    .dg-label { font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin-bottom:4px; }
    .dg-val   { font-size:.9375rem;font-weight:700;color:#0F172A; }
    .dg-val.green  { color:#16A34A; }
    .dg-val.orange { color:#D97706; }

    /* Repayments tab */
    .repay-header { display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #F1F5F9; }
    .repay-table { width:100%;border-collapse:collapse; }
    .repay-table th { text-align:left;font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;padding:7px 14px;background:#F8FAFC;border-bottom:1px solid #F1F5F9;white-space:nowrap; }
    .repay-table th.right, .repay-table td.right { text-align:right; }
    .repay-table td { padding:10px 14px;border-bottom:1px solid #F8FAFC;font-size:.8125rem;color:#374151;vertical-align:middle; }
    .repay-table tr:last-child td { border-bottom:none; }
    .repay-table tr:hover td { background:#FAFBFC; }
    .type-badge { display:inline-flex;padding:2px 8px;border-radius:20px;font-size:.625rem;font-weight:700;background:#EFF6FF;color:#2563EB; }

    /* Empty */
    .empty { display:flex;flex-direction:column;align-items:center;padding:40px 0;gap:8px;text-align:center; }

    /* Delete overlay */
    .del-overlay { position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45); }
    .del-card { background:white;border-radius:16px;padding:28px 32px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center; }
    .del-icon { width:52px;height:52px;border-radius:50%;background:#FEF2F2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px; }
    .del-actions { display:flex;gap:10px;justify-content:center;margin-top:20px; }
  `],
  template: `
    <app-loans-summary></app-loans-summary>
    <div class="page-header">
      <div>
        <h1 class="page-title">Loans Given</h1>
        <p class="page-subtitle">Money lent out and interest earned</p>
      </div>
      <button mat-flat-button color="primary" (click)="openAdd()" style="border-radius:8px;font-weight:600">
        <mat-icon style="font-size:18px;width:18px;height:18px;margin-right:4px">add</mat-icon>
        Add Loan
      </button>
    </div>

    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="44"></mat-spinner></div>

    <ng-container *ngIf="!loading">

      <!-- Stats -->
      <div class="stats-row" *ngIf="loans.length > 0">
        <div class="stat-card">
          <div class="stat-lbl">Borrowers</div>
          <div class="stat-val">{{ borrowerGroups.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total Outstanding</div>
          <div class="stat-val">{{ totalOutstanding | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Accrued Interest</div>
          <div class="stat-val" style="color:#D97706">{{ totalAccrued | currency:'INR':'symbol-narrow':'1.0-2' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Interest Collected</div>
          <div class="stat-val green">{{ totalInterest | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="loans.length === 0" class="card">
        <div class="empty">
          <div style="width:64px;height:64px;border-radius:16px;background:#F0FDF4;display:flex;align-items:center;justify-content:center">
            <mat-icon style="color:#22C55E;font-size:28px;width:28px;height:28px">handshake</mat-icon>
          </div>
          <p style="font-size:1rem;font-weight:600;color:#0F172A;margin:0">No loans recorded</p>
          <p style="font-size:.875rem;color:#64748B;margin:0;max-width:300px">Click "Add Loan" to record money you've lent out.</p>
          <button mat-flat-button color="primary" (click)="openAdd()" style="border-radius:8px;font-weight:600;margin-top:4px">
            <mat-icon>add</mat-icon> Add Loan
          </button>
        </div>
      </div>

      <!-- Borrower groups -->
      <div *ngFor="let group of borrowerGroups" class="borrower-card">

        <!-- Borrower header -->
        <div class="borrower-hdr">
          <div class="borrower-ic"><mat-icon>person</mat-icon></div>
          <div style="flex:1;min-width:0">
            <div class="borrower-name">{{ group.borrowerName }}</div>
            <div *ngIf="group.borrowerEmail" style="font-size:.6875rem;color:#64748B;margin-top:1px">{{ group.borrowerEmail }}</div>
          </div>
          <span class="borrower-count">{{ group.loans.length }} loan{{ group.loans.length !== 1 ? 's' : '' }}</span>
          <span style="font-size:.8125rem;font-weight:700;color:#B45309;background:#FEF3C7;border-radius:6px;padding:3px 10px">
            {{ group.totalOutstanding | currency:'INR':'symbol-narrow':'1.0-2' }}
          </span>
          <button mat-stroked-button (click)="openAddForBorrower(group.borrowerName)"
            style="height:28px;font-size:.75rem;font-weight:600;border-radius:7px;line-height:1">
            <mat-icon style="font-size:14px;width:14px;height:14px">add</mat-icon> Add Loan
          </button>
        </div>

        <!-- Loans under this borrower -->
        <div *ngFor="let loan of group.loans" class="loan-row">

          <!-- Loan summary row (click to expand) -->
          <div class="loan-summary" (click)="toggleLoan(loan.id)">
            <mat-icon class="expand-ic" [class.open]="expanded.has(loan.id)">expand_more</mat-icon>
            <div class="loan-date-badge">{{ loan.meta.loan_date | date:'d MMM y' }}</div>
            <div class="loan-info">
              <div class="loan-amount">{{ loan.original_amount | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
              <div class="loan-meta">{{ loan.meta.interest_rate ?? 0 }}% p.a. · {{ loan.days_elapsed }} days elapsed
                <ng-container *ngIf="loan.meta.due_date"> · Due {{ loan.meta.due_date | date:'d MMM y' }}</ng-container>
              </div>
            </div>
            <span [ngClass]="loan.is_overdue ? 'badge-over' : 'badge-active'">
              {{ loan.is_overdue ? 'Overdue' : 'Active' }}
            </span>
            <div class="loan-outstanding">
              <div class="lo-label">Total Outstanding</div>
              <div class="lo-val">{{ loan.total_outstanding | currency:'INR':'symbol-narrow':'1.0-2' }}</div>
            </div>
            <div class="loan-actions" (click)="$event.stopPropagation()">
              <button class="btn-i btn-add" (click)="openAddRepayment(loan)" matTooltip="Add Repayment">
                <mat-icon>payments</mat-icon>
              </button>
              <button class="btn-i btn-edit" (click)="openEdit(loan)" matTooltip="Edit">
                <mat-icon>edit</mat-icon>
              </button>
              <button class="btn-i btn-del" (click)="confirmDelete(loan)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>

          <!-- Expanded content: tabs -->
          <div class="tab-wrap" *ngIf="expanded.has(loan.id)">
            <div class="tab-bar">
              <button class="tab-btn" [class.active]="activeTab(loan.id) === 0"
                (click)="setTab(loan.id, 0)">Loan Details</button>
              <button class="tab-btn" [class.active]="activeTab(loan.id) === 1"
                (click)="setTab(loan.id, 1)">Repayments</button>
            </div>

            <!-- Tab 0: Details -->
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
                <div class="dg-val" style="color:#D97706">{{ loan.accrued_interest | currency:'INR':'symbol-narrow':'1.2-2' }}</div>
              </div>
              <div class="dg-item" style="background:#FFF7ED;border-radius:0">
                <div class="dg-label" style="color:#92400E">Total Outstanding</div>
                <div class="dg-val" style="color:#B45309;font-size:1.0625rem">{{ loan.total_outstanding | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Interest Collected</div>
                <div class="dg-val green">{{ loan.interest_earned | currency:'INR':'symbol-narrow':'1.2-2' }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Days Elapsed</div>
                <div class="dg-val" [class.orange]="loan.is_overdue">{{ loan.days_elapsed }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Interest Rate</div>
                <div class="dg-val">{{ loan.meta.interest_rate ?? 0 }}% p.a.</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Compounding</div>
                <div class="dg-val" style="font-size:.875rem">{{ compoundingLabel(loan.meta.compounding) }}</div>
              </div>
              <div class="dg-item">
                <div class="dg-label">Loan Type</div>
                <div class="dg-val" style="text-transform:capitalize">{{ loan.meta.loan_type ?? 'Personal' }}</div>
              </div>
            </div>

            <!-- Tab 1: Repayments -->
            <div *ngIf="activeTab(loan.id) === 1">
              <div class="repay-header">
                <span style="font-size:.8125rem;font-weight:600;color:#374151">
                  {{ repayments.get(loan.id)?.length ?? 0 }} repayment(s)
                </span>
                <button mat-flat-button color="primary" (click)="openAddRepayment(loan)"
                  style="height:28px;font-size:.75rem;font-weight:600;border-radius:7px;line-height:1">
                  <mat-icon style="font-size:14px;width:14px;height:14px">add</mat-icon> Add Repayment
                </button>
              </div>

              <div *ngIf="repaymentLoading.has(loan.id)" style="padding:30px;text-align:center">
                <mat-spinner diameter="28" style="margin:0 auto"></mat-spinner>
              </div>

              <ng-container *ngIf="!repaymentLoading.has(loan.id)">
                <div *ngIf="(repayments.get(loan.id) ?? []).length === 0" class="empty" style="padding:28px 0">
                  <p style="font-size:.875rem;color:#94A3B8;margin:0">No repayments yet — click "Add Repayment" to record one.</p>
                </div>

                <table class="repay-table" *ngIf="(repayments.get(loan.id) ?? []).length > 0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th class="right">Amount Paid</th>
                      <th class="right">Days</th>
                      <th class="right">Interest</th>
                      <th class="right">Principal</th>
                      <th class="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of repayments.get(loan.id)">
                      <td style="white-space:nowrap">{{ r.repayment_date | date:'d MMM y' }}</td>
                      <td><span class="type-badge">Flexible</span></td>
                      <td class="right" style="font-weight:600">{{ r.amount_paid | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
                      <td class="right">{{ r.days }}</td>
                      <td class="right" style="color:#16A34A">₹{{ r.interest | number:'1.2-2' }}</td>
                      <td class="right" style="color:#2563EB">₹{{ r.principal | number:'1.2-2' }}</td>
                      <td class="right">
                        <button class="btn-i btn-del" (click)="confirmDeleteRepayment(r, loan)" matTooltip="Delete">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </ng-container>
            </div>

          </div>
        </div>
      </div>

    </ng-container>

    <!-- Delete confirm overlay -->
    <div class="del-overlay" *ngIf="deleteTarget">
      <div class="del-card">
        <div class="del-icon">
          <mat-icon style="color:#DC2626;font-size:24px;width:24px;height:24px">warning</mat-icon>
        </div>
        <p style="font-size:1.0625rem;font-weight:700;color:#0F172A;margin:0 0 8px">
          {{ deleteTarget.type === 'loan' ? 'Delete Loan?' : 'Delete Repayment?' }}
        </p>
        <p style="font-size:.875rem;color:#64748B;line-height:1.5;margin:0">
          <ng-container *ngIf="deleteTarget.type === 'loan'">
            Loan for <strong>{{ deleteTarget.label }}</strong> and all its repayments will be permanently removed.
          </ng-container>
          <ng-container *ngIf="deleteTarget.type === 'repayment'">
            This repayment will be deleted and the outstanding balance will be restored.
          </ng-container>
        </p>
        <div class="del-actions">
          <button mat-stroked-button (click)="deleteTarget = null" style="border-radius:8px">Cancel</button>
          <button mat-flat-button color="warn" (click)="doDelete()" [disabled]="deleting"
            style="border-radius:8px;font-weight:600;min-width:100px">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LoansListComponent implements OnInit {
  loading  = true;
  deleting = false;
  loans: LoanRow[] = [];
  borrowerGroups: BorrowerGroup[] = [];
  totalOutstanding    = 0;
  totalAccrued        = 0;
  totalInterest       = 0;

  expanded        = new Set<string>();
  tabs            = new Map<string, 0 | 1>();
  repayments      = new Map<string, LoanRepayment[]>();
  repaymentLoading = new Set<string>();

  deleteTarget: { type: 'loan' | 'repayment'; id: string; label: string; loanId?: string } | null = null;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading = true;
    this.http.get<{ data: { loans: LoanRow[] } }>(`${environment.apiUrl}/loans`).subscribe({
      next: (r) => {
        this.loans = r.data.loans ?? [];
        this.buildGroups();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private buildGroups(): void {
    const map = new Map<string, LoanRow[]>();
    for (const loan of this.loans) {
      const name = loan.meta.borrower_name || loan.name;
      const arr  = map.get(name) ?? [];
      arr.push(loan);
      map.set(name, arr);
    }
    this.borrowerGroups = Array.from(map.entries()).map(([borrowerName, loans]) => ({
      borrowerName,
      loans,
      borrowerEmail: loans.map(l => l.borrower_email || l.meta.borrower_email as string).find(e => !!e) ?? null,
      totalOutstanding: loans.reduce((s, l) => s + Number(l.total_outstanding), 0),
    }));
    this.totalOutstanding = this.loans.reduce((s, l) => s + Number(l.total_outstanding), 0);
    this.totalAccrued     = this.loans.reduce((s, l) => s + Number(l.accrued_interest), 0);
    this.totalInterest    = this.loans.reduce((s, l) => s + Number(l.interest_earned), 0);
  }

  compoundingLabel(c?: string): string {
    return ({ monthly: 'Monthly (12×/year)', quarterly: 'Quarterly (4×/year)', half_yearly: 'Half-yearly (2×/year)', annually: 'Annually (1×/year)' } as Record<string, string>)[c ?? 'monthly'] ?? 'Monthly';
  }

  toggleLoan(id: string): void {
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
    } else {
      this.expanded.clear();   // collapse any currently open loan
      this.expanded.add(id);
      if (!this.tabs.has(id)) this.tabs.set(id, 0);
    }
    this.cdr.markForCheck();
  }

  activeTab(id: string): 0 | 1 { return this.tabs.get(id) ?? 0; }

  setTab(id: string, tab: 0 | 1): void {
    this.tabs.set(id, tab);
    if (tab === 1 && !this.repayments.has(id)) this.loadRepayments(id);
    this.cdr.markForCheck();
  }

  private loadRepayments(loanId: string): void {
    this.repaymentLoading.add(loanId);
    this.http.get<{ data: { repayments: LoanRepayment[] } }>(`${environment.apiUrl}/loans/${loanId}/repayments`)
      .subscribe({
        next: (r) => {
          this.repayments.set(loanId, r.data.repayments ?? []);
          this.repaymentLoading.delete(loanId);
          this.cdr.markForCheck();
        },
        error: () => {
          this.repaymentLoading.delete(loanId);
          this.cdr.markForCheck();
        },
      });
  }

  openAdd(): void {
    this.dialog.open(LoanFormDialogComponent, {
      data: { loan: null } as LoanDialogData,
      width: '480px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openAddForBorrower(borrowerName: string): void {
    this.dialog.open(LoanFormDialogComponent, {
      data: { loan: null, prefillBorrower: borrowerName } as LoanDialogData,
      width: '480px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openEdit(loan: LoanRow): void {
    this.dialog.open(LoanFormDialogComponent, {
      data: { loan } as LoanDialogData,
      width: '480px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openAddRepayment(loan: LoanRow): void {
    this.expanded.add(loan.id);
    this.tabs.set(loan.id, 1);
    this.dialog.open(RepaymentDialogComponent, {
      data: { loan } as RepayDialogData,
      width: '440px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => {
      if (saved) {
        this.repayments.delete(loan.id);
        this.loadRepayments(loan.id); // refresh repayments immediately
        this.load();                  // also refresh loan totals
      }
    });
  }

  confirmDelete(loan: LoanRow): void {
    this.deleteTarget = { type: 'loan', id: loan.id, label: loan.meta.borrower_name || loan.name };
    this.cdr.markForCheck();
  }

  confirmDeleteRepayment(r: LoanRepayment, loan: LoanRow): void {
    this.deleteTarget = { type: 'repayment', id: r.id, label: loan.meta.borrower_name || loan.name, loanId: loan.id };
    this.cdr.markForCheck();
  }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    const url = this.deleteTarget.type === 'loan'
      ? `${environment.apiUrl}/loans/${this.deleteTarget.id}`
      : `${environment.apiUrl}/loans/repayments/${this.deleteTarget.id}`;
    this.http.delete(url).subscribe({
      next: () => {
        const loanId = this.deleteTarget?.type === 'repayment' ? this.deleteTarget.loanId : undefined;
        this.deleting = false;
        this.deleteTarget = null;
        if (loanId) {
          this.repayments.delete(loanId);
          this.loadRepayments(loanId);
        }
        this.load();
      },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }
}
