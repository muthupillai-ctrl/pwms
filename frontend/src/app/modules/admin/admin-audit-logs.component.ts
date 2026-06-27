import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../core/services/admin.service';
import { AuditLog, AdminPageMeta } from '../../shared/models/auth.models';

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor, NgIf, DatePipe, FormsModule, MatProgressSpinnerModule, MatIconModule],
  styles: [`
    .filters {
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
      background: white; border: 1px solid #E2E8F0; border-radius: 12px;
      padding: 14px 16px; margin-bottom: 16px;
    }
    .fi {
      height: 36px; padding: 0 10px; border: 1.5px solid #E2E8F0;
      border-radius: 8px; font-size: 0.8125rem; font-family: inherit;
      outline: none; min-width: 160px;
    }
    .fi:focus { border-color: #3B82F6; }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; font-size: 0.6875rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8;
      padding: 8px 12px; border-bottom: 2px solid #F1F5F9; white-space: nowrap;
    }
    td {
      padding: 11px 12px; border-bottom: 1px solid #F8FAFC;
      font-size: 0.8125rem; color: #374151; vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #FAFBFC; }

    .action-tag {
      display: inline-block; padding: 2px 8px; border-radius: 6px;
      font-size: 0.6875rem; font-weight: 600; font-family: 'JetBrains Mono', monospace;
      background: #F1F5F9; color: #334155;
    }

    .pagination {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0 0; border-top: 1px solid #F1F5F9;
      font-size: 0.8125rem; color: #64748B;
    }
    .page-btns { display: flex; gap: 6px; }
    .page-btn {
      height: 28px; min-width: 28px; border: 1px solid #E2E8F0;
      border-radius: 6px; background: white; cursor: pointer;
      font-size: 0.8125rem; color: #374151; padding: 0 8px;
    }
    .page-btn:hover   { background: #F8FAFC; }
    .page-btn.active  { background: #2563EB; color: white; border-color: #2563EB; }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .spinner-center { display: flex; justify-content: center; padding: 80px 0; }
  `],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Audit Logs</h1>
        <p class="page-subtitle">All user actions across the platform</p>
      </div>
    </div>

    <div class="filters">
      <input class="fi" placeholder="Filter by action…" [(ngModel)]="filterAction" (input)="onFilterChange()">
      <input class="fi" type="date" [(ngModel)]="dateFrom" (change)="load()">
      <input class="fi" type="date" [(ngModel)]="dateTo" (change)="load()">
    </div>

    <div class="card" style="padding: 20px 24px">
      <div *ngIf="loading" class="spinner-center"><mat-spinner diameter="36"></mat-spinner></div>

      <ng-container *ngIf="!loading">
        <div class="card-header">
          <div>
            <p class="card-title">Log Entries</p>
            <p class="card-subtitle">{{ meta?.total ?? 0 }} total</p>
          </div>
        </div>

        <div *ngIf="logs.length === 0" class="empty-state">
          <div class="empty-icon" style="background:#F1F5F9">
            <mat-icon style="color:#64748B;font-size:24px;width:24px;height:24px">history</mat-icon>
          </div>
          <p class="empty-title">No log entries</p>
          <p class="empty-description">Audit logs will appear here as users take actions.</p>
        </div>

        <div *ngIf="logs.length > 0" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs">
                <td style="white-space:nowrap;color:#64748B">{{ log.created_at | date:'d MMM y, HH:mm:ss' }}</td>
                <td style="color:#374151">
                  <div style="font-weight:600;font-size:0.8rem">{{ log.user_email ?? '—' }}</div>
                  <div style="font-size:0.7rem;color:#94A3B8">{{ log.user_id ?? 'system' }}</div>
                </td>
                <td><span class="action-tag">{{ log.action }}</span></td>
                <td style="color:#64748B">
                  <ng-container *ngIf="log.entity_type">{{ log.entity_type }}<br>
                    <span style="font-size:0.7rem;color:#94A3B8">{{ log.entity_id }}</span>
                  </ng-container>
                  <span *ngIf="!log.entity_type">—</span>
                </td>
                <td style="font-size:0.8rem;color:#64748B;font-family:monospace">{{ log.ip_address ?? '—' }}</td>
              </tr>
            </tbody>
          </table>

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
  `,
})
export class AdminAuditLogsComponent implements OnInit {
  logs: AuditLog[] = [];
  meta: AdminPageMeta | null = null;
  loading = true;
  currentPage  = 1;
  filterAction = '';
  dateFrom = '';
  dateTo   = '';

  private filterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private svc: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.svc.listAuditLogs({
      page: this.currentPage, limit: 50,
      action:   this.filterAction || undefined,
      dateFrom: this.dateFrom || undefined,
      dateTo:   this.dateTo   || undefined,
    }).subscribe({
      next: (res) => {
        this.logs = res.data;
        this.meta = res.meta ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  onFilterChange(): void {
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => { this.currentPage = 1; this.load(); }, 400);
  }

  goTo(page: number): void {
    if (!this.meta || page < 1 || page > this.meta.totalPages) return;
    this.currentPage = page;
    this.load();
  }

  get pageNumbers(): number[] {
    if (!this.meta) return [];
    const cur = this.currentPage;
    const total = this.meta.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    return Array.from({ length: 5 }, (_, i) => Math.max(1, cur - 2) + i).filter(p => p <= total);
  }

  min(a: number, b: number): number { return Math.min(a, b); }
}
