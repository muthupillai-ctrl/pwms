import {
  Component, Inject, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AccountsService } from '../../core/services/accounts.service';
import { Account, AccountType, CreateAccountPayload, UpdateAccountPayload } from '../../shared/models/accounts.models';

// ── Shared constants ──────────────────────────────────────────────────────────

interface AccountTypeMeta {
  value: AccountType;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

const ACCOUNT_TYPES: AccountTypeMeta[] = [
  { value: 'savings', label: 'Savings',  icon: 'account_balance', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'current', label: 'Current',  icon: 'business_center',  color: '#4F46E5', bg: '#EEF2FF' },
  { value: 'cash',    label: 'Cash',     icon: 'payments',         color: '#059669', bg: '#ECFDF5' },
  { value: 'other',   label: 'Other',    icon: 'category',         color: '#6B7280', bg: '#F9FAFB' },
];

const TYPE_MAP = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.value, t]));

const TYPE_DESCRIPTIONS: Record<string, string> = {
  savings: 'Standard savings bank account. Tracks balance and transaction history.',
  current: 'Business or current account. High-frequency transactions, no withdrawal limits.',
  cash:    'Physical cash on hand — wallet, home safe, or petty cash.',
  other:   'Any other financial account not covered by the above types.',
};

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Finance',   emojis: ['🏦','🏧','💰','💳','💵','💶','💷','🪙','💹','📈','📊','🏛️','💱','🧾'] },
  { label: 'Life',      emojis: ['🏠','🏢','🏪','🏫','🏥','🏨','✈️','🚗','🛒','📱','💼','🎓','🍽️','⚡'] },
  { label: 'Personal',  emojis: ['💎','🏆','🌟','⭐','🎯','🌱','🌈','🔑','🎁','🌺','🍀','🦋','🎨','🛡️'] },
];

interface DialogData { account: Account | null; }

// ── Dialog component ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-account-form-dialog',
  standalone: true,
  imports: [
    NgIf, NgFor, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  styles: [`
    /* header */
    .h {
      background: linear-gradient(135deg, #1e3a5f, #0f172a);
      padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .hl { display:flex;align-items:center;gap:10px; }
    .hi {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .hi mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .ht { font-size: .875rem; font-weight: 700; color: #F8FAFC; margin: 0; line-height: 1.2; }
    .hs { font-size: .6875rem; color: rgba(255,255,255,.4); margin: 1px 0 0; }
    .hx {
      background: rgba(255,255,255,.07); border: none; cursor: pointer;
      width: 24px; height: 24px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,.4);
    }
    .hx:hover { background: rgba(255,255,255,.14); color: #fff; }
    .hx mat-icon { font-size: 13px; width: 13px; height: 13px; }

    /* body */
    .b { padding: 12px 16px 8px; overflow-y: auto; max-height: calc(90vh - 110px); }

    /* micro section label */
    .sl {
      font-size: .625rem; font-weight: 700; color: #9CA3AF;
      text-transform: uppercase; letter-spacing: .08em;
      margin: 0 0 5px; display: block;
    }

    /* type chips */
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 7px; }
    .chip {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 8px 3px 5px; border-radius: 20px;
      border: 1.5px solid #E5E7EB; background: #fff;
      cursor: pointer; user-select: none; transition: all .1s;
      font-size: .6875rem; font-weight: 600; color: #6B7280;
      line-height: 1;
    }
    .chip mat-icon { font-size: 11px; width: 11px; height: 11px; }
    .chip:hover { border-color: #D1D5DB; background: #F9FAFB; }
    .chip.sel { border-width: 1.5px; }

    /* description strip */
    .ds {
      display: flex; align-items: flex-start; gap: 5px;
      padding: 6px 9px; border-radius: 6px; margin-bottom: 10px;
      font-size: .6875rem; font-weight: 500; line-height: 1.4;
    }
    .ds mat-icon { font-size: 11px; width: 11px; height: 11px; flex-shrink: 0; margin-top: 1px; }

    /* edit-mode type pill */
    .tp {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 20px;
      font-size: .6875rem; font-weight: 600; margin-bottom: 10px;
    }
    .tp mat-icon { font-size: 11px; width: 11px; height: 11px; }

    /* ── native form fields ───────────────────── */
    .fg  { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
    .fg:last-child { margin-bottom: 0; }
    .r2  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

    @media (max-width: 480px) {
      .r2 { grid-template-columns: 1fr; }
    }

    label {
      font-size: .6875rem; font-weight: 600; color: #374151;
      display: block; margin-bottom: 3px;
    }
    label .opt { color: #9CA3AF; font-weight: 400; }
    label .req { color: #EF4444; }

    input.fi, select.fi {
      display: block; width: 100%; height: 34px;
      padding: 0 9px; box-sizing: border-box;
      border: 1.5px solid #E5E7EB; border-radius: 6px;
      font-size: .8125rem; color: #111827; background: #fff;
      font-family: inherit; outline: none;
      transition: border-color .12s, box-shadow .12s;
    }
    input.fi::placeholder { color: #D1D5DB; }
    input.fi:focus, select.fi:focus {
      border-color: #3B82F6;
      box-shadow: 0 0 0 3px rgba(59,130,246,.1);
    }
    input.fi.err { border-color: #EF4444; }
    .ferr { font-size: .625rem; color: #EF4444; margin-top: 2px; }

    select.fi {
      appearance: none; padding-right: 24px; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 8px center;
    }

    .pfx { position: relative; }
    .pfx .sym {
      position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
      font-size: .75rem; color: #9CA3AF; pointer-events: none;
    }
    .pfx input.fi { padding-left: 18px; }

    textarea.fta {
      display: block; width: 100%; padding: 7px 9px; box-sizing: border-box;
      border: 1.5px solid #E5E7EB; border-radius: 6px;
      font-size: .8125rem; color: #111827; background: #fff;
      font-family: inherit; outline: none; resize: none; line-height: 1.45;
      transition: border-color .12s, box-shadow .12s;
    }
    textarea.fta::placeholder { color: #D1D5DB; }
    textarea.fta:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }

    /* emoji picker */
    .emoji-section { margin-bottom:10px; }
    .emoji-group-label { font-size:.5625rem;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.07em;margin:0 0 4px;display:block; }
    .emoji-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px; }
    .emoji-opt {
      display:flex;align-items:center;justify-content:center;
      height:34px;border-radius:6px;border:1.5px solid transparent;
      cursor:pointer;background:#F9FAFB;font-size:19px;transition:all .1s;
    }
    .emoji-opt:hover { background:#EFF6FF;border-color:#93C5FD; }
    .emoji-opt.sel   { background:#EFF6FF;border-color:#2563EB;box-shadow:0 0 0 2px rgba(37,99,235,.12); }
    .emoji-selected-row { display:flex;align-items:center;gap:8px;padding:6px 8px;background:#F8FAFC;border-radius:8px;border:1px solid #E5E7EB; }
    .emoji-selected-preview { font-size:24px;line-height:1; }
    .emoji-selected-label { font-size:.75rem;color:#374151;font-weight:500; }

    /* footer */
    .f {
      padding: 9px 16px 13px; border-top: 1px solid #F3F4F6;
      display: flex; justify-content: flex-end; gap: 6px;
    }
  `],
  template: `
    <div class="h">
      <div class="hl">
        <div class="hi"
          [style.background]="(isEdit ? editTypeMeta?.color : typeMeta?.color)+'28'"
          [style.border]="'1px solid '+(isEdit ? editTypeMeta?.color : typeMeta?.color)+'40'">
          <mat-icon [style.color]="isEdit ? editTypeMeta?.color : typeMeta?.color">
            {{isEdit ? editTypeMeta?.icon : typeMeta?.icon}}
          </mat-icon>
        </div>
        <div>
          <p class="ht">{{isEdit ? 'Edit Account' : 'New Account'}}</p>
          <p class="hs">{{isEdit ? editTypeMeta?.label : 'Add a bank or cash account'}}</p>
        </div>
      </div>
      <button class="hx" (click)="cancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="b">

      <ng-container *ngIf="!isEdit">
        <span class="sl">Account Type</span>
        <div class="chips">
          <div *ngFor="let t of types" class="chip"
            [class.sel]="selectedType===t.value"
            [style.borderColor]="selectedType===t.value ? t.color : ''"
            [style.background]="selectedType===t.value ? t.bg : ''"
            [style.color]="selectedType===t.value ? t.color : ''"
            (click)="selectType(t.value)">
            <mat-icon [style.color]="selectedType===t.value ? t.color : '#9CA3AF'">{{t.icon}}</mat-icon>
            {{t.label}}
          </div>
        </div>
        <div class="ds" *ngIf="typeMeta" [style.background]="typeMeta.bg" [style.color]="typeMeta.color">
          <mat-icon [style.color]="typeMeta.color">info</mat-icon>
          {{typeDescription}}
        </div>
      </ng-container>

      <ng-container *ngIf="isEdit && editTypeMeta">
        <span class="sl">Account Type</span>
        <div class="tp" [style.background]="editTypeMeta.bg" [style.color]="editTypeMeta.color">
          <mat-icon [style.color]="editTypeMeta.color">{{editTypeMeta.icon}}</mat-icon>
          {{editTypeMeta.label}}
        </div>
      </ng-container>

      <span class="sl">Icon — click to choose</span>
      <div class="emoji-section">
        <ng-container *ngFor="let group of emojiGroups">
          <span class="emoji-group-label">{{ group.label }}</span>
          <div class="emoji-grid">
            <div *ngFor="let e of group.emojis" class="emoji-opt"
              [class.sel]="selectedIcon === e"
              (click)="selectedIcon = e">{{ e }}</div>
          </div>
        </ng-container>
      </div>
      <div class="emoji-selected-row">
        <span class="emoji-selected-preview">{{ selectedIcon }}</span>
        <span class="emoji-selected-label">Selected icon</span>
      </div>

      <span class="sl">Details</span>
      <form [formGroup]="form">

        <div class="r2">
          <div class="fg">
            <label>Account Name <span class="req">*</span></label>
            <input class="fi" formControlName="name"
              [class.err]="nameInvalid" [placeholder]="namePlaceholder">
            <span class="ferr" *ngIf="nameInvalid">Required</span>
          </div>
          <div class="fg">
            <label>Bank Name <span class="opt">(optional)</span></label>
            <input class="fi" formControlName="bankName" [placeholder]="bankPlaceholder">
          </div>
        </div>

        <div class="r2">
          <div class="fg">
            <label>Opening Date <span class="opt">(optional)</span></label>
            <input class="fi" type="date" formControlName="openingDate">
          </div>
          <div class="fg">
            <label>Currency</label>
            <select class="fi" formControlName="currency">
              <option value="INR">INR – Rupee</option>
              <option value="USD">USD – Dollar</option>
              <option value="EUR">EUR – Euro</option>
              <option value="GBP">GBP – Pound</option>
              <option value="SGD">SGD – Dollar</option>
            </select>
          </div>
        </div>

        <div class="fg">
          <label>Current Balance</label>
          <div class="pfx">
            <span class="sym">₹</span>
            <input class="fi" type="number" formControlName="balance" placeholder="0" min="0">
          </div>
        </div>

        <div class="fg">
          <label>Notes <span class="opt">(optional)</span></label>
          <textarea class="fta" formControlName="notes" rows="2" [placeholder]="notesPlaceholder"></textarea>
        </div>

      </form>
    </div>

    <div class="f">
      <button mat-stroked-button (click)="cancel()"
        style="height:30px;font-size:.8125rem;border-radius:6px;line-height:1">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving"
        style="height:30px;font-size:.8125rem;font-weight:600;border-radius:6px;line-height:1;min-width:104px">
        <mat-spinner *ngIf="saving" diameter="12" style="display:inline-block;margin-right:4px"></mat-spinner>
        {{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Account')}}
      </button>
    </div>
  `,
})
export class AccountFormDialogComponent implements OnInit {
  isEdit: boolean;
  form!: FormGroup;
  saving = false;
  selectedType: AccountType = 'savings';
  editTypeMeta: AccountTypeMeta | undefined;
  selectedIcon = '🏦';

  readonly types       = ACCOUNT_TYPES;
  readonly emojiGroups = EMOJI_GROUPS;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<AccountFormDialogComponent>,
    private svc: AccountsService,
    private fb: FormBuilder,
  ) {
    this.isEdit = data.account !== null;
  }

  ngOnInit(): void {
    const a = this.data.account;
    if (a) {
      const type = ACCOUNT_TYPES.find(t => t.value === a.account_type)
        ? a.account_type
        : 'other';
      this.selectedType = type as AccountType;
      this.editTypeMeta = TYPE_MAP[type] ?? TYPE_MAP['other'];
      this.selectedIcon = (a.meta?.['icon'] as string) || '🏦';
      this.form = this.fb.group({
        name:        [a.name, Validators.required],
        bankName:    [a.institution ?? ''],
        openingDate: [(a.meta?.['openingDate'] as string) ?? ''],
        currency:    [a.currency ?? 'INR'],
        balance:     [Number(a.balance) || 0],
        notes:       [a.notes ?? ''],
      });
    } else {
      this.form = this.fb.group({
        name:        ['', Validators.required],
        bankName:    [''],
        openingDate: [''],
        currency:    ['INR'],
        balance:     [0],
        notes:       [''],
      });
    }
  }

  selectType(t: AccountType): void { this.selectedType = t; }

  get typeMeta():        AccountTypeMeta | undefined { return TYPE_MAP[this.selectedType]; }
  get typeDescription(): string  { return TYPE_DESCRIPTIONS[this.selectedType] ?? ''; }
  get nameInvalid():     boolean { const c = this.form.get('name'); return !!(c?.invalid && c?.touched); }

  get namePlaceholder(): string {
    const map: Partial<Record<AccountType, string>> = {
      savings: 'e.g. HDFC Savings', current: 'e.g. ICICI Current',
      cash: 'e.g. Wallet Cash', other: 'e.g. Gold Holdings',
    };
    return map[this.selectedType] ?? 'Account name';
  }

  get bankPlaceholder(): string {
    const map: Partial<Record<AccountType, string>> = {
      savings: 'e.g. HDFC Bank', current: 'e.g. ICICI Bank',
      cash: 'e.g. PhonePe Wallet',
    };
    return map[this.selectedType] ?? 'Bank or institution';
  }

  get notesPlaceholder(): string {
    const map: Partial<Record<AccountType, string>> = {
      savings: 'Account number, IFSC...', current: 'Account number, IFSC...',
      cash: 'Location, denomination...', other: 'Any additional details...',
    };
    return map[this.selectedType] ?? 'Any additional details...';
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;

    if (this.isEdit) {
      const existingMeta = this.data.account?.meta ?? {};
      const payload: UpdateAccountPayload = {
        name:        v.name,
        institution: v.bankName || null,
        currency:    v.currency,
        balance:     Number(v.balance),
        notes:       v.notes || null,
        meta:        { ...existingMeta, openingDate: v.openingDate || null, icon: this.selectedIcon },
      };
      this.svc.update(this.data.account!.id, payload).subscribe({
        next:  () => this.dialogRef.close(true),
        error: () => { this.saving = false; },
      });
    } else {
      const payload: CreateAccountPayload = {
        name:        v.name,
        accountType: this.selectedType,
        institution: v.bankName || undefined,
        currency:    v.currency ?? 'INR',
        balance:     Number(v.balance) || 0,
        notes:       v.notes || undefined,
        meta:        { icon: this.selectedIcon, ...(v.openingDate ? { openingDate: v.openingDate } : {}) },
      };
      this.svc.create(payload).subscribe({
        next:  () => this.dialogRef.close(true),
        error: () => { this.saving = false; },
      });
    }
  }

  cancel(): void { this.dialogRef.close(false); }
}

// ── List component ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-accounts-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, CurrencyPipe, DatePipe,
    MatProgressSpinnerModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatDialogModule,
  ],
  styles: [`
    .spinner-wrap { display:flex;justify-content:center;padding:100px 0; }

    /* ── Stats ──────────────────────────────── */
    .stats-row { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px; }

    @media (max-width: 640px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 400px) {
      .stats-row { grid-template-columns: 1fr; }
    }
    .stat-card { background:white;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px; }
    .stat-label { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:6px; }
    .stat-val   { font-size:1.5rem;font-weight:700;letter-spacing:-.5px;color:#0F172A; }

    /* ── Table ──────────────────────────────── */
    .card-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }
    .table-wrap  { overflow-x:auto; }
    table { width:100%;border-collapse:collapse; }
    th {
      text-align:left;font-size:.6875rem;font-weight:700;text-transform:uppercase;
      letter-spacing:.06em;color:#94A3B8;padding:8px 12px;
      border-bottom:2px solid #F1F5F9;white-space:nowrap;
    }
    th.right, td.right { text-align:right; }
    td {
      padding:13px 12px;border-bottom:1px solid #F8FAFC;
      font-size:.875rem;color:#374151;vertical-align:middle;
    }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:#FAFBFC; }

    .acc-icon { width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .acc-icon mat-icon { font-size:18px;width:18px;height:18px; }
    .acc-name { font-size:.875rem;font-weight:600;color:#0F172A; }
    .acc-bank { font-size:.75rem;color:#94A3B8;margin-top:2px; }

    .type-pill {
      display:inline-flex;align-items:center;gap:5px;
      padding:3px 10px;border-radius:20px;font-size:.6875rem;font-weight:600;
    }
    .type-pill mat-icon { font-size:13px;width:13px;height:13px; }

    .balance-val { font-size:.9375rem;font-weight:700;color:#0F172A; }
    .currency-tag{ font-size:.6875rem;color:#94A3B8; }

    .actions { display:flex;gap:4px;justify-content:flex-end; }
    .btn-i { width:30px;height:30px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .12s; }
    .btn-edit   { background:#EFF6FF;color:#2563EB; }
    .btn-edit:hover { background:#DBEAFE; }
    .btn-del    { background:#FEF2F2;color:#DC2626; }
    .btn-del:hover  { background:#FEE2E2; }
    .btn-i mat-icon { font-size:15px;width:15px;height:15px; }

    /* ── Empty ──────────────────────────────── */
    .empty-state { display:flex;flex-direction:column;align-items:center;padding:60px 0;gap:12px;text-align:center; }

    /* ── Delete confirm ─────────────────────── */
    .del-overlay {
      position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.45);
    }
    .del-card {
      background:white;border-radius:16px;padding:28px 32px;max-width:400px;width:90%;
      box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center;
    }
    .del-icon    { width:52px;height:52px;border-radius:50%;background:#FEF2F2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px; }
    .del-title   { font-size:1.0625rem;font-weight:700;color:#0F172A;margin:0 0 8px; }
    .del-desc    { font-size:.875rem;color:#64748B;line-height:1.5;margin:0 0 24px; }
    .del-actions { display:flex;gap:10px;justify-content:center; }
  `],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Accounts</h1>
        <p class="page-subtitle">Savings, current, and cash accounts</p>
      </div>
      <button mat-flat-button color="primary" (click)="openAdd()" style="border-radius:8px;font-weight:600">
        <mat-icon style="font-size:18px;width:18px;height:18px;margin-right:4px">add</mat-icon>
        Add Account
      </button>
    </div>

    <!-- Loading -->
    <div *ngIf="loading" class="spinner-wrap"><mat-spinner diameter="44"></mat-spinner></div>

    <ng-container *ngIf="!loading">

      <!-- Stats row -->
      <div class="stats-row" *ngIf="accounts.length > 0">
        <div class="stat-card">
          <div class="stat-label">Total Accounts</div>
          <div class="stat-val">{{ accounts.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Balance (INR)</div>
          <div class="stat-val" style="color:#16A34A">{{ totalBalance | currency:'INR':'symbol-narrow':'1.0-0' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Accounts</div>
          <div class="stat-val" style="color:#2563EB">{{ activeCount }}</div>
        </div>
      </div>

      <!-- Table card -->
      <div class="card" style="padding:20px 24px">
        <div class="card-header">
          <div>
            <p class="card-title">All Accounts</p>
            <p class="card-subtitle">{{ accounts.length }} account{{ accounts.length !== 1 ? 's' : '' }}</p>
          </div>
        </div>

        <!-- Empty -->
        <div *ngIf="accounts.length === 0" class="empty-state">
          <div style="width:64px;height:64px;border-radius:16px;background:#EFF6FF;display:flex;align-items:center;justify-content:center">
            <mat-icon style="color:#2563EB;font-size:28px;width:28px;height:28px">account_balance</mat-icon>
          </div>
          <p style="font-size:1rem;font-weight:600;color:#0F172A;margin:0">No accounts yet</p>
          <p style="font-size:.875rem;color:#64748B;margin:0;max-width:300px">
            Add your savings, current, and cash accounts to start tracking your balance.
          </p>
          <button mat-flat-button color="primary" (click)="openAdd()" style="border-radius:8px;font-weight:600;margin-top:4px">
            <mat-icon>add</mat-icon> Add your first account
          </button>
        </div>

        <!-- Table -->
        <div class="table-wrap" *ngIf="accounts.length > 0">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Bank</th>
                <th>Opened</th>
                <th class="right">Balance</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let acc of accounts">
                <td>
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="acc-icon" [style.background]="meta(acc.account_type).bg"
                      style="font-size:20px">
                      {{ accIcon(acc) }}
                    </div>
                    <div>
                      <div class="acc-name">{{ acc.name }}</div>
                      <div class="acc-bank" *ngIf="acc.institution">{{ acc.institution }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="type-pill"
                    [style.background]="meta(acc.account_type).bg"
                    [style.color]="meta(acc.account_type).color">
                    <mat-icon>{{ meta(acc.account_type).icon }}</mat-icon>
                    {{ meta(acc.account_type).label }}
                  </span>
                </td>
                <td style="color:#64748B">{{ acc.institution || '—' }}</td>
                <td style="color:#64748B;white-space:nowrap">
                  {{ acc.meta['openingDate'] ? ($any(acc.meta['openingDate']) | date:'d MMM y') : '—' }}
                </td>
                <td class="right">
                  <div class="balance-val">{{ acc.balance | currency:acc.currency:'symbol-narrow':'1.2-2' }}</div>
                  <div class="currency-tag">{{ acc.currency }}</div>
                </td>
                <td class="right">
                  <div class="actions">
                    <button class="btn-i btn-edit" (click)="openEdit(acc)" matTooltip="Edit">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button class="btn-i btn-del" (click)="confirmDelete(acc)" matTooltip="Delete">
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

    <!-- Delete confirm -->
    <div class="del-overlay" *ngIf="deleteTarget">
      <div class="del-card">
        <div class="del-icon">
          <mat-icon style="color:#DC2626;font-size:24px;width:24px;height:24px">warning</mat-icon>
        </div>
        <p class="del-title">Delete Account?</p>
        <p class="del-desc">
          "<strong>{{ deleteTarget.name }}</strong>" and all its data will be permanently removed.
          This cannot be undone.
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
export class AccountsListComponent implements OnInit {
  loading  = true;
  deleting = false;
  accounts: Account[] = [];
  deleteTarget: Account | null = null;
  totalBalance = 0;
  activeCount  = 0;

  constructor(
    private svc: AccountsService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading = true;
    this.svc.list().subscribe({
      next: (data) => {
        this.accounts = data;
        this.totalBalance = data.reduce((s, a) => s + Number(a.balance), 0);
        this.activeCount  = data.filter(a => a.is_active).length;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openAdd(): void {
    this.dialog.open(AccountFormDialogComponent, {
      data: { account: null } as DialogData,
      width: '440px',
      maxHeight: '92vh',
      panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  openEdit(acc: Account): void {
    this.dialog.open(AccountFormDialogComponent, {
      data: { account: acc } as DialogData,
      width: '440px',
      maxHeight: '92vh',
      panelClass: 'pwms-dialog',
    }).afterClosed().subscribe((saved: boolean) => { if (saved) this.load(); });
  }

  confirmDelete(acc: Account): void {
    this.deleteTarget = acc;
    this.cdr.markForCheck();
  }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.svc.remove(this.deleteTarget.id).subscribe({
      next: () => { this.deleting = false; this.deleteTarget = null; this.load(); },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }

  meta(t: AccountType): AccountTypeMeta {
    return TYPE_MAP[t] ?? { value: 'other' as AccountType, label: t, icon: 'category', color: '#6B7280', bg: '#F9FAFB' };
  }

  accIcon(acc: Account): string {
    return (acc.meta?.['icon'] as string) || '🏦';
  }
}
