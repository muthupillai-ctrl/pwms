import {
  Component, Inject, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface StockRow {
  id: string;
  name: string;
  symbol: string;
  account_id: string;
  account_name: string;
  units: number;
  buy_price: number;
  current_price: number | null;
  invested_value: number;
  current_value: number;
  gain_loss: number;
  gain_loss_pct: number;
  days_held: number;
}

interface DialogData { stock: StockRow | null; }

// ── Dialog component ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-stock-form-dialog',
  standalone: true,
  imports: [
    NgIf, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  styles: [`
    .h { background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:14px 16px;display:flex;align-items:center;justify-content:space-between; }
    .hl { display:flex;align-items:center;gap:10px; }
    .hi { width:32px;height:32px;border-radius:8px;background:rgba(5,150,105,.2);border:1px solid rgba(5,150,105,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .hi mat-icon { color:#34D399;font-size:16px;width:16px;height:16px; }
    .ht { font-size:.875rem;font-weight:700;color:#F8FAFC;margin:0;line-height:1.2; }
    .hs { font-size:.6875rem;color:rgba(255,255,255,.4);margin:1px 0 0; }
    .hx { background:rgba(255,255,255,.07);border:none;cursor:pointer;width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4); }
    .hx:hover { background:rgba(255,255,255,.14);color:#fff; }
    .hx mat-icon { font-size:13px;width:13px;height:13px; }

    .b { padding:12px 16px 8px;overflow-y:auto;max-height:calc(90vh - 100px); }
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
    .ferr { font-size:.625rem;color:#EF4444;margin-top:2px; }
    input.fi.err { border-color:#EF4444; }

    .pfx { position:relative; }
    .pfx .sym { position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:.75rem;color:#9CA3AF;pointer-events:none; }
    .pfx input.fi { padding-left:18px; }

    textarea.fta { display:block;width:100%;padding:7px 9px;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:6px;font-size:.8125rem;color:#111827;background:#fff;font-family:inherit;outline:none;resize:none;line-height:1.45;transition:border-color .12s,box-shadow .12s; }
    textarea.fta::placeholder { color:#D1D5DB; }
    textarea.fta:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }

    .edit-badge { display:flex;align-items:center;gap:8px;background:#ECFDF5;border-radius:7px;padding:8px 10px;margin-bottom:8px;font-size:.75rem;color:#065F46;font-weight:500; }
    .edit-badge mat-icon { font-size:14px;width:14px;height:14px; }

    .f { padding:9px 16px 13px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
  `],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi">
          <mat-icon>show_chart</mat-icon>
        </div>
        <div>
          <p class="ht">{{ isEdit ? 'Edit Stock' : 'Add Stock' }}</p>
          <p class="hs">{{ isEdit ? data.stock!.symbol : 'Add a stock holding' }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="b">
      <form [formGroup]="form">

        <!-- ADD MODE -->
        <ng-container *ngIf="!isEdit">

          <span class="sl">Details</span>

          <div class="r2">
            <div class="fg">
              <label>Symbol <span class="req">*</span></label>
              <input class="fi" formControlName="symbol" placeholder="e.g. RELIANCE"
                [class.err]="symbolInvalid" style="text-transform:uppercase">
              <span class="ferr" *ngIf="symbolInvalid">Required</span>
            </div>
            <div class="fg">
              <label>Name <span class="req">*</span></label>
              <input class="fi" formControlName="name" placeholder="e.g. Reliance Industries"
                [class.err]="nameInvalid">
              <span class="ferr" *ngIf="nameInvalid">Required</span>
            </div>
          </div>

          <div class="r2">
            <div class="fg">
              <label>Units <span class="req">*</span></label>
              <input class="fi" type="number" formControlName="units" placeholder="e.g. 10"
                [class.err]="unitsInvalid" min="0.000001" step="any">
              <span class="ferr" *ngIf="unitsInvalid">Enter a positive number</span>
            </div>
            <div class="fg">
              <label>Purchase Price <span class="req">*</span></label>
              <div class="pfx">
                <span class="sym">₹</span>
                <input class="fi" type="number" formControlName="purchasePrice" placeholder="e.g. 2500"
                  [class.err]="purchasePriceInvalid" min="0.0001" step="any">
              </div>
              <span class="ferr" *ngIf="purchasePriceInvalid">Enter a valid price</span>
            </div>
          </div>

          <div class="r2">
            <div class="fg">
              <label>Purchase Date <span class="opt">(optional)</span></label>
              <input class="fi" type="date" formControlName="purchaseDate">
            </div>
            <div class="fg">
              <label>Current Price <span class="opt">(optional)</span></label>
              <div class="pfx">
                <span class="sym">₹</span>
                <input class="fi" type="number" formControlName="currentPrice" placeholder="e.g. 2800"
                  min="0" step="any">
              </div>
            </div>
          </div>

          <div class="fg">
            <label>Notes <span class="opt">(optional)</span></label>
            <textarea class="fta" formControlName="notes" rows="2" placeholder="Any additional details…"></textarea>
          </div>

        </ng-container>

        <!-- EDIT MODE -->
        <ng-container *ngIf="isEdit">

          <div class="edit-badge">
            <mat-icon>lock</mat-icon>
            Symbol and units cannot be changed after creation
          </div>

          <span class="sl">Details</span>

          <div class="fg">
            <label>Name <span class="req">*</span></label>
            <input class="fi" formControlName="name" placeholder="e.g. Reliance Industries"
              [class.err]="nameInvalid">
            <span class="ferr" *ngIf="nameInvalid">Required</span>
          </div>

          <div class="fg">
            <label>Notes <span class="opt">(optional)</span></label>
            <textarea class="fta" formControlName="notes" rows="2" placeholder="Any additional details…"></textarea>
          </div>

        </ng-container>

      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()"
        style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:104px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Stock') }}
      </button>
    </div>
  `,
})
export class StockFormDialogComponent implements OnInit {
  isEdit: boolean;
  form!: FormGroup;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<StockFormDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
  ) { this.isEdit = data.stock !== null; }

  ngOnInit(): void {
    const s = this.data.stock;
    if (s) {
      this.form = this.fb.group({
        name:  [s.name, Validators.required],
        notes: [''],
      });
    } else {
      this.form = this.fb.group({
        symbol:        ['', Validators.required],
        name:          ['', Validators.required],
        units:         [null, [Validators.required, Validators.min(0.000001)]],
        purchasePrice: [null, [Validators.required, Validators.min(0.0001)]],
        purchaseDate:  [this.today()],
        currentPrice:  [null],
        notes:         [''],
      });
    }
  }

  get nameInvalid():          boolean { const c = this.form.get('name');          return !!(c?.invalid && c?.touched); }
  get symbolInvalid():        boolean { const c = this.form.get('symbol');         return !!(c?.invalid && c?.touched); }
  get unitsInvalid():         boolean { const c = this.form.get('units');          return !!(c?.invalid && c?.touched); }
  get purchasePriceInvalid(): boolean { const c = this.form.get('purchasePrice'); return !!(c?.invalid && c?.touched); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;
    if (this.isEdit) {
      this.http.patch(`${environment.apiUrl}/stocks/${this.data.stock!.id}`, { name: v.name, notes: v.notes || null })
        .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
    } else {
      const body: any = {
        symbol:        v.symbol.toUpperCase().trim(),
        name:          v.name,
        units:         Number(v.units),
        purchasePrice: Number(v.purchasePrice),
        purchaseDate:  v.purchaseDate || undefined,
        notes:         v.notes || undefined,
      };
      if (v.currentPrice) body.currentPrice = Number(v.currentPrice);
      this.http.post(`${environment.apiUrl}/stocks`, body)
        .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
    }
  }

  cancel(): void { this.dialogRef.close(false); }
  private today(): string { return new Date().toISOString().slice(0, 10); }
}

// ── Price update dialog ───────────────────────────────────────────────────────

@Component({
  selector: 'app-stock-price-dialog',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styles: [`
    .h { display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #F3F4F6; }
    .ht { font-size:.9375rem;font-weight:700;color:#0F172A;margin:0; }
    .hs { font-size:.75rem;color:#94A3B8;margin:2px 0 0; }
    .hx { background:none;border:none;cursor:pointer;color:#94A3B8;padding:4px;display:flex;align-items:center;border-radius:6px; }
    .hx:hover { background:#F1F5F9; }
    .b { padding:16px 18px;display:flex;flex-direction:column;gap:12px; }
    .fetch-btn { display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:36px;border-radius:8px;border:1.5px dashed #A78BFA;background:#FAF5FF;color:#7C3AED;font-size:.8125rem;font-weight:600;cursor:pointer;transition:background .12s; }
    .fetch-btn:hover:not(:disabled) { background:#F3E8FF;border-color:#7C3AED; }
    .fetch-btn:disabled { opacity:.5;cursor:default; }
    .fetch-btn mat-icon { font-size:16px;width:16px;height:16px; }
    .fetched-info { background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;font-size:.8125rem;color:#15803D;display:flex;align-items:center;gap:6px; }
    .fetched-info mat-icon { font-size:15px;width:15px;height:15px;flex-shrink:0; }
    .err-info { background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:8px 12px;font-size:.8125rem;color:#B91C1C;display:flex;align-items:center;gap:6px; }
    .err-info mat-icon { font-size:15px;width:15px;height:15px;flex-shrink:0; }
    .divider { display:flex;align-items:center;gap:8px;color:#9CA3AF;font-size:.75rem; }
    .divider::before, .divider::after { content:'';flex:1;border-top:1px solid #E5E7EB; }
    .fg { display:flex;flex-direction:column;gap:4px; }
    label { font-size:.8125rem;font-weight:600;color:#374151; }
    .pfx { position:relative; }
    .pfx .sym { position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:.8125rem;color:#6B7280;pointer-events:none; }
    .pfx input { height:36px;padding:0 10px 0 22px;border:1px solid #D1D5DB;border-radius:8px;font-size:.875rem;color:#111827;outline:none;width:100%;box-sizing:border-box; }
    .pfx input:focus { border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.12); }
    .f { padding:10px 18px 14px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
  `],
  template: `
    <div class="h">
      <div>
        <p class="ht">Update Price — {{ data.symbol }}</p>
        <p class="hs">{{ data.name }}</p>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="b">
      <!-- Live fetch button -->
      <button class="fetch-btn" (click)="fetchLive()" [disabled]="fetching">
        <mat-spinner *ngIf="fetching" diameter="14"></mat-spinner>
        <mat-icon *ngIf="!fetching">wifi</mat-icon>
        {{ fetching ? 'Fetching from Yahoo Finance…' : 'Fetch Live Price' }}
      </button>

      <!-- Fetch result feedback -->
      <div class="fetched-info" *ngIf="fetchedInfo">
        <mat-icon>check_circle</mat-icon>
        {{ fetchedInfo }}
      </div>
      <div class="err-info" *ngIf="fetchError">
        <mat-icon>error</mat-icon>
        {{ fetchError }}
      </div>

      <div class="divider">or enter manually</div>

      <!-- Manual input -->
      <form [formGroup]="form">
        <div class="fg">
          <label>Current Market Price</label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input type="number" formControlName="price" placeholder="0.00" min="0.0001" step="any">
          </div>
        </div>
      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()" style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:90px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : 'Update' }}
      </button>
    </div>
  `,
})
export class StockPriceDialogComponent {
  form: FormGroup;
  saving      = false;
  fetching    = false;
  fetchedInfo: string | null = null;
  fetchError:  string | null = null;
  fetchedName: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { id: string; symbol: string; name: string },
    private dialogRef: MatDialogRef<StockPriceDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({ price: [null, [Validators.required, Validators.min(0.0001)]] });
  }

  fetchLive(): void {
    this.fetching    = true;
    this.fetchedInfo = null;
    this.fetchError  = null;
    this.fetchedName = null;
    this.http.get<{ data: { quote: { price: number; symbol: string; currency: string; name: string } } }>(
      `${environment.apiUrl}/stocks/quote/${encodeURIComponent(this.data.symbol)}`
    ).subscribe({
      next: (res) => {
        const q = res.data.quote;
        this.form.patchValue({ price: q.price });
        this.fetchedName = q.name;
        this.fetchedInfo = `₹${q.price.toLocaleString('en-IN')} · ${q.name}`;
        this.fetching = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.fetchError = err?.error?.error?.message ?? 'Could not fetch price. Check the symbol or try manually.';
        this.fetching = false;
        this.cdr.markForCheck();
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const body: any = { currentPrice: Number(this.form.value.price) };
    if (this.fetchedName) body.name = this.fetchedName;
    this.http.patch(`${environment.apiUrl}/stocks/${this.data.id}/price`, body)
      .subscribe({ next: () => this.dialogRef.close(true), error: () => { this.saving = false; } });
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── List component ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-stocks-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, CurrencyPipe, DecimalPipe,
    MatProgressSpinnerModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatDialogModule,
  ],
  styles: [`
    :host { display:block;padding:24px;background:#F8FAFC;min-height:100%; }

    .spinner-wrap { display:flex;justify-content:center;padding:80px; }

    /* ── Stats ── */
    .stats-row { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px; }
    .stat-card  { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px; }
    .stat-lbl   { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .stat-val   { font-size:1.5rem;font-weight:700;letter-spacing:-.5px;color:#0F172A; }
    .stat-val.green  { color:#16A34A; }
    @media (max-width: 768px) { .stats-row { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 400px) { .stats-row { grid-template-columns: 1fr; } }
    .stat-val.red    { color:#DC2626; }
    .stat-val.emerald { color:#059669; }

    /* ── Page header ── */
    .page-hdr   { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
    .page-title { font-size:1.125rem;font-weight:700;color:#0F172A; }

    /* ── Table ── */
    .table-wrap { background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden; }
    table { width:100%;border-collapse:collapse; }
    th {
      text-align:left;padding:7px 12px;
      font-size:.6875rem;font-weight:700;text-transform:uppercase;
      letter-spacing:.06em;color:#94A3B8;
      border-bottom:1px solid #E2E8F0;background:#F8FAFC;
    }
    td { padding:6px 12px;border-bottom:1px solid #F1F5F9;font-size:.8125rem;color:#374151;vertical-align:middle; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:#FAFAFA; }

    .ticker-badge {
      width:30px;height:30px;border-radius:7px;background:#F0FDF4;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
      font-size:.625rem;font-weight:800;color:#15803D;letter-spacing:-.5px;
    }
    .stock-name { font-weight:600;color:#0F172A;font-size:.8125rem; }
    .stock-meta { font-size:.6875rem;color:#94A3B8;margin-top:1px; }

    .mono { font-family:monospace;font-size:.8125rem; }
    .green { color:#16A34A;font-weight:600; }
    .red   { color:#DC2626;font-weight:600; }

    .pnl-pct {
      display:inline-flex;align-items:center;gap:2px;
      padding:1px 6px;border-radius:20px;font-size:.625rem;font-weight:600;
    }
    .pnl-pct.pos { background:#F0FDF4;color:#15803D; }
    .pnl-pct.neg { background:#FEF2F2;color:#B91C1C; }

    /* ── Actions ── */
    .actions { display:flex;gap:2px; }
    .btn-i { width:24px;height:24px;border-radius:6px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:none; }
    .btn-i mat-icon { font-size:14px;width:14px;height:14px; }
    .btn-price { color:#7C3AED; } .btn-price:hover { background:#F5F3FF; }
    .btn-edit  { color:#3B82F6; } .btn-edit:hover  { background:#EFF6FF; }
    .btn-del   { color:#EF4444; } .btn-del:hover   { background:#FEF2F2; }

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

    /* ── Delete confirm ── */
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
          <div class="stat-lbl">Holdings</div>
          <div class="stat-val">{{ stocks.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total Invested</div>
          <div class="stat-val">{{ totalInvested | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Current Value</div>
          <div class="stat-val emerald">{{ totalValue | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total P&amp;L</div>
          <div class="stat-val" [class.green]="totalPnl >= 0" [class.red]="totalPnl < 0">
            {{ totalPnl >= 0 ? '+' : '' }}{{ totalPnl | currency:'INR':'symbol-narrow':'1.0-0' }}
            <span style="font-size:.875rem;font-weight:500">({{ totalPnlPct | number:'1.1-1' }}%)</span>
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
        <span class="page-title">Stock Holdings</span>
        <div style="display:flex;align-items:center;gap:8px">
          <button mat-stroked-button (click)="refreshAllPrices()" [disabled]="refreshing || stocks.length === 0"
            style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
            <mat-spinner *ngIf="refreshing" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
            <mat-icon *ngIf="!refreshing" style="font-size:16px;width:16px;height:16px;margin-right:4px">sync</mat-icon>
            {{ refreshing ? 'Refreshing…' : 'Refresh Prices' }}
          </button>
          <button mat-flat-button color="primary" (click)="openAdd()"
            style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
            <mat-icon style="font-size:16px;width:16px;height:16px;margin-right:4px">add</mat-icon>
            Add Stock
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <div *ngIf="stocks.length === 0" class="empty">
          <mat-icon>show_chart</mat-icon>
          <p>No stock holdings yet. Click <strong>Add Stock</strong> to get started.</p>
        </div>

        <table *ngIf="stocks.length > 0">
          <thead>
            <tr>
              <th>Stock</th>
              <th>Shares</th>
              <th>Avg Buy</th>
              <th>Cur. Price</th>
              <th>Invested</th>
              <th>Current Value</th>
              <th>Profit / Loss</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of stocks">
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="ticker-badge">{{ (s.symbol || '?').slice(0,4) }}</div>
                  <div>
                    <div class="stock-name">{{ s.name }}</div>
                    <div class="stock-meta">{{ s.symbol }}</div>
                  </div>
                </div>
              </td>
              <td class="mono">{{ s.units | number:'1.0-4' }}</td>
              <td class="mono">₹{{ s.buy_price | number:'1.2-2' }}</td>
              <td class="mono">
                <span *ngIf="s.current_price">₹{{ s.current_price | number:'1.2-2' }}</span>
                <span *ngIf="!s.current_price" style="color:#CBD5E1">—</span>
              </td>
              <td class="mono">{{ s.invested_value | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
              <td class="mono" style="font-weight:600">{{ s.current_value | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
              <td>
                <div class="mono" [class.green]="s.gain_loss >= 0" [class.red]="s.gain_loss < 0">
                  {{ s.gain_loss >= 0 ? '+' : '' }}{{ s.gain_loss | currency:'INR':'symbol-narrow':'1.0-0' }}
                </div>
                <span class="pnl-pct" [class.pos]="s.gain_loss >= 0" [class.neg]="s.gain_loss < 0">
                  {{ s.gain_loss >= 0 ? '▲' : '▼' }} {{ s.gain_loss_pct | number:'1.2-2' }}%
                </span>
              </td>
              <td>
                <div class="actions">
                  <button class="btn-i btn-price" (click)="openUpdatePrice(s)" matTooltip="Update Price">
                    <mat-icon>currency_rupee</mat-icon>
                  </button>
                  <button class="btn-i btn-edit" (click)="openEdit(s)" matTooltip="Edit">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button class="btn-i btn-del" (click)="confirmDelete(s)" matTooltip="Delete">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </ng-container>

    <!-- Delete confirm -->
    <div class="del-overlay" *ngIf="deleteTarget" (click)="deleteTarget = null">
      <div class="del-box" (click)="$event.stopPropagation()">
        <p class="del-title">Delete Stock?</p>
        <p class="del-body">
          <strong>{{ deleteTarget.name }}</strong> ({{ deleteTarget.symbol }}) will be permanently removed.
        </p>
        <div class="del-actions">
          <button mat-stroked-button (click)="deleteTarget = null"
            style="height:32px;font-size:.8125rem;border-radius:7px">Cancel</button>
          <button mat-flat-button color="warn" (click)="doDelete()" [disabled]="deleting"
            style="height:32px;font-size:.8125rem;font-weight:600;border-radius:7px;min-width:80px">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class StocksListComponent implements OnInit {
  loading    = true;
  deleting   = false;
  refreshing = false;
  stocks: StockRow[] = [];
  deleteTarget: StockRow | null = null;
  refreshStatus: { type: 'ok' | 'warn' | 'err'; msg: string } | null = null;

  totalInvested = 0;
  totalValue    = 0;
  totalPnl      = 0;
  totalPnlPct   = 0;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading = true;
    this.http.get<{ data: { stocks: StockRow[] } }>(`${environment.apiUrl}/stocks`).subscribe({
      next: (r) => {
        this.stocks = r.data.stocks ?? [];
        this.calcStats();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private calcStats(): void {
    this.totalInvested = this.stocks.reduce((s, x) => s + x.invested_value, 0);
    this.totalValue    = this.stocks.reduce((s, x) => s + x.current_value,  0);
    this.totalPnl      = Math.round((this.totalValue - this.totalInvested) * 100) / 100;
    this.totalPnlPct   = this.totalInvested > 0
      ? Math.round((this.totalPnl / this.totalInvested) * 10000) / 100 : 0;
  }

  refreshAllPrices(): void {
    if (this.refreshing || this.stocks.length === 0) return;
    this.refreshing = true;
    this.refreshStatus = null;
    const total = this.stocks.length;
    this.cdr.markForCheck();

    const quoteReqs = this.stocks.map(s =>
      this.http.get<{ data: { quote: { price: number; name: string } } }>(
        `${environment.apiUrl}/stocks/quote/${encodeURIComponent(s.symbol)}`
      ).pipe(
        map(res => ({ stock: s, price: res.data.quote.price, name: res.data.quote.name })),
        catchError(() => of(null as { stock: StockRow; price: number; name: string } | null))
      )
    );

    forkJoin(quoteReqs).pipe(
      switchMap(results => {
        const valid  = results.filter((r): r is { stock: StockRow; price: number; name: string } => r !== null);
        const failed = results.length - valid.length;
        if (valid.length === 0) return of({ updated: 0, failed });
        const patchReqs = valid.map(r =>
          this.http.patch(`${environment.apiUrl}/stocks/${r.stock.id}/price`, { currentPrice: r.price, name: r.name }).pipe(
            map(() => true),
            catchError(() => of(false))
          )
        );
        return forkJoin(patchReqs).pipe(
          map(patches => ({
            updated: patches.filter(Boolean).length,
            failed:  failed + patches.filter(p => !p).length,
          }))
        );
      })
    ).subscribe({
      next: result => {
        this.refreshing = false;
        if (result.updated === total) {
          this.refreshStatus = { type: 'ok', msg: `All ${total} prices updated successfully` };
          setTimeout(() => { this.refreshStatus = null; this.cdr.markForCheck(); }, 8000);
        } else if (result.updated > 0) {
          this.refreshStatus = { type: 'warn', msg: `${result.updated} of ${total} prices updated · ${result.failed} could not be fetched from Yahoo Finance` };
        } else {
          this.refreshStatus = { type: 'err', msg: `Could not fetch any prices — verify the stock symbols or check that Yahoo Finance is reachable` };
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

  openAdd(): void {
    this.dialog.open(StockFormDialogComponent, {
      data: { stock: null } as DialogData,
      width: '460px', maxHeight: '92vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openEdit(s: StockRow): void {
    this.dialog.open(StockFormDialogComponent, {
      data: { stock: s } as DialogData,
      width: '460px', maxHeight: '92vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openUpdatePrice(s: StockRow): void {
    this.dialog.open(StockPriceDialogComponent, {
      data: { id: s.id, symbol: s.symbol, name: s.name },
      width: '320px', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  confirmDelete(s: StockRow): void {
    this.deleteTarget = s;
    this.cdr.markForCheck();
  }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.http.delete(`${environment.apiUrl}/stocks/${this.deleteTarget.id}`).subscribe({
      next:  () => { this.deleting = false; this.deleteTarget = null; this.load(); },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }
}
