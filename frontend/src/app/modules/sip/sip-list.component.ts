import {
  Component, Inject, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, map, catchError, switchMap } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SipRow {
  id: string;
  fund_name: string;
  scheme_code: string | null;
  date_from: string | null;
  current_nav: number;
  units: number;
  invested_amount: number;
  current_value: number;
  monthly_sip_amount: number | null;
  fund_link: string | null;
  pnl: number;
  pnl_pct: number;
  notes: string | null;
}

interface SipDialogData { sip: SipRow | null; }

// ── Shared styles ──────────────────────────────────────────────────────────────

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
  .fi.ro  { background:#F8FAFC;color:#64748B;cursor:default; }
  textarea.fi { height:72px;padding:8px 10px;resize:vertical; }
  .ferr { font-size:.75rem;color:#EF4444; }
  .r2 { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
  .r3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px; }

  @media (max-width: 480px) {
    .r2, .r3 { grid-template-columns: 1fr; }
  }

  .pfx { position:relative; }
  .pfx .sym { position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:.8125rem;color:#6B7280;pointer-events:none; }
  .pfx input.fi { padding-left:22px; }
  .cv-box { background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between; }
  .cv-lbl { font-size:.75rem;font-weight:600;color:#166534; }
  .cv-val { font-size:1rem;font-weight:700;color:#15803D; }
  .f { padding:9px 16px 13px;border-top:1px solid #F3F4F6;display:flex;justify-content:flex-end;gap:6px; }
`;

// ── SIP form dialog ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-sip-dialog',
  standalone: true,
  imports: [NgIf, DecimalPipe, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styles: [FORM_STYLES],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi" style="background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.3)">
          <mat-icon style="color:#A855F7">autorenew</mat-icon>
        </div>
        <div>
          <p class="ht">{{ isEdit ? 'Edit SIP' : 'Add SIP' }}</p>
          <p class="hs">{{ isEdit ? 'Update investment details' : 'Record a SIP investment' }}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="b">
      <form [formGroup]="form">

        <div class="r2">
          <div class="fg" style="grid-column:1/-1">
            <label>Fund Name <span class="req">*</span></label>
            <input class="fi" formControlName="fundName" placeholder="e.g. HDFC Mid-Cap Opportunities Fund"
              [class.err]="inv('fundName')">
            <span class="ferr" *ngIf="inv('fundName')">Required</span>
          </div>
        </div>

        <div class="r2">
          <div class="fg">
            <label>AMFI Scheme Code <span class="opt">(for NAV refresh)</span></label>
            <input class="fi" formControlName="schemeCode" placeholder="e.g. 120503">
          </div>
          <div class="fg">
            <label>Date From <span class="opt">(optional)</span></label>
            <input class="fi" type="date" formControlName="dateFrom">
          </div>
        </div>

        <div class="fg">
          <label>Monthly SIP Amount <span class="opt">(optional)</span></label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="monthlySipAmount" placeholder="5000" min="0" step="100">
          </div>
        </div>

        <div class="r2">
          <div class="fg">
            <label>Current NAV <span class="req">*</span></label>
            <div class="pfx">
              <span class="sym">₹</span>
              <input class="fi" type="number" formControlName="currentNav" placeholder="0.0000" min="0" step="0.01"
                [class.err]="inv('currentNav')">
            </div>
            <span class="ferr" *ngIf="inv('currentNav')">Required</span>
          </div>
          <div class="fg">
            <label>Units <span class="req">*</span></label>
            <input class="fi" type="number" formControlName="units" placeholder="0.000" min="0" step="0.001"
              [class.err]="inv('units')">
            <span class="ferr" *ngIf="inv('units')">Required</span>
          </div>
        </div>

        <!-- Auto-computed current value -->
        <div class="cv-box">
          <span class="cv-lbl">Current Value (NAV × Units)</span>
          <span class="cv-val">₹ {{ computedValue | number:'1.2-2' }}</span>
        </div>

        <div class="fg">
          <label>Invested Amount <span class="req">*</span></label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="investedAmount" placeholder="0.00" min="0" step="0.01"
              [class.err]="inv('investedAmount')">
          </div>
          <span class="ferr" *ngIf="inv('investedAmount')">Required</span>
        </div>

        <div class="fg">
          <label>Fund Portfolio Link <span class="opt">(optional)</span></label>
          <input class="fi" type="url" formControlName="fundLink" placeholder="https://..."
            [class.err]="inv('fundLink')">
          <span class="ferr" *ngIf="inv('fundLink')">Enter a valid URL</span>
        </div>

        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <textarea class="fi" formControlName="notes" placeholder="e.g. Monthly ₹5,000 via NACH"></textarea>
        </div>

      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()"
        style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:90px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{ saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add SIP') }}
      </button>
    </div>
  `,
})
export class SipDialogComponent implements OnInit, OnDestroy {
  isEdit: boolean;
  form!: FormGroup;
  saving = false;
  computedValue = 0;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SipDialogData,
    private dialogRef: MatDialogRef<SipDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) { this.isEdit = data.sip !== null; }

  ngOnInit(): void {
    const s = this.data.sip;
    this.form = this.fb.group({
      fundName:         [s?.fund_name ?? '',        Validators.required],
      schemeCode:       [s?.scheme_code ?? ''],
      dateFrom:         [s?.date_from ?? ''],
      monthlySipAmount: [s?.monthly_sip_amount ?? null],
      currentNav:       [s?.current_nav ?? null,    [Validators.required, Validators.min(0)]],
      units:            [s?.units ?? null,           [Validators.required, Validators.min(0)]],
      investedAmount:   [s?.invested_amount ?? null, [Validators.required, Validators.min(0)]],
      fundLink:         [s?.fund_link ?? '',         Validators.pattern(/^$|^https?:\/\/.+/)],
      notes:            [s?.notes ?? ''],
    });

    this.computedValue = s ? Math.round((s.current_nav * s.units) * 100) / 100 : 0;

    // Live recompute whenever NAV or units change
    this.form.get('currentNav')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.recompute());
    this.form.get('units')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.recompute());
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private recompute(): void {
    const nav   = Number(this.form.value.currentNav)  || 0;
    const units = Number(this.form.value.units)        || 0;
    this.computedValue = Math.round(nav * units * 100) / 100;
    this.cdr.markForCheck();
  }

  inv(c: string): boolean { const ctrl = this.form.get(c); return !!(ctrl?.invalid && ctrl?.touched); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;
    const body: Record<string, unknown> = {
      fundName:       v.fundName,
      currentNav:     Number(v.currentNav),
      units:          Number(v.units),
      investedAmount: Number(v.investedAmount),
    };
    if (v.schemeCode)       body['schemeCode']        = v.schemeCode;
    if (v.dateFrom)         body['dateFrom']          = v.dateFrom;
    if (v.monthlySipAmount) body['monthlySipAmount']  = Number(v.monthlySipAmount);
    if (v.fundLink)         body['fundLink']          = v.fundLink;
    if (v.notes)            body['notes']             = v.notes;

    const req$ = this.isEdit
      ? this.http.patch(`${environment.apiUrl}/sip/${this.data.sip!.id}`, body)
      : this.http.post(`${environment.apiUrl}/sip`, body);

    req$.subscribe({
      next: () => this.dialogRef.close(true),
      error: () => { this.saving = false; },
    });
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── SIP list component ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-sip-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, NgClass, CurrencyPipe, DatePipe, DecimalPipe,
    MatProgressSpinnerModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatDialogModule,
  ],
  styles: [`
    :host { display:block;padding:24px;background:#F8FAFC;min-height:100%; }

    .stats-row { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px; }
    .stat-card  { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px; }
    .stat-lbl   { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .stat-val   { font-size:1.5rem;font-weight:700;letter-spacing:-.5px;color:#0F172A; }
    .stat-val.green  { color:#16A34A; }
    @media (max-width: 768px) { .stats-row { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 400px) { .stats-row { grid-template-columns: 1fr; } }
    .stat-val.red    { color:#DC2626; }
    .stat-val.purple { color:#7C3AED; }

    .page-hdr   { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
    .page-title { font-size:1.125rem;font-weight:700;color:#0F172A; }

    .table-wrap { background:white;border:1px solid #E2E8F0;border-radius:12px;overflow-x:auto; }
    table { width:100%;border-collapse:collapse; }
    th { text-align:left;padding:10px 14px;font-size:.6875rem;font-weight:700;text-transform:uppercase;
         letter-spacing:.06em;color:#94A3B8;border-bottom:1px solid #E2E8F0;background:#F8FAFC; }
    td { padding:12px 14px;border-bottom:1px solid #F1F5F9;font-size:.875rem;color:#374151;vertical-align:middle; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:#FAFAFA; }

    .fund-name  { font-weight:600;color:#0F172A; }
    .fund-meta  { display:flex;align-items:center;gap:8px;margin-top:3px; }
    .fund-notes { font-size:.75rem;color:#94A3B8; }
    .fund-link  { display:inline-flex;align-items:center;gap:3px;font-size:.75rem;color:#3B82F6;text-decoration:none; }
    .fund-link:hover { text-decoration:underline; }
    .fund-link mat-icon { font-size:12px;width:12px;height:12px; }
    .mono  { font-family:monospace;font-size:.8125rem; }
    .green { color:#16A34A;font-weight:600; }
    .red   { color:#DC2626;font-weight:600; }
    .monthly-badge { font-size:.6875rem;background:#EDE9FE;color:#5B21B6;border-radius:5px;padding:2px 6px;font-weight:600;white-space:nowrap; }

    .btn-i { width:28px;height:28px;border-radius:7px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:none; }
    .btn-i mat-icon { font-size:15px;width:15px;height:15px; }
    .btn-edit { color:#3B82F6; } .btn-edit:hover { background:#EFF6FF; }
    .btn-del  { color:#EF4444; } .btn-del:hover  { background:#FEF2F2; }
    .actions  { display:flex;gap:4px; }

    .empty { text-align:center;padding:60px 0; }
    .empty mat-icon { font-size:48px;width:48px;height:48px;color:#CBD5E1;display:block;margin:0 auto 12px; }
    .empty p { color:#94A3B8;margin:0; }

    .del-overlay { position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:100; }
    .del-box { background:white;border-radius:14px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .del-title { font-size:1rem;font-weight:700;color:#0F172A;margin:0 0 8px; }
    .del-body  { font-size:.875rem;color:#64748B;margin:0 0 20px; }
    .del-actions { display:flex;justify-content:flex-end;gap:8px; }

    .spinner-wrap { display:flex;justify-content:center;padding:80px; }

    /* ── Refresh status bar ── */
    .rs { display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;border:1px solid;font-size:.8125rem;font-weight:500;margin-bottom:12px; }
    .rs mat-icon { font-size:16px;width:16px;height:16px;flex-shrink:0; }
    .rs.ok   { background:#F0FDF4;border-color:#86EFAC;color:#15803D; }
    .rs.warn { background:#FFFBEB;border-color:#FCD34D;color:#92400E; }
    .rs.err  { background:#FEF2F2;border-color:#FCA5A5;color:#B91C1C; }
  `],
  template: `
    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>

    <ng-container *ngIf="!loading">
      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">SIP Funds</div>
          <div class="stat-val purple">{{ sips.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total Invested</div>
          <div class="stat-val">{{ totalInvested | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Current Value</div>
          <div class="stat-val">{{ totalValue | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total P&amp;L</div>
          <div class="stat-val" [class.green]="totalPnl >= 0" [class.red]="totalPnl < 0">
            {{ totalPnl | currency:'INR':'symbol-narrow':'1.0-0' }}
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
        <span class="page-title">SIP Investments</span>
        <div style="display:flex;align-items:center;gap:8px">
          <button mat-stroked-button (click)="refreshAllNav()" [disabled]="refreshing || sips.length === 0"
            style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
            <mat-spinner *ngIf="refreshing" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
            <mat-icon *ngIf="!refreshing" style="font-size:16px;width:16px;height:16px;margin-right:4px">sync</mat-icon>
            {{ refreshing ? 'Refreshing…' : 'Refresh NAV' }}
          </button>
          <button mat-flat-button color="primary" (click)="openAdd()"
            style="height:34px;font-size:.8125rem;font-weight:600;border-radius:8px;line-height:1">
            <mat-icon style="font-size:16px;width:16px;height:16px;margin-right:4px">add</mat-icon>
            Add SIP
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <div *ngIf="sips.length === 0" class="empty">
          <mat-icon>autorenew</mat-icon>
          <p>No SIP investments yet. Click <strong>Add SIP</strong> to get started.</p>
        </div>

        <table *ngIf="sips.length > 0">
          <thead>
            <tr>
              <th>Fund Name</th>
              <th>From</th>
              <th>Monthly</th>
              <th>NAV</th>
              <th>Units</th>
              <th>Invested</th>
              <th>Current Value</th>
              <th>P&amp;L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of sips">
              <td>
                <div class="fund-name">{{ s.fund_name }}</div>
                <div class="fund-meta">
                  <span *ngIf="s.notes" class="fund-notes">{{ s.notes }}</span>
                  <a *ngIf="s.fund_link" [href]="s.fund_link" target="_blank" rel="noopener" class="fund-link">
                    <mat-icon>open_in_new</mat-icon> Portfolio
                  </a>
                </div>
              </td>
              <td>{{ s.date_from ? (s.date_from | date:'MMM y') : '—' }}</td>
              <td>
                <span *ngIf="s.monthly_sip_amount" class="monthly-badge">
                  ₹{{ s.monthly_sip_amount | number:'1.0-0' }}
                </span>
                <span *ngIf="!s.monthly_sip_amount" style="color:#CBD5E1">—</span>
              </td>
              <td class="mono">{{ s.current_nav | currency:'INR':'symbol-narrow':'1.2-4' }}</td>
              <td class="mono">{{ s.units | number:'1.3-6' }}</td>
              <td class="mono">{{ s.invested_amount | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
              <td class="mono">{{ s.current_value | currency:'INR':'symbol-narrow':'1.0-0' }}</td>
              <td>
                <span [class.green]="s.pnl >= 0" [class.red]="s.pnl < 0" class="mono">
                  {{ s.pnl | currency:'INR':'symbol-narrow':'1.0-0' }}
                </span>
                <div style="font-size:.6875rem" [class.green]="s.pnl >= 0" [class.red]="s.pnl < 0">
                  {{ s.pnl >= 0 ? '+' : '' }}{{ s.pnl_pct | number:'1.1-1' }}%
                </div>
              </td>
              <td>
                <div class="actions">
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
        <p class="del-title">Delete SIP?</p>
        <p class="del-body">Remove <strong>{{ deleteTarget.fundName }}</strong>? This cannot be undone.</p>
        <div class="del-actions">
          <button mat-stroked-button (click)="deleteTarget = null"
            style="height:32px;font-size:.8125rem;border-radius:7px">Cancel</button>
          <button mat-flat-button color="warn" (click)="doDelete()" [disabled]="deleting"
            style="height:32px;font-size:.8125rem;font-weight:600;border-radius:7px;min-width:80px">
            <mat-spinner *ngIf="deleting" diameter="14" style="display:inline-block;margin-right:4px"></mat-spinner>
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SipListComponent implements OnInit {
  loading    = true;
  deleting   = false;
  refreshing = false;
  sips: SipRow[] = [];
  deleteTarget: { id: string; fundName: string } | null = null;
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
    this.http.get<{ data: { sips: SipRow[] } }>(`${environment.apiUrl}/sip`).subscribe({
      next: (res) => {
        this.sips = res.data.sips;
        this.calcStats();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private calcStats(): void {
    this.totalInvested = this.sips.reduce((s, x) => s + x.invested_amount, 0);
    this.totalValue    = this.sips.reduce((s, x) => s + x.current_value, 0);
    this.totalPnl      = Math.round((this.totalValue - this.totalInvested) * 100) / 100;
    this.totalPnlPct   = this.totalInvested > 0
      ? Math.round((this.totalPnl / this.totalInvested) * 10000) / 100 : 0;
  }

  refreshAllNav(): void {
    if (this.refreshing) return;
    const withCode = this.sips.filter(s => s.scheme_code);
    const noCode   = this.sips.length - withCode.length;
    if (withCode.length === 0) {
      this.refreshStatus = { type: 'warn', msg: `No SIPs have a scheme code — edit a SIP to add its AMFI scheme code and enable auto-refresh` };
      this.cdr.markForCheck();
      return;
    }
    this.refreshing = true;
    this.refreshStatus = null;
    this.cdr.markForCheck();

    const navReqs = withCode.map(s =>
      this.http.get<{ data: { nav: { nav: number } } }>(
        `${environment.apiUrl}/mutual-funds/nav/${encodeURIComponent(s.scheme_code!)}`
      ).pipe(
        map(res => ({ sip: s, nav: res.data.nav.nav })),
        catchError(() => of(null as { sip: SipRow; nav: number } | null))
      )
    );

    forkJoin(navReqs).pipe(
      switchMap(results => {
        const valid       = results.filter((r): r is { sip: SipRow; nav: number } => r !== null);
        const fetchFailed = results.length - valid.length;
        if (valid.length === 0) return of({ updated: 0, fetchFailed, noCode });
        const patchReqs = valid.map(r =>
          this.http.patch(`${environment.apiUrl}/sip/${r.sip.id}`, { currentNav: r.nav }).pipe(
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

  openAdd(): void {
    this.dialog.open(SipDialogComponent, {
      data: { sip: null } as SipDialogData,
      width: '520px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openEdit(sip: SipRow): void {
    this.dialog.open(SipDialogComponent, {
      data: { sip } as SipDialogData,
      width: '520px', maxHeight: '90vh', panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  confirmDelete(sip: SipRow): void {
    this.deleteTarget = { id: sip.id, fundName: sip.fund_name };
    this.cdr.markForCheck();
  }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.http.delete(`${environment.apiUrl}/sip/${this.deleteTarget.id}`).subscribe({
      next: () => { this.deleteTarget = null; this.deleting = false; this.load(); },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }
}
