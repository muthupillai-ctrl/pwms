import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../../core/services/admin.service';
import { SystemCategory } from '../../shared/models/auth.models';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor, NgIf, FormsModule, ReactiveFormsModule, MatProgressSpinnerModule, MatIconModule, MatButtonModule, MatTooltipModule],
  styles: [`
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; }

    .cat-row {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 0; border-bottom: 1px solid #F1F5F9;
    }
    .cat-row:last-child { border-bottom: none; }

    .cat-icon {
      width: 34px; height: 34px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      font-size: 0.75rem; font-weight: 700;
    }
    .cat-name  { flex: 1; font-size: 0.875rem; font-weight: 600; color: #0F172A; }
    .cat-icon-lbl { font-size: 0.75rem; color: #94A3B8; }

    .actions { display: flex; gap: 4px; }
    .btn-i {
      width: 28px; height: 28px; border-radius: 7px; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .btn-i mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .btn-edit { background: #EFF6FF; color: #2563EB; }
    .btn-edit:hover { background: #DBEAFE; }
    .btn-del  { background: #FEF2F2; color: #DC2626; }
    .btn-del:hover  { background: #FEE2E2; }

    /* Form panel */
    .form-card { position: sticky; top: 0; }
    .form-title { font-size: 0.9375rem; font-weight: 700; color: #0F172A; margin: 0 0 16px; }

    .fg { display: flex; flex-direction: column; gap: 3px; margin-bottom: 10px; }
    label { font-size: 0.6875rem; font-weight: 600; color: #374151; }
    .req { color: #EF4444; }
    input.fi {
      height: 34px; padding: 0 10px; border: 1.5px solid #E2E8F0;
      border-radius: 7px; font-size: 0.8125rem; font-family: inherit; outline: none;
      transition: border-color 0.12s;
    }
    input.fi:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
    input.fi.err   { border-color: #EF4444; }

    .color-row { display: flex; align-items: center; gap: 8px; }
    .color-preview { width: 28px; height: 28px; border-radius: 7px; border: 1px solid #E2E8F0; flex-shrink: 0; }

    .form-btns { display: flex; gap: 8px; margin-top: 4px; }

    .spinner-center { display: flex; justify-content: center; padding: 60px 0; }

    .del-overlay {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.45);
    }
    .del-card {
      background: white; border-radius: 16px; padding: 28px 32px;
      max-width: 360px; width: 90%; text-align: center;
    }
    .del-icon  { width: 44px; height: 44px; border-radius: 50%; background: #FEF2F2; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .del-title { font-size: 1rem; font-weight: 700; color: #0F172A; margin: 0 0 8px; }
    .del-desc  { font-size: 0.875rem; color: #64748B; margin: 0 0 20px; line-height: 1.5; }
    .del-btns  { display: flex; gap: 10px; justify-content: center; }
  `],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">System Categories</h1>
        <p class="page-subtitle">Manage the built-in categories available to all users</p>
      </div>
    </div>

    <div class="layout">

      <!-- Categories list -->
      <div class="card" style="padding:20px 24px">
        <div class="card-header">
          <div>
            <p class="card-title">Categories</p>
            <p class="card-subtitle">{{ categories.length }} system categories</p>
          </div>
        </div>

        <div *ngIf="loading" class="spinner-center"><mat-spinner diameter="36"></mat-spinner></div>

        <ng-container *ngIf="!loading">
          <div *ngFor="let cat of categories" class="cat-row">
            <div class="cat-icon"
              [style.background]="(cat.color ?? '#6B7280') + '20'"
              [style.color]="cat.color ?? '#6B7280'">
              <mat-icon style="font-size:16px;width:16px;height:16px">{{ cat.icon ?? 'label' }}</mat-icon>
            </div>
            <div style="flex:1">
              <div class="cat-name">{{ cat.name }}</div>
              <div class="cat-icon-lbl" *ngIf="cat.icon">{{ cat.icon }}</div>
            </div>
            <div class="color-preview" *ngIf="cat.color" [style.background]="cat.color"></div>
            <div class="actions">
              <button class="btn-i btn-edit" (click)="editCat(cat)" matTooltip="Edit">
                <mat-icon>edit</mat-icon>
              </button>
              <button class="btn-i btn-del" (click)="confirmDelete(cat)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </ng-container>
      </div>

      <!-- Add / Edit form -->
      <div class="card form-card" style="padding:20px 24px">
        <p class="form-title">{{ editTarget ? 'Edit Category' : 'Add Category' }}</p>
        <form [formGroup]="form" (ngSubmit)="save()">

          <div class="fg">
            <label>Name <span class="req">*</span></label>
            <input class="fi" [class.err]="nameInvalid" formControlName="name" placeholder="e.g. Freelance Income">
          </div>

          <div class="fg">
            <label>Icon <span style="color:#94A3B8;font-weight:400">(Material icon name)</span></label>
            <input class="fi" formControlName="icon" placeholder="e.g. work, shopping_cart">
          </div>

          <div class="fg">
            <label>Colour</label>
            <div class="color-row">
              <div class="color-preview" [style.background]="form.value.color || '#E2E8F0'"></div>
              <input class="fi" formControlName="color" placeholder="#22C55E" style="flex:1">
            </div>
          </div>

          <div class="form-btns">
            <button *ngIf="editTarget" mat-stroked-button type="button" (click)="cancelEdit()" style="border-radius:7px;flex:1">Cancel</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="saving"
              style="border-radius:7px;font-weight:600;flex:1">
              {{ saving ? 'Saving…' : (editTarget ? 'Save Changes' : 'Add Category') }}
            </button>
          </div>
        </form>
      </div>

    </div>

    <!-- Delete confirm -->
    <div class="del-overlay" *ngIf="deleteTarget">
      <div class="del-card">
        <div class="del-icon"><mat-icon style="color:#DC2626;font-size:20px;width:20px;height:20px">warning</mat-icon></div>
        <p class="del-title">Delete "{{ deleteTarget.name }}"?</p>
        <p class="del-desc">This system category will be permanently removed. User-defined categories are not affected.</p>
        <div class="del-btns">
          <button mat-stroked-button (click)="deleteTarget = null" style="border-radius:8px">Cancel</button>
          <button mat-flat-button color="warn" (click)="doDelete()" [disabled]="deleting"
            style="border-radius:8px;font-weight:600;min-width:90px">{{ deleting ? 'Deleting…' : 'Delete' }}</button>
        </div>
      </div>
    </div>
  `,
})
export class AdminCategoriesComponent implements OnInit {
  categories: SystemCategory[] = [];
  loading  = true;
  saving   = false;
  deleting = false;
  editTarget:   SystemCategory | null = null;
  deleteTarget: SystemCategory | null = null;
  form!: FormGroup;

  constructor(private svc: AdminService, private fb: FormBuilder, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.resetForm();
    this.load();
  }

  private resetForm(): void {
    this.form = this.fb.group({
      name:  ['', Validators.required],
      icon:  [''],
      color: [''],
    });
  }

  private load(): void {
    this.loading = true;
    this.svc.listCategories().subscribe({
      next: (res) => {
        this.categories = res.data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  editCat(cat: SystemCategory): void {
    this.editTarget = cat;
    this.form.patchValue({ name: cat.name, icon: cat.icon ?? '', color: cat.color ?? '' });
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editTarget = null;
    this.resetForm();
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.form.value;
    const data = { name: v.name, icon: v.icon || undefined, color: v.color || undefined };

    const req = this.editTarget
      ? this.svc.updateCategory(this.editTarget.id, data)
      : this.svc.createCategory(data);

    req.subscribe({
      next: (res) => {
        if (this.editTarget) {
          const idx = this.categories.findIndex(c => c.id === this.editTarget!.id);
          if (idx >= 0) this.categories[idx] = res.data;
        } else {
          this.categories = [...this.categories, res.data];
        }
        this.saving = false;
        this.editTarget = null;
        this.resetForm();
        this.cdr.markForCheck();
      },
      error: () => { this.saving = false; this.cdr.markForCheck(); },
    });
  }

  confirmDelete(cat: SystemCategory): void { this.deleteTarget = cat; this.cdr.markForCheck(); }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.svc.deleteCategory(this.deleteTarget.id).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== this.deleteTarget!.id);
        this.deleting = false;
        this.deleteTarget = null;
        this.cdr.markForCheck();
      },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }

  get nameInvalid(): boolean {
    const c = this.form.get('name');
    return !!(c?.invalid && c?.touched);
  }
}
