import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatTooltipModule],
  styles: [`
    :host { display: flex; height: 100vh; overflow: hidden; }

    .sidebar {
      width: 240px; min-width: 240px;
      background: #1C1917;
      display: flex; flex-direction: column;
      overflow-y: auto; scrollbar-width: none;
    }
    .sidebar::-webkit-scrollbar { display: none; }

    .brand {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 16px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .brand-logo {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .brand-logo mat-icon { color: white; font-size: 18px; width: 18px; height: 18px; }
    .brand-name    { font-size: 0.9375rem; font-weight: 700; color: #F8FAFC; }
    .brand-sub     { font-size: 0.6rem; color: #F59E0B; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; }

    .back-link {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px 0;
      font-size: 0.75rem; color: rgba(255,255,255,0.35);
      cursor: pointer; text-decoration: none;
      transition: color 0.12s;
    }
    .back-link:hover { color: rgba(255,255,255,0.65); }
    .back-link mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .nav { flex: 1; padding: 12px 10px; }

    .nav-label {
      font-size: 0.58rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1.2px; color: rgba(255,255,255,0.25);
      padding: 10px 8px 4px;
    }

    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 8px;
      color: rgba(255,255,255,0.5); font-size: 0.8525rem; font-weight: 500;
      cursor: pointer; text-decoration: none;
      transition: background 0.12s, color 0.12s; margin-bottom: 1px;
    }
    .nav-item mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; }
    .nav-item:hover  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
    .nav-item.active { background: rgba(245,158,11,0.15); color: #FCD34D; }
    .nav-item.active mat-icon { color: #FCD34D; }

    .user-section {
      padding: 12px 10px 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .admin-badge {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 8px;
    }
    .admin-avatar {
      width: 30px; height: 30px; border-radius: 8px;
      background: linear-gradient(135deg, #F59E0B, #B45309);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; color: white; flex-shrink: 0;
    }
    .admin-info { flex: 1; min-width: 0; }
    .admin-name { font-size: 0.8rem; font-weight: 600; color: #F1F5F9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .admin-role { font-size: 0.65rem; color: #F59E0B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .logout-btn { color: rgba(255,255,255,0.35) !important; flex-shrink: 0; }
    .logout-btn:hover { color: rgba(255,255,255,0.7) !important; }

    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #F8FAFC; }

    .topbar {
      background: white; height: 56px; min-height: 56px;
      border-bottom: 1px solid #E2E8F0;
      display: flex; align-items: center; padding: 0 24px; gap: 12px; flex-shrink: 0;
    }
    .admin-pill {
      display: flex; align-items: center; gap: 6px;
      background: #FFFBEB; border: 1px solid #FDE68A;
      border-radius: 20px; padding: 3px 10px;
      font-size: 0.72rem; font-weight: 700; color: #B45309;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .admin-pill mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .topbar-title { font-size: 0.9rem; font-weight: 600; color: #0F172A; }
    .flex-spacer { flex: 1 1 auto; }

    .content { flex: 1; overflow-y: auto; padding: 24px; }
  `],
  template: `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo"><mat-icon>admin_panel_settings</mat-icon></div>
        <div>
          <div class="brand-name">Admin Panel</div>
          <div class="brand-sub">PWMS</div>
        </div>
      </div>

      <a class="back-link" routerLink="/dashboard">
        <mat-icon>arrow_back</mat-icon> Back to App
      </a>

      <nav class="nav">
        <div class="nav-label">Overview</div>
        <a class="nav-item" routerLink="/admin/stats" routerLinkActive="active">
          <mat-icon>insights</mat-icon> Stats
        </a>

        <div class="nav-label">Management</div>
        <a class="nav-item" routerLink="/admin/users" routerLinkActive="active">
          <mat-icon>group</mat-icon> Users
        </a>
        <a class="nav-item" routerLink="/admin/categories" routerLinkActive="active">
          <mat-icon>label</mat-icon> Categories
        </a>

        <div class="nav-label">Security</div>
        <a class="nav-item" routerLink="/admin/audit-logs" routerLinkActive="active">
          <mat-icon>history</mat-icon> Audit Logs
        </a>
      </nav>

      <div class="user-section">
        <div class="admin-badge">
          <div class="admin-avatar">A</div>
          <div class="admin-info">
            <div class="admin-name">{{ email }}</div>
            <div class="admin-role">Administrator</div>
          </div>
          <button mat-icon-button class="logout-btn" (click)="logout()" matTooltip="Sign out">
            <mat-icon style="font-size:16px;width:16px;height:16px">logout</mat-icon>
          </button>
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="admin-pill">
          <mat-icon>shield</mat-icon> Admin
        </div>
        <span class="topbar-title">Wealth Management System</span>
        <span class="flex-spacer"></span>
      </header>
      <div class="content">
        <router-outlet />
      </div>
    </div>
  `,
})
export class AdminShellComponent {
  email = this.auth.getTokenPayload()?.email ?? '';

  constructor(private auth: AuthService, private router: Router) {}

  logout(): void {
    this.auth.logout().subscribe({
      complete: () => this.router.navigate(['/auth/login']),
      error:    () => this.router.navigate(['/auth/login']),
    });
  }
}
