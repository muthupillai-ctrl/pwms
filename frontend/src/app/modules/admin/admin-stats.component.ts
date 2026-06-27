import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../core/services/admin.service';
import { AdminStats } from '../../shared/models/auth.models';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, MatProgressSpinnerModule, MatIconModule],
  styles: [`
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }

    .stat-card {
      background: white; border: 1px solid #E2E8F0; border-radius: 14px;
      padding: 22px 24px; display: flex; flex-direction: column; gap: 6px;
    }

    .stat-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; margin-bottom: 8px;
    }
    .stat-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .stat-val  { font-size: 2rem; font-weight: 700; letter-spacing: -1px; color: #0F172A; line-height: 1; }
    .stat-lbl  { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #64748B; }

    .roles-card { background: white; border: 1px solid #E2E8F0; border-radius: 14px; padding: 22px 24px; }
    .roles-title { font-size: 0.9375rem; font-weight: 700; color: #0F172A; margin: 0 0 16px; }
    .role-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid #F1F5F9;
    }
    .role-row:last-child { border-bottom: none; }
    .role-name { font-size: 0.875rem; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 8px; }
    .role-dot  { width: 8px; height: 8px; border-radius: 50%; }
    .role-count { font-size: 1rem; font-weight: 700; color: #0F172A; }

    .spinner-center { display: flex; justify-content: center; padding: 80px 0; }
  `],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Platform Stats</h1>
        <p class="page-subtitle">Live overview of all registered users and activity</p>
      </div>
    </div>

    <div *ngIf="loading" class="spinner-center"><mat-spinner diameter="40"></mat-spinner></div>

    <ng-container *ngIf="!loading && stats">

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:#EFF6FF">
            <mat-icon style="color:#2563EB">group</mat-icon>
          </div>
          <div class="stat-val">{{ stats.totalUsers }}</div>
          <div class="stat-lbl">Total Users</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#F0FDF4">
            <mat-icon style="color:#16A34A">person_check</mat-icon>
          </div>
          <div class="stat-val" style="color:#16A34A">{{ stats.activeUsers }}</div>
          <div class="stat-lbl">Active Users</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#FEF2F2">
            <mat-icon style="color:#DC2626">person_off</mat-icon>
          </div>
          <div class="stat-val" style="color:#DC2626">{{ stats.totalUsers - stats.activeUsers }}</div>
          <div class="stat-lbl">Suspended</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#FFFBEB">
            <mat-icon style="color:#D97706">today</mat-icon>
          </div>
          <div class="stat-val" style="color:#D97706">{{ stats.newToday }}</div>
          <div class="stat-lbl">New Today</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#F5F3FF">
            <mat-icon style="color:#7C3AED">date_range</mat-icon>
          </div>
          <div class="stat-val" style="color:#7C3AED">{{ stats.newThisWeek }}</div>
          <div class="stat-lbl">New This Week</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#ECFEFF">
            <mat-icon style="color:#0E7490">security</mat-icon>
          </div>
          <div class="stat-val" style="color:#0E7490">{{ stats.mfaEnabled }}</div>
          <div class="stat-lbl">MFA Enabled</div>
        </div>
      </div>

      <div class="roles-card">
        <p class="roles-title">Users by Role</p>
        <div class="role-row" *ngFor="let r of roleEntries">
          <div class="role-name">
            <div class="role-dot" [style.background]="roleColor(r.role)"></div>
            {{ roleLabel(r.role) }}
          </div>
          <span class="role-count">{{ r.count }}</span>
        </div>
      </div>

    </ng-container>
  `,
})
export class AdminStatsComponent implements OnInit {
  loading = true;
  stats: AdminStats | null = null;
  roleEntries: { role: string; count: number }[] = [];

  constructor(private svc: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.svc.getStats().subscribe({
      next: (res) => {
        this.stats = res.data;
        this.roleEntries = Object.entries(res.data.byRole).map(([role, count]) => ({ role, count }));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  roleLabel(r: string): string {
    return { owner: 'Owner', admin: 'Administrator', loan_user: 'Loan User' }[r] ?? r;
  }

  roleColor(r: string): string {
    return { owner: '#2563EB', admin: '#F59E0B', loan_user: '#7C3AED' }[r] ?? '#64748B';
  }
}
