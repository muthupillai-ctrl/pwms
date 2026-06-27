import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../../core/services/admin.service';
import { AdminUser, AdminPageMeta, UserRole } from '../../shared/models/auth.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor, NgIf, DatePipe, FormsModule, MatProgressSpinnerModule, MatIconModule, MatButtonModule, MatTooltipModule],
  styles: [`
    .filters {
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
      background: white; border: 1px solid #E2E8F0; border-radius: 12px;
      padding: 14px 16px; margin-bottom: 16px;
    }
    .search-wrap { position: relative; flex: 1; min-width: 200px; }
    .search-wrap mat-icon {
      position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
      font-size: 16px; width: 16px; height: 16px; color: #94A3B8;
    }
    .search-input {
      width: 100%; height: 36px; padding: 0 10px 0 34px;
      border: 1.5px solid #E2E8F0; border-radius: 8px;
      font-size: 0.875rem; outline: none; font-family: inherit;
      transition: border-color 0.12s;
    }
    .search-input:focus { border-color: #3B82F6; }
    select.fi {
      height: 36px; padding: 0 28px 0 10px; border: 1.5px solid #E2E8F0;
      border-radius: 8px; font-size: 0.8125rem; font-family: inherit;
      outline: none; appearance: none; cursor: pointer;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center #fff;
    }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; font-size: 0.6875rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8;
      padding: 8px 12px; border-bottom: 2px solid #F1F5F9; white-space: nowrap;
    }
    th.right, td.right { text-align: right; }
    td {
      padding: 12px 12px; border-bottom: 1px solid #F8FAFC;
      font-size: 0.875rem; color: #374151; vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #FAFBFC; }

    .user-avatar {
      width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.875rem; font-weight: 700; color: white;
    }
    .user-name  { font-size: 0.875rem; font-weight: 600; color: #0F172A; }
    .user-email { font-size: 0.75rem; color: #94A3B8; margin-top: 1px; }

    .role-select {
      height: 28px; padding: 0 24px 0 8px; border: 1.5px solid #E2E8F0;
      border-radius: 6px; font-size: 0.75rem; font-family: inherit;
      outline: none; appearance: none; cursor: pointer; font-weight: 600;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 6px center;
      transition: border-color 0.12s;
    }
    .role-select:focus { border-color: #3B82F6; }
    .role-select:disabled { opacity: 0.5; cursor: not-allowed; background-color: #F8FAFC; }
    .role-select.role-owner     { color: #1D4ED8; background-color: #EFF6FF; border-color: #BFDBFE; }
    .role-select.role-admin     { color: #B45309; background-color: #FFFBEB; border-color: #FDE68A; }
    .role-select.role-loan_user { color: #6D28D9; background-color: #F5F3FF; border-color: #DDD6FE; }
    .role-saving { font-size: 0.7rem; color: #94A3B8; margin-top: 3px; }

    .status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 5px; }

    .actions { display: flex; gap: 4px; justify-content: flex-end; }
    .btn-i {
      width: 28px; height: 28px; border-radius: 7px; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.12s;
    }
    .btn-i mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .btn-suspend  { background: #FFFBEB; color: #D97706; }
    .btn-suspend:hover  { background: #FEF3C7; }
    .btn-activate { background: #F0FDF4; color: #16A34A; }
    .btn-activate:hover { background: #DCFCE7; }
    .btn-del  { background: #FEF2F2; color: #DC2626; }
    .btn-del:hover { background: #FEE2E2; }

    .pagination {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0 0; border-top: 1px solid #F1F5F9; margin-top: 4px;
      font-size: 0.8125rem; color: #64748B;
    }
    .page-btns { display: flex; gap: 6px; }
    .page-btn {
      height: 30px; min-width: 30px; border: 1px solid #E2E8F0;
      border-radius: 6px; background: white; cursor: pointer;
      font-size: 0.8125rem; color: #374151; padding: 0 8px;
    }
    .page-btn:hover   { background: #F8FAFC; }
    .page-btn.active  { background: #2563EB; color: white; border-color: #2563EB; }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .error-banner {
      display: flex; align-items: center; gap: 10px;
      background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;
      padding: 12px 16px; margin-bottom: 16px; color: #DC2626; font-size: 0.875rem;
    }
    .action-error {
      background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px;
      padding: 8px 12px; margin-top: 10px; color: #DC2626; font-size: 0.8125rem;
      display: flex; align-items: center; gap: 8px;
    }

    .del-overlay {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.45);
    }
    .del-card {
      background: white; border-radius: 16px; padding: 28px 32px;
      max-width: 380px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      text-align: center;
    }
    .del-icon  { width: 48px; height: 48px; border-radius: 50%; background: #FEF2F2; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
    .del-title { font-size: 1rem; font-weight: 700; color: #0F172A; margin: 0 0 8px; }
    .del-desc  { font-size: 0.875rem; color: #64748B; line-height: 1.5; margin: 0 0 20px; }
    .del-btns  { display: flex; gap: 10px; justify-content: center; }

    .spinner-center { display: flex; justify-content: center; padding: 80px 0; }
    .you-badge { font-size: 0.7rem; color: #94A3B8; font-style: italic; }
  `],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Users</h1>
        <p class="page-subtitle">Manage all registered users</p>
      </div>
    </div>

    <!-- Error banner (list load failure) -->
    <div *ngIf="listError" class="error-banner">
      <mat-icon style="font-size:18px;width:18px;height:18px;flex-shrink:0">error_outline</mat-icon>
      {{ listError }}
      <button mat-button style="margin-left:auto;color:#DC2626;font-size:0.8125rem" (click)="load()">Retry</button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="search-wrap">
        <mat-icon>search</mat-icon>
        <input class="search-input" placeholder="Search by name or email…" [(ngModel)]="search" (input)="onSearch()">
      </div>
      <select class="fi" [(ngModel)]="filterRole" (change)="load()">
        <option value="">All Roles</option>
        <option value="owner">Owner</option>
        <option value="admin">Admin</option>
        <option value="loan_user">Loan User</option>
      </select>
      <select class="fi" [(ngModel)]="filterStatus" (change)="load()">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Suspended</option>
      </select>
    </div>

    <!-- Table card -->
    <div class="card" style="padding: 20px 24px">

      <div *ngIf="loading" class="spinner-center"><mat-spinner diameter="36"></mat-spinner></div>

      <ng-container *ngIf="!loading && !listError">
        <div class="card-header">
          <div>
            <p class="card-title">All Users</p>
            <p class="card-subtitle">{{ meta?.total ?? 0 }} total</p>
          </div>
        </div>

        <!-- Action error -->
        <div *ngIf="actionError" class="action-error">
          <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
          {{ actionError }}
          <button mat-icon-button style="margin-left:auto;padding:0;width:20px;height:20px" (click)="actionError = null">
            <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
          </button>
        </div>

        <div *ngIf="users.length === 0" class="empty-state">
          <div class="empty-icon" style="background:#EFF6FF">
            <mat-icon style="color:#2563EB;font-size:24px;width:24px;height:24px">group</mat-icon>
          </div>
          <p class="empty-title">No users found</p>
          <p class="empty-description">Try adjusting your search or filter.</p>
        </div>

        <div *ngIf="users.length > 0" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>MFA</th>
                <th>Joined</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of users">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="user-avatar" [style.background]="avatarColor(u.role)">{{ u.full_name[0]?.toUpperCase() }}</div>
                    <div>
                      <div class="user-name">{{ u.full_name }}</div>
                      <div class="user-email">{{ u.email }}</div>
                    </div>
                  </div>
                </td>

                <!-- Editable role column -->
                <td>
                  <div>
                    <select
                      class="role-select"
                      [class]="'role-select role-' + u.role"
                      [ngModel]="u.role"
                      (ngModelChange)="changeRole(u, $event)"
                      [disabled]="u.id === currentUserId || roleChanging === u.id">
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="loan_user">Loan User</option>
                    </select>
                    <div *ngIf="roleChanging === u.id" class="role-saving">Saving…</div>
                  </div>
                </td>

                <td>
                  <span [style.color]="u.is_active ? '#16A34A' : '#DC2626'" style="font-weight:600;font-size:0.8125rem">
                    <span class="status-dot" [style.background]="u.is_active ? '#16A34A' : '#DC2626'"></span>
                    {{ u.is_active ? 'Active' : 'Suspended' }}
                  </span>
                </td>
                <td>
                  <span [class]="u.mfa_enabled ? 'badge badge-green' : 'badge badge-gray'">
                    {{ u.mfa_enabled ? 'On' : 'Off' }}
                  </span>
                </td>
                <td style="color:#64748B;white-space:nowrap">{{ u.created_at | date:'d MMM y' }}</td>
                <td class="right">
                  <ng-container *ngIf="u.id !== currentUserId; else selfRow">
                    <div class="actions">
                      <button class="btn-i"
                        [class.btn-suspend]="u.is_active" [class.btn-activate]="!u.is_active"
                        (click)="toggleStatus(u)"
                        [matTooltip]="u.is_active ? 'Suspend user' : 'Activate user'">
                        <mat-icon>{{ u.is_active ? 'block' : 'check_circle' }}</mat-icon>
                      </button>
                      <button class="btn-i btn-del" (click)="confirmDelete(u)" matTooltip="Delete user">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </ng-container>
                  <ng-template #selfRow>
                    <span class="you-badge">you</span>
                  </ng-template>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div class="pagination" *ngIf="meta && meta.totalPages > 1">
            <span>Showing {{ (meta.page - 1) * meta.limit + 1 }}–{{ min(meta.page * meta.limit, meta.total) }} of {{ meta.total }}</span>
            <div class="page-btns">
              <button class="page-btn" (click)="goTo(currentPage - 1)" [disabled]="currentPage === 1">‹</button>
              <button *ngFor="let p of pageNumbers" class="page-btn" [class.active]="p === currentPage" (click)="goTo(p)">{{ p }}</button>
              <button class="page-btn" (click)="goTo(currentPage + 1)" [disabled]="currentPage === meta.totalPages">›</button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>

    <!-- Delete confirm overlay -->
    <div class="del-overlay" *ngIf="deleteTarget">
      <div class="del-card">
        <div class="del-icon"><mat-icon style="color:#DC2626;font-size:22px;width:22px;height:22px">warning</mat-icon></div>
        <p class="del-title">Delete User?</p>
        <p class="del-desc"><strong>{{ deleteTarget.email }}</strong> and all their data will be permanently removed.</p>
        <div class="del-btns">
          <button mat-stroked-button (click)="deleteTarget = null" style="border-radius:8px">Cancel</button>
          <button mat-flat-button color="warn" (click)="doDelete()" [disabled]="deleting"
            style="border-radius:8px;font-weight:600;min-width:90px">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AdminUsersComponent implements OnInit {
  users: AdminUser[]   = [];
  meta: AdminPageMeta | null = null;
  loading  = true;
  deleting = false;
  search   = '';
  filterRole   = '';
  filterStatus = '';
  currentPage  = 1;
  deleteTarget: AdminUser | null = null;
  currentUserId = '';
  listError: string | null   = null;
  actionError: string | null = null;
  roleChanging: string | null = null;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private svc: AdminService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.auth.getTokenPayload()?.sub ?? '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.listError = null;
    this.svc.listUsers({
      page: this.currentPage, limit: 20,
      search: this.search || undefined,
      role: this.filterRole || undefined,
      status: this.filterStatus || undefined,
    }).subscribe({
      next: (res) => {
        this.users = res.data;
        this.meta  = res.meta ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.listError = err?.error?.error?.message ?? 'Failed to load users. Check your connection or try again.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.currentPage = 1; this.load(); }, 350);
  }

  goTo(page: number): void {
    if (!this.meta || page < 1 || page > this.meta.totalPages) return;
    this.currentPage = page;
    this.load();
  }

  get pageNumbers(): number[] {
    if (!this.meta) return [];
    const total = this.meta.totalPages;
    const cur   = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
    return pages;
  }

  toggleStatus(u: AdminUser): void {
    this.actionError = null;
    this.svc.updateStatus(u.id, !u.is_active).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.actionError = err?.error?.error?.message ?? 'Failed to update status. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  changeRole(u: AdminUser, newRole: UserRole): void {
    if (newRole === u.role) return;
    this.actionError = null;
    this.roleChanging = u.id;
    this.svc.updateRole(u.id, newRole).subscribe({
      next: () => {
        u.role = newRole;
        this.roleChanging = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.error?.message ?? 'Failed to change role. Please try again.';
        this.roleChanging = null;
        this.cdr.markForCheck();
      },
    });
  }

  confirmDelete(u: AdminUser): void { this.deleteTarget = u; this.cdr.markForCheck(); }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.actionError = null;
    this.svc.deleteUser(this.deleteTarget.id).subscribe({
      next: () => { this.deleting = false; this.deleteTarget = null; this.load(); },
      error: (err) => {
        this.deleting = false;
        this.deleteTarget = null;
        this.actionError = err?.error?.error?.message ?? 'Failed to delete user. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  avatarColor(role: UserRole): string {
    return {
      owner:     'linear-gradient(135deg,#3B82F6,#1D4ED8)',
      admin:     'linear-gradient(135deg,#F59E0B,#B45309)',
      loan_user: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
    }[role] ?? '#64748B';
  }

  min(a: number, b: number): number { return Math.min(a, b); }
}
