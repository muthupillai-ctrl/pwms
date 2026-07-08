import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AuthService } from '../../core/services/auth.service';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

interface NavChild { path: string; label: string; }
interface NavItem  { path?: string; label: string; icon: string; children?: NavChild[]; }
interface NavGroup { section: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  {
    section: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
    ],
  },
  {
    section: 'Portfolio',
    items: [
      { path: '/accounts',       label: 'Accounts',       icon: 'account_balance' },
      { path: '/fixed-deposits', label: 'Fixed Deposits', icon: 'savings' },
      { path: '/stocks',         label: 'Stocks',         icon: 'show_chart' },
      { path: '/mutual-funds',   label: 'Mutual Funds',   icon: 'trending_up' },
      { path: '/bonds',          label: 'Bonds',          icon: 'receipt_long' },
      {
        label: 'Loans', icon: 'handshake',
        children: [
          { path: '/loans',       label: 'Given' },
          { path: '/loans-taken', label: 'Taken' },
        ],
      },
      { path: '/sip', label: 'SIP', icon: 'autorenew' },
    ],
  },
  {
    section: 'Income',
    items: [
      { path: '/expected-income', label: 'Expected Income', icon: 'payments' },
    ],
  },
];

const LOAN_PATHS = ['/loans', '/loans-taken'];

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor, NgIf, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule, MatSidenavModule],
  styles: [`
    .sidenav-container {
      height: 100vh;
      background: #F1F5F9;
    }

    .sidebar {
      width: 256px;
      background: #0F172A;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      scrollbar-width: none;
      border-right: none;
    }
    .sidebar::-webkit-scrollbar { display: none; }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .brand-logo {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-logo mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }

    .brand-text .name    { font-size: 1rem; font-weight: 700; color: #F8FAFC; letter-spacing: 0.3px; }
    .brand-text .tagline { font-size: 0.65rem; color: rgba(255,255,255,0.35); letter-spacing: 0.8px; text-transform: uppercase; }

    .nav-groups { flex: 1; padding: 12px 10px; }

    .nav-section-label {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: rgba(255,255,255,0.28);
      padding: 12px 8px 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      color: rgba(255,255,255,0.55);
      font-size: 0.8625rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.12s, color 0.12s;
      margin-bottom: 1px;
    }
    .nav-item mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .nav-item:hover    { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); }
    .nav-item.active   { background: rgba(59,130,246,0.18);  color: #60A5FA; }
    .nav-item.active mat-icon { color: #60A5FA; }

    .nav-parent {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      color: rgba(255,255,255,0.55);
      font-size: 0.8625rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
      margin-bottom: 1px;
      user-select: none;
    }
    .nav-parent mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .nav-parent:hover  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); }
    .nav-parent.parent-active { color: #60A5FA; }
    .nav-parent.parent-active mat-icon { color: #60A5FA; }

    .expand-icon {
      margin-left: auto;
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      transition: transform 0.2s;
      color: rgba(255,255,255,0.3);
    }
    .expand-icon.open { transform: rotate(180deg); }

    .nav-children {
      overflow: hidden;
      max-height: 0;
      transition: max-height 0.2s ease;
    }
    .nav-children.open { max-height: 200px; }

    .nav-child {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px 7px 38px;
      border-radius: 8px;
      color: rgba(255,255,255,0.45);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.12s, color 0.12s;
      margin-bottom: 1px;
    }
    .nav-child:hover  { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
    .nav-child.active { background: rgba(59,130,246,0.15);  color: #60A5FA; }

    .child-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
      opacity: 0.6;
    }

    .user-section {
      padding: 12px 10px 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #7C3AED, #4F46E5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .user-info        { flex: 1; min-width: 0; }
    .user-name        { font-size: 0.8125rem; font-weight: 600; color: #F1F5F9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role        { font-size: 0.6875rem; color: rgba(255,255,255,0.35); }
    .logout-btn       { color: rgba(255,255,255,0.35) !important; flex-shrink: 0; }
    .logout-btn:hover { color: rgba(255,255,255,0.75) !important; }

    .main {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #F1F5F9;
    }

    .topbar {
      background: white;
      height: 60px;
      min-height: 60px;
      border-bottom: 1px solid #E2E8F0;
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 12px;
      flex-shrink: 0;
    }

    .menu-btn { margin-left: -8px; color: #0F172A !important; }

    .topbar-title   { font-size: 0.9375rem; font-weight: 600; color: #0F172A; }
    .topbar-divider { width: 1px; height: 20px; background: #E2E8F0; }
    .topbar-sub     { font-size: 0.8125rem; color: #94A3B8; }
    .flex-spacer    { flex: 1 1 auto; }

    .content { flex: 1; overflow-y: auto; padding: 24px; }

    @media (max-width: 768px) {
      .topbar { padding: 0 16px; gap: 8px; }
      .topbar-divider { display: none; }
      .topbar-sub { display: none; }
      .content { padding: 16px; }
    }
  `],
  template: `
    <mat-sidenav-container class="sidenav-container">

      <mat-sidenav #sidenav class="sidebar"
        [mode]="isMobile ? 'over' : 'side'"
        [opened]="!isMobile">

        <div class="brand">
          <div class="brand-logo"><mat-icon>account_balance_wallet</mat-icon></div>
          <div class="brand-text">
            <div class="name">PWMS</div>
            <div class="tagline">Wealth Manager</div>
          </div>
        </div>

        <nav class="nav-groups">
          <div *ngFor="let group of navGroups">
            <div class="nav-section-label">{{ group.section }}</div>

            <ng-container *ngFor="let item of group.items">
              <a
                *ngIf="!item.children"
                class="nav-item"
                [routerLink]="item.path"
                routerLinkActive="active"
                (click)="onNavClick()"
              >
                <mat-icon>{{ item.icon }}</mat-icon>
                {{ item.label }}
              </a>

              <ng-container *ngIf="item.children">
                <div
                  class="nav-parent"
                  [class.parent-active]="loansOpen"
                  (click)="toggleLoans()"
                >
                  <mat-icon>{{ item.icon }}</mat-icon>
                  {{ item.label }}
                  <mat-icon class="expand-icon" [class.open]="loansOpen">expand_more</mat-icon>
                </div>
                <div class="nav-children" [class.open]="loansOpen">
                  <a
                    *ngFor="let child of item.children"
                    class="nav-child"
                    [routerLink]="child.path"
                    routerLinkActive="active"
                    (click)="onNavClick()"
                  >
                    <span class="child-dot"></span>
                    {{ child.label }}
                  </a>
                </div>
              </ng-container>
            </ng-container>
          </div>

          <ng-container *ngIf="isAdmin">
            <div class="nav-section-label" style="margin-top:8px">System</div>
            <a class="nav-item" routerLink="/admin" routerLinkActive="active"
              style="color:rgba(245,158,11,0.7)"
              [style.background]="'rgba(245,158,11,0.08)'"
              (click)="onNavClick()">
              <mat-icon style="color:rgba(245,158,11,0.7)">admin_panel_settings</mat-icon>
              Admin Panel
            </a>
          </ng-container>
        </nav>

        <div class="user-section">
          <div class="user-row">
            <div class="user-avatar">{{ userInitial }}</div>
            <div class="user-info">
              <div class="user-name">{{ userName }}</div>
              <div class="user-role">{{ userEmail }}</div>
            </div>
            <button mat-icon-button class="logout-btn" (click)="logout()" matTooltip="Sign out">
              <mat-icon style="font-size:18px;width:18px;height:18px">logout</mat-icon>
            </button>
          </div>
        </div>

      </mat-sidenav>

      <mat-sidenav-content>
        <div class="main">
          <header class="topbar">
            <button *ngIf="isMobile" mat-icon-button class="menu-btn" (click)="sidenav.toggle()">
              <mat-icon>menu</mat-icon>
            </button>
            <span class="topbar-title">Personal Wealth Management</span>
            <div class="topbar-divider"></div>
            <span class="topbar-sub">Track · Manage · Grow</span>
            <span class="flex-spacer"></span>
          </header>
          <div class="content">
            <router-outlet />
          </div>
        </div>
      </mat-sidenav-content>

    </mat-sidenav-container>
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  readonly navGroups = NAV;
  readonly isAdmin: boolean;
  readonly userName: string;
  readonly userEmail: string;
  readonly userInitial: string;
  loansOpen = false;
  isMobile = false;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private breakpointObserver: BreakpointObserver,
  ) {
    this.isAdmin   = authService.isAdmin();
    this.userName  = authService.getName() || authService.getTokenPayload()?.email?.split('@')[0] || 'My Account';
    this.userEmail = authService.getTokenPayload()?.email ?? '';
    this.userInitial = this.userName.charAt(0).toUpperCase();
  }

  ngOnInit(): void {
    this.breakpointObserver.observe('(max-width: 768px)')
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.isMobile = state.matches;
        this.cdr.markForCheck();
      });

    this.syncLoansOpen(this.router.url);
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe((e: any) => {
      this.syncLoansOpen(e.urlAfterRedirects ?? e.url);
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncLoansOpen(url: string): void {
    if (LOAN_PATHS.some(p => url.startsWith(p))) {
      this.loansOpen = true;
    }
  }

  toggleLoans(): void {
    this.loansOpen = !this.loansOpen;
  }

  onNavClick(): void {
    if (this.isMobile && this.sidenav) {
      this.sidenav.close();
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/auth/login']),
      error:    () => this.router.navigate(['/auth/login']),
    });
  }
}
